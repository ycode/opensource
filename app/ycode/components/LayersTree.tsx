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
import { Layers as LayersIcon, Component as ComponentIcon, EyeOff } from 'lucide-react';

// 4. Internal components
import LayerContextMenu from './LayerContextMenu';

// 5. Stores
import { useEditorStore } from '@/stores/useEditorStore';
import { useLayerStylesStore } from '@/stores/useLayerStylesStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';

// 6. Utils/lib
import { cn } from '@/lib/utils';
import { flattenTree, type FlattenedItem } from '@/lib/tree-utilities';
import { canHaveChildren, getLayerIcon, getLayerName, getCollectionVariable, canMoveLayer } from '@/lib/layer-utils';
import { hasStyleOverrides } from '@/lib/layer-style-utils';

// 7. Types
import type { Layer } from '@/types';
import Icon from '@/components/ui/icon';

interface LayersTreeProps {
  layers: Layer[];
  selectedLayerId: string | null;
  selectedLayerIds?: string[]; // New multi-select support
  onLayerSelect: (layerId: string) => void;
  onReorder: (newLayers: Layer[]) => void;
  pageId: string;
}

interface LayerRowProps {
  node: FlattenedItem;
  isSelected: boolean;
  isChildOfSelected: boolean; // New: indicates this is a child of selected parent
  isLastVisibleDescendant: boolean; // New: last visible descendant of selected parent
  hasVisibleChildren: boolean; // New: has visible children
  canHaveChildren: boolean; // Pre-calculated from node.canHaveChildren
  isOver: boolean;
  isDragging: boolean;
  isDragActive: boolean;
  dropPosition: 'above' | 'below' | 'inside' | null;
  highlightedDepths: Set<number>; // Depths that should be highlighted
  onSelect: (id: string) => void;
  onMultiSelect: (id: string, modifiers: { meta: boolean; shift: boolean }) => void;
  onToggle: (id: string) => void;
  pageId: string;
  selectedLayerId: string | null; // Added for context menu
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
  isChildOfSelected,
  isLastVisibleDescendant,
  hasVisibleChildren,
  canHaveChildren,
  isOver,
  isDragging,
  isDragActive,
  dropPosition,
  highlightedDepths,
  onSelect,
  onMultiSelect,
  onToggle,
  pageId,
  selectedLayerId,
}: LayerRowProps) {
  const { getStyleById } = useLayerStylesStore();
  const { getComponentById } = useComponentsStore();
  const { collections } = useCollectionsStore();
  const {
    editingComponentId,
    interactionTriggerLayerIds,
    interactionTargetLayerIds,
    activeInteractionTriggerLayerId,
    activeInteractionTargetLayerIds,
    setHoveredLayerId,
  } = useEditorStore();
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

  // Check if this is a component instance
  const appliedComponent = node.layer.componentId ? getComponentById(node.layer.componentId) : null;
  const isComponentInstance = !!appliedComponent;

  // Get collection name if this is a collection layer
  const collectionName = node.layer.collection?.id
    ? collections.find(c => c.id === node.layer.collection?.id)?.name
    : undefined;

  // Also check new variables structure
  const collectionVariable = getCollectionVariable(node.layer);
  const finalCollectionName = collectionVariable?.id
    ? collections.find(c => c.id === collectionVariable.id)?.name
    : collectionName;

  // Component instances should not show children in the tree (unless editing master)
  // Children can only be edited via "Edit master component"
  const shouldHideChildren = isComponentInstance && !editingComponentId;
  const effectiveHasChildren = hasChildren && !shouldHideChildren;

  // Use purple for component instances OR when editing a component
  const usePurpleStyle = isComponentInstance || !!editingComponentId;

  // Get icon name from blocks template system
  const layerIcon = getLayerIcon(node.layer);

  // Check if this is the Body layer (locked)
  const isLocked = node.layer.id === 'body';

  return (
    <LayerContextMenu
      layerId={node.id}
      pageId={pageId}
      isLocked={isLocked}
      onLayerSelect={onSelect}
      selectedLayerId={selectedLayerId}
    >
      <div className="relative">
        {/* Vertical connector lines - one for each depth level */}
        {node.depth > 0 && (
          <>
            {Array.from({ length: node.depth }).map((_, i) => {
              const shouldHighlight = (isSelected || isChildOfSelected) && highlightedDepths.has(i);
              return (
                <div
                  key={i}
                  className={cn(
                    'absolute z-10 top-0 bottom-0 w-px ',
                    shouldHighlight && 'bg-white/30',
                    isSelected && '!bg-white/10',
                    isChildOfSelected && 'dark:bg-white/10 bg-neutral-900/10',
                    !shouldHighlight && !isChildOfSelected && 'dark:bg-secondary bg-neutral-900/10',
                  )}
                  style={{
                    left: `${i * 14 + 16}px`,
                  }}
                />
              );
            })}
          </>
        )}

        {/* Drop Indicators */}
        {isOver && dropPosition === 'above' && (
          <div
            className={cn(
              'absolute top-0 left-0 right-0 h-[1.5px] z-50',
              editingComponentId ? 'bg-purple-500' : 'bg-primary'
            )}
            style={{
              marginLeft: `${node.depth * 14 + 8}px`,
            }}
          >
            <div
              className={cn(
                'absolute -bottom-[3px] -left-[5.5px] size-2 rounded-full border-[1.5px] bg-neutral-950',
                editingComponentId ? 'border-purple-500' : 'border-primary'
              )}
            />
          </div>
        )}
        {isOver && dropPosition === 'below' && (
          <div
            className={cn(
              'absolute bottom-0 left-0 right-0 h-[1.5px] z-50',
              editingComponentId ? 'bg-purple-500' : 'bg-primary'
            )}
            style={{
              marginLeft: `${node.depth * 14 + 8}px`,
            }}
          >
            <div
              className={cn(
                'absolute -bottom-[3px] -left-[5.5px] size-2 rounded-full border-[1.5px] bg-neutral-950',
                editingComponentId ? 'border-purple-500' : 'border-primary'
              )}
            />
          </div>
        )}
        {isOver && dropPosition === 'inside' && (
          <div
            className={cn(
              'absolute inset-0 border-[1.5px] rounded-lg z-40 pointer-events-none',
              editingComponentId ? 'border-purple-500' : 'border-primary'
            )}
          />
        )}

        {/* Main Row */}
        <div
          ref={setRefs}
          {...attributes}
          {...listeners}
          data-drag-active={isDragActive}
          data-layer-id={node.id}
          className={cn(
            'group relative flex items-center h-8 outline-none focus:outline-none cursor-pointer',
            // Conditional rounding based on position in selected group
            // Selected parent: rounded top, rounded bottom ONLY if no visible children
            isSelected && !hasVisibleChildren && 'rounded-lg', // No children: fully rounded
            isSelected && hasVisibleChildren && 'rounded-t-lg', // Has children: only top rounded
            // Children of selected should have NO rounding, EXCEPT last visible descendant gets bottom rounding
            !isSelected && isChildOfSelected && !isLastVisibleDescendant && 'rounded-none',
            !isSelected && isChildOfSelected && isLastVisibleDescendant && 'rounded-b-lg',
            // Not in group: fully rounded
            !isSelected && !isChildOfSelected && 'rounded-lg text-secondary-foreground/80 dark:text-muted-foreground',
            // Background colors
            !isDragActive && !isDragging && 'hover:bg-secondary/50',
            // Component instances OR component edit mode use purple, regular layers use blue
            isSelected && !usePurpleStyle && 'bg-primary text-primary-foreground hover:bg-primary',
            isSelected && usePurpleStyle && 'bg-purple-500 text-white hover:bg-purple-500',
            !isSelected && isChildOfSelected && !usePurpleStyle && 'dark:bg-primary/15 bg-primary/10 text-current/70 hover:bg-primary/15 dark:hover:bg-primary/20',
            !isSelected && isChildOfSelected && usePurpleStyle && 'dark:bg-purple-500/10 bg-purple-500/10 text-current/70 hover:bg-purple-500/15 dark:hover:bg-purple-500/20',
            isSelected && !isDragActive && !isDragging && '',
            isDragging && '',
            !isDragActive && ''
          )}
          style={{ paddingLeft: `${node.depth * 14 + 8}px` }}
          onMouseEnter={() => {
            if (!isDragging) {
              setHoveredLayerId(node.id);
            }
          }}
          onMouseLeave={() => {
            setHoveredLayerId(null);
          }}
          onClick={(e) => {
            // Normal click: Select only this layer
            onSelect(node.id);
          }}
        >
          {/* Expand/Collapse Button - only show for elements that can have children */}
          {node.canHaveChildren ? (
            effectiveHasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!shouldHideChildren) {
                    onToggle(node.id);
                  }
                }}
                className={cn(
                  'w-4 h-4 flex items-center justify-center flex-shrink-0',
                  isCollapsed ? '' : 'rotate-90',
                  shouldHideChildren && 'opacity-30 cursor-not-allowed'
                )}
                disabled={shouldHideChildren}
              >
                <Icon name="chevronRight" className={cn('size-2.5 opacity-50', isSelected && 'opacity-80')} />
              </button>
            ) : (
              <div className="w-4 h-4 flex-shrink-0" />
            )
          ) : (
            <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
              <div className={cn('ml-0.25 w-1.5 h-px bg-white opacity-0', isSelected && 'opacity-0')} />
            </div>
          )}

          {/* Layer Icon */}
          {isComponentInstance ? (
            <Icon name="component" className="size-3 mx-1.5" />
          ) : layerIcon ? (
            <Icon
              name={layerIcon}
              className={cn(
                'size-3 mx-1.5 opacity-50',
                isSelected && 'opacity-100',
              )}
            />
          ) : (
            <div
              className={cn(
                'size-3 bg-secondary rounded mx-1.5',
                isSelected && 'opacity-10 dark:bg-white'
              )}
            />
          )}

          {/* Label */}
          <span className="flex-grow text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none">
            {getLayerName(node.layer, {
              component_name: appliedComponent?.name,
              collection_name: finalCollectionName,
            })}
          </span>

          {/* Style Indicator */}
          {node.layer.styleId && (
            <div className="flex items-center gap-1 mr-2 flex-shrink-0">
              <LayersIcon className="w-3 h-3 text-purple-400" />
              {(() => {
                const appliedStyle = getStyleById(node.layer.styleId);
                return appliedStyle && hasStyleOverrides(node.layer, appliedStyle) && (
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400" title="Style overridden" />
                );
              })()}
            </div>
          )}

          {/* Interaction trigger indicator */}
          {interactionTriggerLayerIds.includes(node.id) && (
            <Icon
              name="zap"
              className={cn(
                'size-3 mr-2 flex-shrink-0',
                activeInteractionTriggerLayerId === node.id ? 'text-white/80' : 'text-white/40'
              )}
            />
          )}

          {/* Interaction target indicator */}
          {interactionTargetLayerIds.includes(node.id) && !interactionTriggerLayerIds.includes(node.id) && (
            <Icon
              name="zap-outline"
              className={cn(
                'size-3 mr-2 flex-shrink-0',
                activeInteractionTargetLayerIds.includes(node.id) ? 'text-white/70' : 'text-white/40'
              )}
            />
          )}

          {/* Hidden indicator */}
          {node.layer.settings?.hidden && (
            <Icon
              name="eye-off"
              className={cn(
                'size-3 mr-3 opacity-50',
                isSelected && 'opacity-100',
              )}
            />
          )}
        </div>
      </div>
    </LayerContextMenu>
  );
}

// EndDropZone Component - Drop target for adding layers at the end (bottom of Body)
function EndDropZone({
  isDragActive,
  isOver,
  editingComponentId,
}: {
  isDragActive: boolean;
  isOver: boolean;
  editingComponentId: string | null;
}) {
  const { setNodeRef } = useDroppable({
    id: 'end-drop-zone',
  });

  if (!isDragActive) return null;

  return (
    <div
      ref={setNodeRef}
      className="relative h-8 flex items-center"
    >
      {isOver && (
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-[1.5px] z-50 ml-2',
            editingComponentId ? 'bg-purple-500' : 'bg-primary'
          )}
        >
          <div
            className={cn(
              'absolute -bottom-[3px] -left-[5.5px] size-2 rounded-full border-[1.5px] bg-neutral-950',
              editingComponentId ? 'border-purple-500' : 'border-primary'
            )}
          />
        </div>
      )}
    </div>
  );
}

// Main LayersTree Component
export default function LayersTree({
  layers,
  selectedLayerId,
  selectedLayerIds: propSelectedLayerIds,
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

  // Pull multi-select state from editor store
  const { selectedLayerIds: storeSelectedLayerIds, lastSelectedLayerId, toggleSelection, selectRange, editingComponentId } = useEditorStore();

  // Get component by ID function for drag overlay
  const { getComponentById } = useComponentsStore();

  // Get collections from store
  const { collections } = useCollectionsStore();

  // Use prop or store state (prop takes precedence for compatibility)
  const selectedLayerIds = propSelectedLayerIds ?? storeSelectedLayerIds;

  // Flatten the tree for rendering
  const flattenedNodes = useMemo(
    () => {
      const flattened = flattenTree(layers, null, 0, collapsedIds);

      // Validate no duplicate IDs in flattened array
      if (process.env.NODE_ENV === 'development') {
        const seenIds = new Map<string, { parentId: string | null; depth: number; index: number }>();
        const duplicates: Array<{ id: string; locations: Array<{ parentId: string | null; depth: number; index: number }> }> = [];

        flattened.forEach((node, idx) => {
          if (seenIds.has(node.id)) {
            // Find existing duplicate entry or create new one
            let dupEntry = duplicates.find(d => d.id === node.id);
            if (!dupEntry) {
              dupEntry = {
                id: node.id,
                locations: [seenIds.get(node.id)!]
              };
              duplicates.push(dupEntry);
            }
            dupEntry.locations.push({ parentId: node.parentId, depth: node.depth, index: node.index });
          }
          seenIds.set(node.id, { parentId: node.parentId, depth: node.depth, index: node.index });
        });

        if (duplicates.length > 0) {
          console.error('❌ DUPLICATE IDs IN FLATTENED NODES:');
          duplicates.forEach(dup => {
            console.error(`  ID: ${dup.id}`);
            console.error(`  Found at:`, dup.locations);
          });
          console.error('Full layers structure:', JSON.stringify(layers, null, 2));

          // Also check the source layers structure for duplicates
          const layerIds = new Set<string>();
          function checkLayerDuplicates(layerList: Layer[], path: string = 'root'): void {
            layerList.forEach((layer, idx) => {
              const currentPath = `${path}[${idx}]`;
              if (layerIds.has(layer.id)) {
                console.error(`  Also found in source at: ${currentPath}`);
              }
              layerIds.add(layer.id);
              if (layer.children) {
                checkLayerDuplicates(layer.children, `${currentPath}.children`);
              }
            });
          }
          checkLayerDuplicates(layers);
        }
      }

      return flattened;
    },
    [layers, collapsedIds]
  );

  // Calculate which depth levels should be highlighted (selected containers)
  const highlightedDepths = useMemo(() => {
    const depths = new Set<number>();
    const selectedIds = selectedLayerId ? [selectedLayerId, ...selectedLayerIds] : selectedLayerIds;

    selectedIds.forEach(id => {
      const node = flattenedNodes.find(n => n.id === id);
      if (node && node.canHaveChildren) {
        depths.add(node.depth);
      }
    });

    return depths;
  }, [flattenedNodes, selectedLayerId, selectedLayerIds]);

  // Get the currently active node being dragged
  const activeNode = useMemo(
    () => flattenedNodes.find((node) => node.id === activeId),
    [activeId, flattenedNodes]
  );

  // Get collection name for active node (for drag overlay)
  const activeNodeCollectionName = useMemo(() => {
    if (!activeNode) return undefined;
    const collectionVariable = getCollectionVariable(activeNode.layer);
    return collectionVariable?.id
      ? collections.find(c => c.id === collectionVariable.id)?.name
      : activeNode.layer.collection?.id
        ? collections.find(c => c.id === activeNode.layer.collection?.id)?.name
        : undefined;
  }, [activeNode, collections]);

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  // Multi-select click handler
  const handleMultiSelect = useCallback((id: string, modifiers: { meta: boolean; shift: boolean }) => {
    if (id === 'body') {
      // Body layer can't be multi-selected
      onLayerSelect(id);
      return;
    }

    if (modifiers.meta) {
      // Cmd/Ctrl+Click: Toggle selection
      toggleSelection(id);
    } else if (modifiers.shift && lastSelectedLayerId) {
      // Shift+Click: Select range
      selectRange(lastSelectedLayerId, id, flattenedNodes);
    }
  }, [toggleSelection, selectRange, lastSelectedLayerId, flattenedNodes, onLayerSelect]);

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

  // Pull hover state management from editor store
  const { setHoveredLayerId: setHoveredLayerIdFromStore } = useEditorStore();

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    // Prevent starting a new drag while processing the previous one
    if (isProcessing) {
      return;
    }

    const draggedId = event.active.id as string;
    const draggedNode = flattenedNodes.find(n => n.id === draggedId);

    // Clear hover state when dragging starts
    setHoveredLayerIdFromStore(null);

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

    setActiveId(draggedId);
    onLayerSelect(draggedId);
  }, [flattenedNodes, onLayerSelect, isProcessing, setHoveredLayerIdFromStore]);

  // Handle drag over - standard 25/50/25 drop zone detection
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | null;

    if (!overId || !event.over?.rect) {
      setOverId(null);
      setDropPosition(null);
      return;
    }

    // Handle drop at the end of the list (after all layers)
    if (overId === 'end-drop-zone') {
      const activeNode = activeId ? flattenedNodes.find((n) => n.id === activeId) : null;

      // For Sections, allow dropping at end (will be placed as last child of Body)
      // For other layers, also allow (will be placed as last child of Body)
      setOverId(overId);
      setDropPosition('below'); // Will be treated as "after last item"
      return;
    }

    const overNode = flattenedNodes.find((n) => n.id === overId);
    const activeNode = activeId ? flattenedNodes.find((n) => n.id === activeId) : null;

    if (!overNode) {
      setDropPosition(null);
      return;
    }

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

    // Use pre-calculated canHaveChildren from the node
    const nodeCanHaveChildren = overNode.canHaveChildren;

    // Special case: When dragging Section, disable "inside" drop for all containers except Body
    // Sections can only be at Body level, never nested inside other containers
    const isDraggingSection = activeNode && activeNode.layer.name === 'section';
    const isOverBody = overNode.id === 'body' || overNode.layer.name === 'body';
    const shouldDisableInsideDrop = isDraggingSection && !isOverBody;

    // Layers that can have children strongly prefer "inside" drops
    const isContainerType = nodeCanHaveChildren && !shouldDisableInsideDrop;

    // Determine drop position based on pointer position
    let position: 'above' | 'below' | 'inside';

    // Check if node has visible children
    const hasVisibleChildren = overNode.layer.children &&
                                overNode.layer.children.length > 0 &&
                                !collapsedIds.has(overNode.id);

    // Clearer, more predictable drop zones
    if (nodeCanHaveChildren && !shouldDisableInsideDrop) {
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

    // CRITICAL: When dragging a Section, prevent it from being dropped inside ANY container except Body
    // Check if the target node's parent is NOT Body (Section can only be at Body level)
    if (isDraggingSection && (position === 'above' || position === 'below')) {
      const targetParentId = overNode.parentId;

      // If the parent is not Body, don't allow Section to be dropped here
      if (targetParentId && targetParentId !== 'body') {
        const parentNode = flattenedNodes.find(n => n.id === targetParentId);
        const parentIsBody = parentNode?.id === 'body' || parentNode?.layer.name === 'body';

        if (!parentIsBody) {
          // Hovering over a child of a non-Body container - don't show drop indicator
          setOverId(null);
          setDropPosition(null);
          return;
        }
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
      if (overNode.id === currentParentId && canHaveChildren(overNode.layer)) {
        // Dragging over the container that contains the dragged element
        // "above" or "below" would escape to the grandparent level
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
        }

        if (position === 'below' && isLastSibling) {
          // This would place BELOW the last child
          // Should stay at same level
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

    // Check ancestor restrictions
    if (activeNode && position) {
      const targetParentId = position === 'inside' ? overNode.id : overNode.parentId;
      
      // Check if the layer can be moved to the new parent based on ancestor restrictions
      if (!canMoveLayer(layers, activeNode.id, targetParentId)) {
        // Cannot move due to ancestor restrictions - don't show drop indicator
        setOverId(null);
        setDropPosition(null);
        return;
      }
    }

    setOverId(overId);
    setDropPosition(position);
  }, [flattenedNodes, collapsedIds, activeId, cursorOffsetY, layers]);

  // Handle drag end - perform the actual reorder
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        setActiveId(null);
        setOverId(null);
        setDropPosition(null);
        setCursorOffsetY(0);
        return;
      }

      // Set processing flag to prevent concurrent drags
      setIsProcessing(true);

      const activeNode = flattenedNodes.find((n) => n.id === active.id);

      // Handle drop at the end of the list
      if (over.id === 'end-drop-zone') {
        if (!activeNode) {
          setActiveId(null);
          setOverId(null);
          setDropPosition(null);
          setCursorOffsetY(0);
          setIsProcessing(false);
          return;
        }

        // Find the Body layer to add as its last child
        const bodyLayer = flattenedNodes.find(n => n.id === 'body' || n.layer.name === 'body');

        if (bodyLayer) {
          // Get all current children of Body
          const bodyChildren = flattenedNodes.filter(n => n.parentId === bodyLayer.id);
          const maxIndex = bodyChildren.length > 0
            ? Math.max(...bodyChildren.map(n => n.index))
            : -1;

          // Place as last child of Body
          const newLayers = rebuildTree(
            flattenedNodes,
            activeNode.id,
            bodyLayer.id,
            maxIndex + 1
          );

          onReorder(newLayers);
        }

        setActiveId(null);
        setOverId(null);
        setDropPosition(null);
        setCursorOffsetY(0);
        setTimeout(() => setIsProcessing(false), 0);
        return;
      }

      const overNode = flattenedNodes.find((n) => n.id === over.id);

      if (!activeNode || !overNode) {
        setActiveId(null);
        setOverId(null);
        setDropPosition(null);
        setCursorOffsetY(0);
        setIsProcessing(false);
        return;
      }

      // Prevent moving into self or descendant
      if (isDescendant(activeNode, overNode, flattenedNodes)) {
        setActiveId(null);
        setOverId(null);
        setDropPosition(null);
        setCursorOffsetY(0);
        setIsProcessing(false);
        return;
      }

      // Calculate target parent based on drop position
      let targetParentId: string | null;
      if (dropPosition === 'inside') {
        targetParentId = overNode.id;
      } else {
        targetParentId = overNode.parentId;
      }

      // Check ancestor restrictions before allowing the move
      if (!canMoveLayer(layers, activeNode.id, targetParentId)) {
        console.warn(`Cannot move layer ${activeNode.id} - ancestor restriction violated`);
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
          setActiveId(null);
          setOverId(null);
          setDropPosition(null);
          setCursorOffsetY(0);
          setIsProcessing(false);
          return;
        }

        // Prevent Section from being placed outside Body
        // BUT allow reordering Sections when both are already at Body level
        if (activeNode.layer.name === 'section') {
          const parentNode = flattenedNodes.find(n => n.id === newParentId);
          const isParentBody = parentNode?.layer.name === 'body' || parentNode?.id === 'body';

          if (!isParentBody) {
            setActiveId(null);
            setOverId(null);
            setDropPosition(null);
            setCursorOffsetY(0);
            setIsProcessing(false);
            return;
          }
        }
      } else if (dropPosition === 'inside') {
        // Drop inside the target - target becomes parent
        // Validate that target can accept children
        if (!overNode.canHaveChildren) {
          setActiveId(null);
          setOverId(null);
          setDropPosition(null);
          setCursorOffsetY(0);
          setIsProcessing(false);
          return;
        }

        // Prevent dropping Section inside another Section
        if (activeNode.layer.name === 'section' && overNode.layer.name === 'section') {
          setActiveId(null);
          setOverId(null);
          setDropPosition(null);
          setCursorOffsetY(0);
          setIsProcessing(false);
          return;
        }

        // Prevent dropping Section inside any layer that's not Body
        if (activeNode.layer.name === 'section' && overNode.layer.name !== 'body') {
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
      } else {
        // Drop below the target (default)
        newParentId = overNode.parentId;
        newOrder = overNode.index + 1;

        // CRITICAL: Prevent placement at root level (parentId: null)
        // Everything must be inside Body
        if (newParentId === null) {
          setActiveId(null);
          setOverId(null);
          setDropPosition(null);
          setCursorOffsetY(0);
          setIsProcessing(false);
          return;
        }

        // Prevent Section from being placed outside Body
        // BUT allow reordering Sections when both are already at Body level
        if (activeNode.layer.name === 'section') {
          const parentNode = flattenedNodes.find(n => n.id === newParentId);
          const isParentBody = parentNode?.layer.name === 'body' || parentNode?.id === 'body';

          if (!isParentBody) {
            setActiveId(null);
            setOverId(null);
            setDropPosition(null);
            setCursorOffsetY(0);
            setIsProcessing(false);
            return;
          }
        }
      }

      // Rebuild the tree structure
      const newLayers = rebuildTree(flattenedNodes, activeNode.id, newParentId, newOrder);

      onReorder(newLayers);
      setActiveId(null);
      setOverId(null);
      setDropPosition(null);
      setCursorOffsetY(0);

      // Use setTimeout to reset processing flag after state updates complete
      setTimeout(() => setIsProcessing(false), 0);
    },
    [flattenedNodes, dropPosition, onReorder, layers]
  );

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
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
        {flattenedNodes.map((node, nodeIndex) => {
          // Check if this node has visible children
          const hasVisibleChildren = !!(node.layer.children &&
                                        node.layer.children.length > 0 &&
                                        !collapsedIds.has(node.id));

          // Check if this node is a child/descendant of any selected layer
          let parentSelectedId: string | null = null;
          const isChildOfSelected = selectedLayerIds.some(selectedId => {
            // Find the selected node
            const selectedNode = flattenedNodes.find(n => n.id === selectedId);
            if (!selectedNode || node.id === selectedId) return false;

            // Check if node's parentId chain leads to selectedId
            let currentNode: FlattenedItem | undefined = node;
            while (currentNode && currentNode.parentId) {
              if (currentNode.parentId === selectedId) {
                parentSelectedId = selectedId;
                return true;
              }
              currentNode = flattenedNodes.find(n => n.id === currentNode!.parentId);
            }
            return false;
          });

          // Determine if this is the last visible descendant of selected parent
          let isLastVisibleDescendant = false;

          if (isChildOfSelected && parentSelectedId) {
            // Find ALL visible descendants of the selected parent
            const allDescendants: FlattenedItem[] = [];

            for (let i = 0; i < flattenedNodes.length; i++) {
              const checkNode = flattenedNodes[i];

              // Skip the selected parent itself
              if (checkNode.id === parentSelectedId) continue;

              // Check if this node is a descendant of parentSelectedId
              let current: FlattenedItem | undefined = checkNode;
              let isDescendant = false;

              while (current && current.parentId) {
                if (current.parentId === parentSelectedId) {
                  isDescendant = true;
                  break;
                }
                current = flattenedNodes.find(n => n.id === current!.parentId);
              }

              if (isDescendant && !selectedLayerIds.includes(checkNode.id)) {
                allDescendants.push(checkNode);
              }
            }

            if (allDescendants.length > 0) {
              isLastVisibleDescendant = allDescendants[allDescendants.length - 1].id === node.id;
            }
          }

          return (
            <LayerRow
              key={node.id}
              node={node}
              isSelected={selectedLayerIds.includes(node.id) || selectedLayerId === node.id}
              isChildOfSelected={isChildOfSelected}
              isLastVisibleDescendant={isLastVisibleDescendant}
              hasVisibleChildren={hasVisibleChildren}
              canHaveChildren={node.canHaveChildren}
              isOver={overId === node.id}
              isDragging={activeId === node.id}
              isDragActive={!!activeId}
              dropPosition={overId === node.id ? dropPosition : null}
              highlightedDepths={highlightedDepths}
              onSelect={handleSelect}
              onMultiSelect={handleMultiSelect}
              onToggle={handleToggle}
              pageId={pageId}
              selectedLayerId={selectedLayerId}
            />
          );
        })}

        {/* Drop zone at the end for dropping layers at the bottom */}
        <EndDropZone
          isDragActive={!!activeId}
          isOver={overId === 'end-drop-zone'}
          editingComponentId={editingComponentId}
        />
      </div>

      {/* Drag Overlay - custom ghost element with 40px offset */}
      <DragOverlay dropAnimation={null}>
        {activeNode ? (
          <div
            className="flex items-center text-white text-xs h-8 rounded-lg"
            style={{ transform: 'translateX(40px)' }}
          >
            {(() => {
              const draggedComponent = activeNode.layer.componentId ? getComponentById(activeNode.layer.componentId) : null;
              const layerIcon = getLayerIcon(activeNode.layer);
              const isActiveNodeSelected = selectedLayerIds.includes(activeNode.id) || selectedLayerId === activeNode.id;

              return (
                <>
                  {draggedComponent ? (
                    <ComponentIcon className="w-3 h-3 flex-shrink-0 mx-1.5 opacity-75" />
                  ) : layerIcon ? (
                    <Icon
                      name={layerIcon}
                      className={cn(
                        'size-3 mx-1.5 opacity-50',
                        isActiveNodeSelected && 'opacity-100',
                      )}
                    />
                  ) : (
                    <div className="size-3 bg-white/10 rounded mx-1.5" />
                  )}
                </>
              );
            })()}
            <span className="pointer-events-none">
              {getLayerName(activeNode.layer, {
                component_name: activeNode.layer.componentId ? getComponentById(activeNode.layer.componentId)?.name : null,
                collection_name: activeNodeCollectionName,
              })}
            </span>
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
  // Create a copy of all nodes - deep copy layer but clear children references
  // since we'll rebuild them from scratch
  const nodeCopy = flattenedNodes.map(n => ({
    ...n,
    layer: {
      ...n.layer,
      children: undefined // Clear children - we'll rebuild from byParent map
    }
  }));

  // Find the moved node and store its original parent
  const movedNode = nodeCopy.find(n => n.id === movedId);
  if (!movedNode) {
    console.error('❌ REBUILD ERROR: Moved node not found!');
    return [];
  }

  const originalParentId = movedNode.parentId;

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

    // Always set children based on byParent map, even if empty
    // This ensures old children references are removed
    if (childNodes.length > 0) {
      result.children = childNodes.map(child => buildNode(child.id));
    } else {
      // Explicitly remove children property if no children
      delete result.children;
    }

    return result;
  }

  // Build root level
  const rootNodes = byParent.get(null) || [];
  const result = rootNodes.map(node => buildNode(node.id));

  // Validate no duplicate IDs in the rebuilt tree
  if (process.env.NODE_ENV === 'development') {
    const allIds = new Set<string>();
    const duplicateInfo: Array<{ id: string; paths: string[] }> = [];

    function validateNoDuplicates(layers: Layer[], path: string = 'root'): void {
      layers.forEach((layer, idx) => {
        const currentPath = `${path}[${idx}]`;
        if (allIds.has(layer.id)) {
          let dupEntry = duplicateInfo.find(d => d.id === layer.id);
          if (!dupEntry) {
            dupEntry = { id: layer.id, paths: [] };
            duplicateInfo.push(dupEntry);
          }
          dupEntry.paths.push(currentPath);
        }
        allIds.add(layer.id);
        if (layer.children) {
          validateNoDuplicates(layer.children, `${currentPath}.children`);
        }
      });
    }

    validateNoDuplicates(result);

    if (duplicateInfo.length > 0) {
      console.error('❌ DUPLICATE IDs IN REBUILT TREE:');
      duplicateInfo.forEach(dup => {
        console.error(`  ID: ${dup.id} found at paths:`, dup.paths);
      });
      console.error('  movedId:', movedId);
      console.error('  newParentId:', newParentId);
      console.error('  originalParentId:', originalParentId);
    }
  }

  return result;
}
