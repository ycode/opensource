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

import React, { useMemo, useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  DragCancelEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import { Box, Type, Heading, Image as ImageIcon, Square, ChevronRight } from 'lucide-react';
import type { Layer } from '../../../types';
import { flattenTree, type FlattenedItem } from '../../../lib/tree-utilities';
import { cn } from '../../../lib/utils';

interface LayersTreeProps {
  layers: Layer[];
  selectedLayerId: string | null;
  onLayerSelect: (layerId: string) => void;
  onReorder: (newLayers: Layer[]) => void;
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
}

// Element icon mapping
const elementIcons: Record<Layer['type'], React.ElementType> = {
  container: Box,
  text: Type,
  heading: Heading,
  image: ImageIcon,
};

// Helper function to get display name for layer
function getLayerDisplayName(layer: Layer): string {
  // Special case for Body layer
  if (layer.id === 'body') {
    return 'Body';
  }
  
  const typeLabel = layer.type.charAt(0).toUpperCase() + layer.type.slice(1);
  return typeLabel;
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
  
  const ElementIcon = elementIcons[node.layer.type] || Square;

  return (
    <div className="relative">
      {/* Vertical connector line */}
      {node.depth > 0 && (
        <div
          className="absolute top-0 bottom-0 w-px bg-zinc-700"
          style={{
            left: `${node.depth * 20 - 2}px`,
          }}
        />
      )}

      {/* Drop Indicators */}
      {isOver && dropPosition === 'above' && (
        <div 
          className="absolute top-0 left-0 right-0 h-px bg-blue-500 z-50"
          style={{
            marginLeft: `${node.depth * 20}px`,
          }}
        >
          <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-blue-500 border border-zinc-900" />
        </div>
      )}
      {isOver && dropPosition === 'below' && (
        <div 
          className="absolute bottom-0 left-0 right-0 h-px bg-blue-500 z-50"
          style={{
            marginLeft: `${node.depth * 20}px`,
          }}
        >
          <div className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full bg-blue-500 border border-zinc-900" />
        </div>
      )}
      {isOver && dropPosition === 'inside' && (
        <div className="absolute inset-0 border-2 border-blue-500 rounded bg-blue-500/10 z-40 pointer-events-none" />
      )}

      {/* Main Row */}
      <div
        ref={setRefs}
        {...attributes}
        {...listeners}
        data-drag-active={isDragActive}
        data-layer-id={node.id}
        className={cn(
          'group relative flex items-center h-8 px-2 transition-all',
          !isDragActive && !isDragging && 'hover:bg-zinc-700/80 hover:rounded',
          isSelected && 'bg-[rgb(0_125_255/0.8)] text-white rounded',
          isSelected && !isDragActive && !isDragging && 'hover:bg-[rgb(0_125_255/0.8)]',
          isDragging && 'opacity-40',
          !isDragActive && 'cursor-grab active:cursor-grabbing'
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
            'w-4 h-4 flex items-center justify-center flex-shrink-0 transition-transform duration-150',
            hasChildren ? '' : 'invisible',
            isCollapsed ? '' : 'rotate-90'
          )}
        >
          <ChevronRight className="w-3 h-3 text-zinc-400" />
        </button>

        {/* Layer Icon */}
        <ElementIcon className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400 mx-1.5" />

        {/* Label */}
        <span className="flex-grow text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap">
          {getLayerDisplayName(node.layer)}
        </span>
      </div>
    </div>
  );
}

// Main LayersTree Component
export default function LayersTree({
  layers,
  selectedLayerId,
  onLayerSelect,
  onReorder,
}: LayersTreeProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | 'inside' | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

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

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const draggedId = event.active.id as string;
    const draggedNode = flattenedNodes.find(n => n.id === draggedId);
    
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
  }, [flattenedNodes, onLayerSelect]);

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

    // Calculate pointer position accounting for drag delta
    const pointerY = event.activatorEvent && 'clientY' in event.activatorEvent 
      ? (event.activatorEvent.clientY as number) + event.delta.y
      : event.over.rect.top + event.over.rect.height / 2;

    const { top, height } = event.over.rect;
    const offsetY = pointerY - top;
    const relativeY = offsetY / height;
    
    // Check if node can have children
    const canHaveChildren = overNode.layer.children || 
      overNode.layer.type === 'container';
    
    // Container types strongly prefer "inside" drops
    const isContainerType = overNode.layer.type === 'container';
    
    // Determine drop position based on pointer position
    let position: 'above' | 'below' | 'inside';
    
    // Check if node has visible children
    const hasVisibleChildren = overNode.layer.children && 
                                overNode.layer.children.length > 0 && 
                                !collapsedIds.has(overNode.id);
    
    // DEFAULT DND APPROACH: Simple 50/50 split with special handling for containers
    
    if (isContainerType && hasVisibleChildren) {
      // CONTAINERS WITH VISIBLE CHILDREN: Larger "inside" zone
      if (relativeY < 0.2) {
        position = 'above';
      } else if (relativeY > 0.8) {
        position = 'below';
      } else {
        // 60% of the container is "inside" zone
        position = 'inside';
      }
    } else if (canHaveChildren && isContainerType) {
      // EMPTY/COLLAPSED CONTAINERS: Most area is inside
      if (relativeY < 0.15) {
        position = 'above';
      } else if (relativeY > 0.85) {
        position = 'below';
      } else {
        // 70% of empty container is "inside" zone
        position = 'inside';
      }
    } else {
      // LEAF NODES: Simple 50/50 split
      if (relativeY < 0.5) {
        position = 'above';
      } else {
        position = 'below';
      }
    }

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
  }, [flattenedNodes, collapsedIds, activeId]);

  // Handle drag end - perform the actual reorder
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        console.log('❌ DRAG CANCELLED: No valid drop target');
        setActiveId(null);
        setOverId(null);
        setDropPosition(null);
        return;
      }

      const activeNode = flattenedNodes.find((n) => n.id === active.id);
      const overNode = flattenedNodes.find((n) => n.id === over.id);

      if (!activeNode || !overNode) {
        console.log('❌ DRAG CANCELLED: Node not found');
        setActiveId(null);
        setOverId(null);
        setDropPosition(null);
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
        if (overNode.layer.type !== 'container') {
          console.log('🚫 DRAG BLOCKED:', {
            reason: 'Can only drop inside container elements',
            dragged: getLayerDisplayName(activeNode.layer),
            target: getLayerDisplayName(overNode.layer),
            targetType: overNode.layer.type
          });
          setActiveId(null);
          setOverId(null);
          setDropPosition(null);
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
          explanation: dropPosition === 'above' 
            ? `Will be placed as sibling ABOVE "${getLayerDisplayName(overNode.layer)}" inside "${targetParentNode ? getLayerDisplayName(targetParentNode.layer) : 'ROOT'}" at index ${newOrder}`
            : dropPosition === 'inside'
            ? `Will be placed INSIDE "${getLayerDisplayName(overNode.layer)}" as child at index ${newOrder}`
            : `Will be placed as sibling BELOW "${getLayerDisplayName(overNode.layer)}" inside "${targetParentNode ? getLayerDisplayName(targetParentNode.layer) : 'ROOT'}" at index ${newOrder}`
        }
      });

      console.log('📋 CALLING onReorder with new tree structure');
      
      // FINAL ASSERTION: Verify parentId before rebuild
      console.log('🔍 FINAL CHECK before rebuild:', {
        draggedNodeId: activeNode.id,
        draggedNodeName: getLayerDisplayName(activeNode.layer),
        targetParentId: newParentId,
        targetParentName: newParentId ? (flattenedNodes.find(n => n.id === newParentId) ? getLayerDisplayName(flattenedNodes.find(n => n.id === newParentId)!.layer) : 'NOT FOUND!') : 'ROOT',
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
    },
    [flattenedNodes, dropPosition, onReorder, collapsedIds]
  );

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    console.log('❌ DRAG CANCELLED');
    setActiveId(null);
    setOverId(null);
    setDropPosition(null);
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
              const ElementIcon = elementIcons[activeNode.layer.type] || Square;
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
    const children = byParent.get(nodeId) || [];
    
    return {
      ...node.layer,
      children: children.length > 0 ? children.map(child => buildNode(child.id)) : undefined,
    };
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

