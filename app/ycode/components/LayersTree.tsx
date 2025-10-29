'use client';

/**
 * LayersTree Component - Advanced Hierarchical Tree with Smart Drop Zones
 * 
 * Custom @dnd-kit implementation with:
 * - Smart 25/50/25 drop zone detection
 * - Container-aware drop behavior
 * - Visual hierarchy indicators
 * - Descendant validation
 * - Custom drag overlays with offset
 * - Depth-aware positioning
 */

// 1. React/Next.js
import React, { useMemo, useState, useCallback, useEffect } from 'react';

// 2. External libraries
import { DndContext, DragOverlay, DragStartEvent, DragEndEvent, DragOverEvent, PointerSensor, useSensor, useSensors, closestCenter, useDraggable, useDroppable } from '@dnd-kit/core';
import { Box, Type, Heading, Image as ImageIcon, Square, ChevronRight, Layout, FileText, Link, Video, Music, Film, Code, CheckSquare, Circle, Tag, Check, File, Folder } from 'lucide-react';

// 4. Internal components
import LayerContextMenu from './LayerContextMenu';

// 6. Utils/lib
import { cn } from '../../../lib/utils';
import { flattenTree, type FlattenedItem } from '../../../lib/tree-utilities';
import { canHaveChildren } from '../../../lib/layer-utils';

// 7. Types
import type { Layer } from '../../../types';

interface LayersTreeProps {
  layers: Layer[];
  selectedLayerId: string | null;
  onLayerSelect: (layerId: string) => void;
  onReorder: (newLayers: Layer[]) => void;
  pageId: string;
}

interface LayerRowProps {
  node: FlattenedItem;
  isSelected: boolean;
  isOver: boolean;
  isDragging: boolean;
  isDragActive: boolean;
  dropPosition: 'above' | 'below' | 'inside' | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  pageId: string;
}

// Element icon mapping - Now supports both old 'type' and new 'name' properties
const elementIcons: Record<string, React.ElementType> = {
  // Old system
  container: Box,
  text: Type,
  image: ImageIcon,
  
  // New system - Structure
  div: Box,
  section: Layout,
  hr: Square,
  columns: Layout,
  rows: Layout,
  grid: Layout,
  
  // Content
  heading: Heading, // New consolidated heading
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
  p: Type,
  span: Type,
  richtext: FileText,
  
  // Actions
  button: Square,
  a: Link,
  link: Link,
  
  // Media
  img: ImageIcon,
  icon: Square,
  video: Video,
  audio: Music,
  youtube: Film,
  iframe: Code,
  
  // Forms
  form: FileText,
  input: Type,
  textarea: FileText,
  select: Square,
  checkbox: CheckSquare,
  radio: Circle,
  label: Tag,
  submit: Check,

  // Pages & Folders
  page: File,
  folder: Folder,
};

// Helper function to get display name for layer
function getLayerDisplayName(layer: Layer): string {
  // Special case for Body layer
  if (layer.id === 'body') {
    return 'Body';
  }
  
  // Use custom name if available
  if (layer.customName) {
    return layer.customName;
  }
  
  // Use name property (new system)
  if (layer.name) {
    const name = layer.name;
    // Capitalize first letter
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  
  // Fallback to type property (old system)
  if (layer.type) {
    const typeLabel = layer.type.charAt(0).toUpperCase() + layer.type.slice(1);
    return typeLabel;
  }
  
  return 'Element';
}

// Helper function to get icon key for a layer
function getIconKey(layer: Layer): string {
  // Use name property (new system) or fallback to type (old system)
  return layer.name || layer.type || 'div';
}

// Helper to check if a node is a descendant of another
function isDescendant(
  node: FlattenedItem,
  target: FlattenedItem,
  allNodes: FlattenedItem[]
): boolean {
  if (node.id === target.id) return true;
  
  const parent = allNodes.find((n) => n.id === target.parentId);
  if (!parent) return false;
  
  return isDescendant(node, parent, allNodes);
}

// LayerRow Component - Individual draggable/droppable tree node
function LayerRow({
  node,
  isSelected,
  isOver,
  isDragging,
  isDragActive,
  dropPosition,
  onSelect,
  onToggle,
  pageId,
}: LayerRowProps) {
  const { setNodeRef: setDropRef } = useDroppable({
    id: node.id,
  });

  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id: node.id,
  });

  // Combine refs for drag and drop
  const setRefs = (element: HTMLDivElement | null) => {
    setDragRef(element);
    setDropRef(element);
  };

  const hasChildren = node.layer.children && node.layer.children.length > 0;
  const isCollapsed = node.collapsed || false;
  
  const ElementIcon = elementIcons[getIconKey(node.layer)] || Square;

  // Check if this is the Body layer (locked)
  const isLocked = node.layer.id === 'body' || node.layer.locked === true;

  return (
    <LayerContextMenu
      layerId={node.id}
      pageId={pageId}
      isLocked={isLocked}
      onLayerSelect={onSelect}
    >
      <div className="relative">
        {/* Vertical connector line */}
        {node.depth > 0 && (
          <div
            className={cn(
                'absolute z-10 top-0 bottom-0 w-px ',
                isSelected && 'bg-white/10',
                !isSelected && 'bg-secondary',
            )}
            style={{
              left: `${node.depth * 18 - 2}px`,
            }}
          />
        )}

        {/* Drop Indicators */}
        {isOver && dropPosition === 'above' && (
          <div 
            className="absolute top-0 left-0 right-0 h-[1.5px] bg-primary z-50"
            style={{
              marginLeft: `${node.depth * 18}px`,
            }}
          >
            <div className="absolute -bottom-[3px] -left-[5.5px] size-2 rounded-full border border-[1.5px] bg-neutral-950 border-primary" />
          </div>
        )}
        {isOver && dropPosition === 'below' && (
          <div 
            className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-primary z-50"
            style={{
              marginLeft: `${node.depth * 18}px`,
            }}
          >
            <div className="absolute -bottom-[3px] -left-[5.5px] size-2 rounded-full border border-[1.5px] bg-neutral-950 border-primary" />
          </div>
        )}
        {isOver && dropPosition === 'inside' && (
          <div className="absolute inset-0 border-[1.5px] border-primary rounded-lg z-40 pointer-events-none" />
        )}

        {/* Main Row */}
        <div
          ref={setRefs}
          {...attributes}
          {...listeners}
          data-drag-active={isDragActive}
          data-layer-id={node.id}
          className={cn(
            'group relative flex items-center h-8 rounded-lg text-muted-foreground',
            !isDragActive && !isDragging && 'hover:bg-secondary/50',
            isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
            isSelected && !isDragActive && !isDragging && '',
            isDragging && '',
            !isDragActive && ''
          )}
          style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
          onClick={() => onSelect(node.id)}
        >
          {/* Expand/Collapse Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className={cn(
              'w-4 h-4 flex items-center justify-center flex-shrink-0',
              hasChildren ? '' : 'invisible',
              isCollapsed ? '' : 'rotate-90'
            )}
          >
            <ChevronRight className="w-3 h-3 text-zinc-400" />
          </button>

          {/* Layer Icon */}
          {/*<ElementIcon className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400 mx-1.5" />*/}
          <div className="size-3 bg-white/10 rounded mx-1.5"/>

          {/* Label */}
          <span className="flex-grow text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none">
            {getLayerDisplayName(node.layer)}
          </span>
        </div>
      </div>
    </LayerContextMenu>
  );
}

// Main LayersTree Component
export default function LayersTree({
  layers,
  selectedLayerId,
  onLayerSelect,
  onReorder,
  pageId,
}: LayersTreeProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | 'inside' | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [cursorOffsetY, setCursorOffsetY] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Flatten the tree for rendering
  const flattenedNodes = useMemo(
    () => flattenTree(layers, null, 0, collapsedIds),
    [layers, collapsedIds]
  );

  // Get the currently active node being dragged
  const activeNode = useMemo(
    () => flattenedNodes.find((node) => node.id === activeId),
    [activeId, flattenedNodes]
  );

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  // Listen for expand events from ElementLibrary
  useEffect(() => {
    const handleExpandLayer = (event: CustomEvent) => {
      const { layerId } = event.detail;
      if (layerId && collapsedIds.has(layerId)) {
        setCollapsedIds((prev) => {
          const next = new Set(prev);
          next.delete(layerId);
          return next;
        });
      }
    };

    window.addEventListener('expandLayer', handleExpandLayer as EventListener);
    return () => window.removeEventListener('expandLayer', handleExpandLayer as EventListener);
  }, [collapsedIds]);

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    // Prevent starting a new drag while processing the previous one
    if (isProcessing) {
      console.log('⏸️ DRAG BLOCKED: Previous drag still processing');
      return;
    }

    const draggedId = event.active.id as string;
    const draggedNode = flattenedNodes.find(n => n.id === draggedId);
    
    // Calculate where user clicked within the element
    const activeRect = event.active.rect.current.initial;
    if (activeRect && event.activatorEvent) {
      const clickY = (event.activatorEvent as PointerEvent).clientY;
      const elementTop = activeRect.top;
      const offsetWithinElement = clickY - elementTop;
      setCursorOffsetY(offsetWithinElement);
    } else if (activeRect) {
      setCursorOffsetY(activeRect.height / 2); // Fallback to middle
    }
    
    console.log('🎯 DRAG START:', {
      id: draggedId,
      name: getLayerDisplayName(draggedNode?.layer!),
      type: draggedNode?.layer.type,
      depth: draggedNode?.depth,
      isImageLayer: draggedNode?.layer.type === 'image'
    });
    
    if (draggedNode?.layer.type === 'image') {
      console.log('📷 IMAGE LAYER DRAG DETECTED - This should work!');
    }
    
    setActiveId(draggedId);
    onLayerSelect(draggedId);
  }, [flattenedNodes, onLayerSelect, isProcessing]);

  // Handle drag over - standard 25/50/25 drop zone detection
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | null;
    
    if (!overId || !event.over?.rect) {
      setOverId(null);
      setDropPosition(null);
      return;
    }

    const overNode = flattenedNodes.find((n) => n.id === overId);
    const activeNode = activeId ? flattenedNodes.find((n) => n.id === activeId) : null;
    
    if (!overNode) {
      setDropPosition(null);
      return;
    }

    console.log('🎯 DRAG OVER:', {
      overId,
      nodeType: overNode.layer.type,
      hasChildren: !!overNode.layer.children,
      childrenCount: overNode.layer.children?.length || 0,
      isCollapsed: collapsedIds.has(overId)
    });

    // CRITICAL: Prevent dropping outside Body layer
    // If hovering over Body itself, only allow "inside" drops
    if (overNode.id === 'body') {
      setOverId(overId);
      setDropPosition('inside');
      return;
    }

    // Calculate pointer position relative to the hovered element
    // Use the current drag event's active position for accurate detection
    const activeRect = event.active.rect.current;
    if (!activeRect.initial) {
      setOverId(overId);
      setDropPosition(null);
      return;
    }
    
    const pointerY = activeRect.translated?.top ?? activeRect.initial.top;
    const { top, height } = event.over.rect;
    
    // Use the ACTUAL cursor offset captured on drag start
    const actualPointerY = pointerY + cursorOffsetY;
    
    const offsetY = actualPointerY - top;
    const relativeY = offsetY / height;
    
    // Check if node can have children using the shared utility
    const nodeCanHaveChildren = canHaveChildren(overNode.layer);
    
    console.log('🔍 DROP ZONE CHECK:', {
      overNodeName: overNode.layer.name,
      overNodeType: overNode.layer.type,
      overNodeCustomName: overNode.layer.customName,
      canHaveChildren: nodeCanHaveChildren,
      relativeY: relativeY.toFixed(2)
    });
    
    // Container types strongly prefer "inside" drops
    // Check both old type property and new name property
    const isContainerType = overNode.layer.type === 'container' || 
                           overNode.layer.name === 'div' ||
                           overNode.layer.name === 'section' ||
                           overNode.layer.name === 'form';
    
    // Determine drop position based on pointer position
    let position: 'above' | 'below' | 'inside';
    
    // Check if node has visible children
    const hasVisibleChildren = overNode.layer.children && 
                                overNode.layer.children.length > 0 && 
                                !collapsedIds.has(overNode.id);
    
    // Clearer, more predictable drop zones
    if (nodeCanHaveChildren) {
      // Elements that can have children use generous inside zone
      if (isContainerType) {
        // Containers (Block, Section, Container, Form)
        if (hasVisibleChildren) {
          // With visible children: 15% top/bottom, 70% inside
          if (relativeY < 0.15) {
            position = 'above';
          } else if (relativeY > 0.85) {
            position = 'below';
          } else {
            position = 'inside';
          }
        } else {
          // Empty/collapsed containers: 10% top/bottom, 80% inside
          if (relativeY < 0.10) {
            position = 'above';
          } else if (relativeY > 0.90) {
            position = 'below';
          } else {
            position = 'inside';
          }
        }
      } else {
        // Other elements that can have children (e.g., links with nested content)
        if (relativeY < 0.20) {
          position = 'above';
        } else if (relativeY > 0.80) {
          position = 'below';
        } else {
          position = 'inside';
        }
      }
    } else {
      // Leaf nodes: simple 50/50 split
      position = relativeY < 0.5 ? 'above' : 'below';
    }

    console.log('📍 CALCULATED DROP POSITION:', {
      position,
      overNode: overNode.layer.customName || overNode.layer.name,
      isContainerType,
      nodeCanHaveChildren,
      hasVisibleChildren
    });

    // CRITICAL: Prevent reordering within same parent from moving outside parent
    // If dragging an element within its own parent, "above/below" should only reorder
    // within that parent, not escape to the parent's parent level
    if (activeNode && (position === 'above' || position === 'below')) {
      const targetParentId = overNode.parentId;
      const currentParentId = activeNode.parentId;
      
      // Check if hovering over a container that IS the current parent
      // This would place element outside its own container
      if (overNode.id === currentParentId && overNode.layer.type === 'container') {
        // Dragging over the container that contains the dragged element
        // "above" or "below" would escape to the grandparent level
        console.log('🚫 DROP BLOCKED: Would escape own container', {
          container: getLayerDisplayName(overNode.layer),
          position,
        });
        setOverId(null);
        setDropPosition(null);
        return;
      }
      
      // ADDITIONAL CHECK: If both are siblings but the target's parent is different from
      // what the drop would result in, block it
      // This catches the edge case where "above" first child would place at parent level
      if (currentParentId === targetParentId && currentParentId !== null) {
        // Same parent - check if this would actually change the parent
        // For "above" on first child or "below" on last child, the actual placement
        // would be at parent level (escaping the container)
        
        // Find all siblings in this container
        const siblingsInParent = flattenedNodes.filter(n => n.parentId === currentParentId);
        
        // Check if target is first child and we're going "above"
        // OR if target is last child and we're going "below"
        const isFirstSibling = overNode.index === 0;
        const isLastSibling = overNode.index === siblingsInParent.length - 1;
        
        // CRITICAL: Check what the actual resulting parent would be
        // If position is "above" first child, it would use overNode.parentId which might escape
        // We need to ensure this doesn't change the parent level
        
        if (position === 'above' && isFirstSibling) {
          // This would place ABOVE the first child
          // In the tree, this means same parent (which is fine)
          // But we need to make sure the depth stays the same
          console.log('✅ ALLOWING above first sibling (stays in container)');
        }
        
        if (position === 'below' && isLastSibling) {
          // This would place BELOW the last child
          // Should stay at same level
          console.log('✅ ALLOWING below last sibling (stays in container)');
        }
        
        // Allow reordering within same parent
      } else if (currentParentId !== targetParentId) {
        // Different parents - this is a cross-container move
        // Block if it would place at root level (outside Body)
        if (targetParentId === null) {
          // Don't show ANY drop indicator - cancel the entire hover state
          setOverId(null);
          setDropPosition(null);
          return;
        }
        // Otherwise allow cross-container move - show indicator
      }
    }

    console.log('📍 DROP ZONE:', {
      nodeType: overNode.layer.type,
      position,
      relativeY: relativeY.toFixed(3),
      hasChildren: !!overNode.layer.children,
      hasVisibleChildren,
      isContainerType,
      overNodeParent: overNode.parentId,
      activeNodeParent: activeNode?.parentId,
    });

    setOverId(overId);
    setDropPosition(position);
  }, [flattenedNodes, collapsedIds, activeId, cursorOffsetY]);

  // Handle drag end - perform the actual reorder
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        console.log('❌ DRAG CANCELLED: No valid drop target');
        setActiveId(null);
        setOverId(null);
        setDropPosition(null);
        setCursorOffsetY(0);
        return;
      }

      // Set processing flag to prevent concurrent drags
      setIsProcessing(true);

      const activeNode = flattenedNodes.find((n) => n.id === active.id);
      const overNode = flattenedNodes.find((n) => n.id === over.id);

      if (!activeNode || !overNode) {
        console.log('❌ DRAG CANCELLED: Node not found');
        setActiveId(null);
        setOverId(null);
        setDropPosition(null);
        setCursorOffsetY(0);
        setIsProcessing(false);
        return;
      }

      // Prevent moving into self or descendant
      if (isDescendant(activeNode, overNode, flattenedNodes)) {
        console.log('🚫 DRAG BLOCKED:', {
          reason: 'Cannot move node into itself or its descendant',
          dragged: getLayerDisplayName(activeNode.layer),
          target: getLayerDisplayName(overNode.layer)
        });
        setActiveId(null);
        setOverId(null);
        setDropPosition(null);
        setCursorOffsetY(0);
        setIsProcessing(false);
        return;
      }

      // Handle drop based on dropPosition
      let newParentId: string | null;
      let newOrder: number;

      if (dropPosition === 'above') {
        // Drop above the target - same parent, same order as target
        newParentId = overNode.parentId;
        newOrder = overNode.index;
        
        // CRITICAL: Prevent placement at root level (parentId: null)
        // Everything must be inside Body
        if (newParentId === null) {
          console.log('🚫 DRAG BLOCKED:', {
            reason: 'Cannot place layers outside Body container',
            targetNode: getLayerDisplayName(overNode.layer),
          });
          setActiveId(null);
          setOverId(null);
          setDropPosition(null);
          setCursorOffsetY(0);
          setIsProcessing(false);
          return;
        }
        
        console.log('📍 DROP ABOVE:', {
          targetNode: getLayerDisplayName(overNode.layer),
          targetParentId: overNode.parentId,
          targetIndex: overNode.index,
          willPlaceAt: { parentId: newParentId, index: newOrder }
        });
      } else if (dropPosition === 'inside') {
        // Drop inside the target - target becomes parent
        // Validate that target can accept children
        if (!canHaveChildren(overNode.layer)) {
          console.log('🚫 DRAG BLOCKED:', {
            reason: 'Target element cannot have children',
            dragged: getLayerDisplayName(activeNode.layer),
            target: getLayerDisplayName(overNode.layer),
            targetType: overNode.layer.type,
            targetName: overNode.layer.name
          });
          setActiveId(null);
          setOverId(null);
          setDropPosition(null);
          setCursorOffsetY(0);
          setIsProcessing(false);
          return;
        }
        
        // Target container becomes the new parent
        newParentId = overNode.id;
        
        // Place as LAST child (at the end of the container's children)
        const childrenOfOver = flattenedNodes.filter(n => n.parentId === overNode.id);
        newOrder = childrenOfOver.length > 0 
          ? Math.max(...childrenOfOver.map(n => n.index)) + 1 
          : 0;
          
        console.log('📍 DROP INSIDE:', {
          targetNode: getLayerDisplayName(overNode.layer),
          targetId: overNode.id,
          newParentId: newParentId,
          existingChildren: childrenOfOver.length,
          willPlaceAt: { parentId: newParentId, index: newOrder }
        });
      } else {
        // Drop below the target (default)
        newParentId = overNode.parentId;
        newOrder = overNode.index + 1;
        
        // CRITICAL: Prevent placement at root level (parentId: null)
        // Everything must be inside Body
        if (newParentId === null) {
          console.log('🚫 DRAG BLOCKED:', {
            reason: 'Cannot place layers outside Body container',
            targetNode: getLayerDisplayName(overNode.layer),
          });
          setActiveId(null);
          setOverId(null);
          setDropPosition(null);
          setCursorOffsetY(0);
          setIsProcessing(false);
          return;
        }
      }

      // Debug: Find parent name for better logging
      const newParentNode = flattenedNodes.find(n => n.id === newParentId);
      const newParentName = newParentNode ? getLayerDisplayName(newParentNode.layer) : 'ROOT';
      const targetParentNode = overNode.parentId ? flattenedNodes.find(n => n.id === overNode.parentId) : null;

      console.log('✅ DRAG END:', {
        action: 'MOVE',
        dragged: {
          id: activeNode.id,
          name: getLayerDisplayName(activeNode.layer),
          oldParent: activeNode.parentId,
          oldParentName: activeNode.parentId ? getLayerDisplayName(flattenedNodes.find(n => n.id === activeNode.parentId)?.layer!) : 'ROOT',
          oldOrder: activeNode.index
        },
        target: {
          id: overNode.id,
          name: getLayerDisplayName(overNode.layer),
          depth: overNode.depth,
          parentId: overNode.parentId,
          parentName: targetParentNode ? getLayerDisplayName(targetParentNode.layer) : 'ROOT',
          index: overNode.index,
          dropPosition
        },
        result: {
          newParentId,
          newParentName,
          newOrder,
          expectedDepth: newParentId ? (newParentNode?.depth ?? 0) + 1 : 0,
          explanation: (() => {
            const targetParentName = targetParentNode ? getLayerDisplayName(targetParentNode.layer) : 'ROOT';
            const overLayerName = getLayerDisplayName(overNode.layer);
            
            if (dropPosition === 'above') {
              return `Will be placed as sibling ABOVE "${overLayerName}" inside "${targetParentName}" at index ${newOrder}`;
            }
            
            if (dropPosition === 'inside') {
              return `Will be placed INSIDE "${overLayerName}" as child at index ${newOrder}`;
            }
            
            return `Will be placed as sibling BELOW "${overLayerName}" inside "${targetParentName}" at index ${newOrder}`;
          })()
        }
      });

      console.log('📋 CALLING onReorder with new tree structure');
      
      // Helper function to get target parent name
      const getTargetParentName = (): string => {
        if (!newParentId) return 'ROOT';
        
        const parentNode = flattenedNodes.find(n => n.id === newParentId);
        if (parentNode) {
          return getLayerDisplayName(parentNode.layer);
        }
        
        return 'NOT FOUND!';
      };
      
      // FINAL ASSERTION: Verify parentId before rebuild
      console.log('🔍 FINAL CHECK before rebuild:', {
        draggedNodeId: activeNode.id,
        draggedNodeName: getLayerDisplayName(activeNode.layer),
        targetParentId: newParentId,
        targetParentName: getTargetParentName(),
        targetIndex: newOrder,
        dropPosition: dropPosition
      });
      
      // Rebuild the tree structure
      const newLayers = rebuildTree(flattenedNodes, activeNode.id, newParentId, newOrder);
      onReorder(newLayers);
      
      console.log('✔️ onReorder called');

      setActiveId(null);
      setOverId(null);
      setDropPosition(null);
      setCursorOffsetY(0);
      
      // Use setTimeout to reset processing flag after state updates complete
      setTimeout(() => setIsProcessing(false), 0);
    },
    [flattenedNodes, dropPosition, onReorder, collapsedIds]
  );

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    console.log('❌ DRAG CANCELLED');
    setActiveId(null);
    setOverId(null);
    setDropPosition(null);
    setCursorOffsetY(0);
  }, []);

  // Handle expand/collapse toggle
  const handleToggle = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Handle layer selection
  const handleSelect = useCallback(
    (id: string) => {
      onLayerSelect(id);
    },
    [onLayerSelect]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-0">
        {flattenedNodes.map((node) => (
          <LayerRow
            key={node.id}
            node={node}
            isSelected={selectedLayerId === node.id}
            isOver={overId === node.id}
            isDragging={activeId === node.id}
            isDragActive={!!activeId}
            dropPosition={overId === node.id ? dropPosition : null}
            onSelect={handleSelect}
            onToggle={handleToggle}
            pageId={pageId}
          />
        ))}
      </div>

      {/* Drag Overlay - custom ghost element with 40px offset */}
      <DragOverlay dropAnimation={null}>
        {activeNode ? (
          <div 
            className="flex items-center gap-2 text-white text-xs bg-zinc-800/90 px-3 py-1.5 rounded shadow-lg border border-zinc-600"
            style={{ transform: 'translateX(40px)' }}
          >
            {(() => {
              const ElementIcon = elementIcons[getIconKey(activeNode.layer)] || Square;
              return <ElementIcon className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />;
            })()}
            <span>{getLayerDisplayName(activeNode.layer)}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Helper function to rebuild tree structure after reordering
function rebuildTree(
  flattenedNodes: FlattenedItem[],
  movedId: string,
  newParentId: string | null,
  newOrder: number
): Layer[] {
  console.log('🔨 REBUILD TREE START:', {
    movedId,
    newParentId,
    newOrder,
    totalNodes: flattenedNodes.length
  });
  
  // Create a copy of all nodes
  const nodeCopy = flattenedNodes.map(n => ({ ...n, layer: { ...n.layer } }));
  
  // Find and update the moved node
  const movedNode = nodeCopy.find(n => n.id === movedId);
  if (!movedNode) {
    console.error('❌ REBUILD ERROR: Moved node not found!');
    return [];
  }
  
  console.log('📦 Moving node:', {
    id: movedNode.id,
    type: movedNode.layer.type,
    fromParent: movedNode.parentId,
    toParent: newParentId,
    fromIndex: movedNode.index,
    toIndex: newOrder
  });
  
  // Update moved node's parent and index
  movedNode.parentId = newParentId;
  movedNode.index = newOrder;
  
  // Group nodes by parent
  const byParent = new Map<string | null, FlattenedItem[]>();
  nodeCopy.forEach(node => {
    const parent = node.parentId;
    if (!byParent.has(parent)) {
      byParent.set(parent, []);
    }
    byParent.get(parent)!.push(node);
  });
  
  // Sort each group by index and reassign indices
  byParent.forEach((children, parentId) => {
    // Sort by current index first
    children.sort((a, b) => a.index - b.index);
    
    // If this group contains the moved node, reorder it
    const movedNodeInGroup = children.find(n => n.id === movedId);
    if (movedNodeInGroup) {
      // Remove moved node from its current position
      const movedIndex = children.findIndex(n => n.id === movedId);
      children.splice(movedIndex, 1);
      
      // Insert at new position
      // Find insertion index based on newOrder
      let insertIndex = 0;
      for (let i = 0; i < children.length; i++) {
        if (children[i].index < newOrder) {
          insertIndex = i + 1;
        } else {
          break;
        }
      }
      
      children.splice(insertIndex, 0, movedNodeInGroup);
      
      console.log('🔄 Reordered group:', {
        parentId,
        childCount: children.length,
        movedNodeId: movedId,
        insertedAt: insertIndex,
        children: children.map((c, idx) => ({ id: c.id, oldIndex: c.index, newIndex: idx }))
      });
    }
    
    // Reassign sequential indices
    children.forEach((child, idx) => {
      child.index = idx;
    });
  });
  
  // Build tree recursively
  function buildNode(nodeId: string): Layer {
    const node = nodeCopy.find(n => n.id === nodeId)!;
    const childNodes = byParent.get(nodeId) || [];
    
    const result: Layer = { ...node.layer };
    
    if (childNodes.length > 0) {
      result.children = childNodes.map(child => buildNode(child.id));
    }
    
    return result;
  }
  
  // Build root level
  const rootNodes = byParent.get(null) || [];
  const result = rootNodes.map(node => buildNode(node.id));
  
  console.log('✅ REBUILD TREE COMPLETE:', {
    rootNodesCount: result.length,
    result: result.map(layer => ({
      id: layer.id,
      type: layer.type,
      hasChildren: !!layer.children,
      childrenCount: layer.children?.length || 0,
      children: layer.children?.map(c => ({
        id: c.id,
        type: c.type,
        hasChildren: !!c.children
      }))
    }))
  });
  
  return result;
}

