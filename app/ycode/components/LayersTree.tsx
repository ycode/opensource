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
import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';

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
import { useCollaborationPresenceStore, getResourceLockKey, RESOURCE_TYPES } from '@/stores/useCollaborationPresenceStore';
import { useAuthStore } from '@/stores/useAuthStore';

// 6. Utils/lib
import { cn } from '@/lib/utils';
import { flattenTree, type FlattenedItem } from '@/lib/tree-utilities';
import { canHaveChildren, getLayerIcon, getLayerName, getCollectionVariable, canMoveLayer } from '@/lib/layer-utils';
import { hasStyleOverrides } from '@/lib/layer-style-utils';
import { getUserInitials, getDisplayName } from '@/lib/collaboration-utils';
import { getBreakpointPrefix } from '@/lib/breakpoint-utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { CollaboratorBadge } from '@/components/collaboration/CollaboratorBadge';

// 7. Types
import type { Layer, Breakpoint } from '@/types';
import type { UseLiveLayerUpdatesReturn } from '@/hooks/use-live-layer-updates';
import type { UseLiveComponentUpdatesReturn } from '@/hooks/use-live-component-updates';
import Icon from '@/components/ui/icon';

interface LayersTreeProps {
  layers: Layer[];
  selectedLayerId: string | null;
  selectedLayerIds?: string[]; // New multi-select support
  onLayerSelect: (layerId: string) => void;
  onReorder: (newLayers: Layer[]) => void;
  pageId: string;
  liveLayerUpdates?: UseLiveLayerUpdatesReturn | null;
  liveComponentUpdates?: UseLiveComponentUpdatesReturn | null;
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
  liveLayerUpdates?: UseLiveLayerUpdatesReturn | null;
  liveComponentUpdates?: UseLiveComponentUpdatesReturn | null;
  scrollToSelected?: boolean; // New: trigger scroll when selected
  activeBreakpoint: Breakpoint; // For breakpoint-aware icons and names
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
// Memoized to prevent unnecessary re-renders on hover state changes
const LayerRow = React.memo(function LayerRow({
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
  liveLayerUpdates,
  liveComponentUpdates,
  scrollToSelected,
  activeBreakpoint,
}: LayerRowProps) {
  const getStyleById = useLayerStylesStore((state) => state.getStyleById);
  const getComponentById = useComponentsStore((state) => state.getComponentById);
  const collections = useCollectionsStore((state) => state.collections);

  // Use selective subscriptions to avoid re-renders when unrelated state changes
  const editingComponentId = useEditorStore((state) => state.editingComponentId);
  const interactionTriggerLayerIds = useEditorStore((state) => state.interactionTriggerLayerIds);
  const interactionTargetLayerIds = useEditorStore((state) => state.interactionTargetLayerIds);
  const activeInteractionTriggerLayerId = useEditorStore((state) => state.activeInteractionTriggerLayerId);
  const activeInteractionTargetLayerIds = useEditorStore((state) => state.activeInteractionTargetLayerIds);
  const setHoveredLayerId = useEditorStore((state) => state.setHoveredLayerId);
  const { setNodeRef: setDropRef } = useDroppable({
    id: node.id,
  });

  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id: node.id,
  });

  // Ref for scrolling to this element
  const rowRef = React.useRef<HTMLDivElement>(null);

  // Combine refs for drag and drop
  const setRefs = (element: HTMLDivElement | null) => {
    setDragRef(element);
    setDropRef(element);
    rowRef.current = element;
  };

  // Auto-scroll to this row when it becomes selected (from canvas click)
  React.useEffect(() => {
    if (isSelected && scrollToSelected && rowRef.current) {
      rowRef.current.scrollIntoView({
        behavior: 'auto', // Instant jump for immediate feedback
        block: 'center', // Center in viewport to avoid sticky header
        inline: 'nearest',
      });
    }
  }, [isSelected, scrollToSelected]);

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

  // Use purple ONLY for component instances (not for all layers when editing a component)
  const usePurpleStyle = isComponentInstance;

  // Get icon name from blocks template system (breakpoint-aware)
  const layerIcon = getLayerIcon(node.layer, 'box', activeBreakpoint);

  // Check if layer is locked by another user (using unified resource locks)
  const currentUserId = useAuthStore((state) => state.user?.id);
  const lockKey = getResourceLockKey(RESOURCE_TYPES.LAYER, node.id);
  const lock = useCollaborationPresenceStore((state) => state.resourceLocks[lockKey]);
  // Access lock directly from state to avoid stale closure issues
  const lockOwnerUser = useCollaborationPresenceStore((state) => {
    const currentLock = state.resourceLocks[lockKey];
    return currentLock?.user_id ? state.users[currentLock.user_id] : null;
  });
  const isLockedByOther = !!(lock && lock.user_id !== currentUserId && Date.now() <= lock.expires_at);

  // Check if this is the Body layer (locked)
  const isLocked = node.layer.id === 'body';

  return (
    <LayerContextMenu
      layerId={node.id}
      pageId={pageId}
      isLocked={isLocked}
      onLayerSelect={onSelect}
      selectedLayerId={selectedLayerId}
      liveLayerUpdates={liveLayerUpdates}
      liveComponentUpdates={liveComponentUpdates}
      editingComponentId={editingComponentId}
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
            className={cn('absolute top-0 left-0 right-0 h-[1.5px] z-50 bg-primary')}
            style={{
              marginLeft: `${node.depth * 14 + 8}px`,
            }}
          >
            <div
              className="absolute -bottom-[3px] -left-[5.5px] size-2 rounded-full border-[1.5px] bg-neutral-950 border-primary"
            />
          </div>
        )}
        {isOver && dropPosition === 'below' && (
          <div
            className="absolute bottom-0 left-0 right-0 h-[1.5px] z-50 bg-primary"
            style={{
              marginLeft: `${node.depth * 14 + 8}px`,
            }}
          >
            <div
              className="absolute -bottom-[3px] -left-[5.5px] size-2 rounded-full border-[1.5px] bg-neutral-950 border-primary"
            />
          </div>
        )}
        {isOver && dropPosition === 'inside' && (
          <div
            className="absolute inset-0 border-[1.5px] rounded-lg z-40 pointer-events-none border-primary"
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
            'group relative flex items-center h-8 outline-none focus:outline-none',
            // Locked by another user - show as non-interactive
            isLockedByOther ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
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
            !isDragActive && !isDragging && !isLockedByOther && 'hover:bg-secondary/50',
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
            // Block click if layer is locked by another user
            if (isLockedByOther) {
              e.stopPropagation();
              e.preventDefault();
              return;
            }
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

          {/* Label (breakpoint-aware for layout layers) */}
          <span className="flex-grow text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none">
            {getLayerName(node.layer, {
              component_name: appliedComponent?.name,
              collection_name: finalCollectionName,
            }, activeBreakpoint)}
          </span>

          {/* Lock Indicator - show when layer is locked by another user */}
          {isLockedByOther && (
            <div className="mr-2 flex-shrink-0">
              <CollaboratorBadge
                collaborator={{
                  userId: lockOwnerUser?.user_id || '',
                  email: lockOwnerUser?.email,
                  color: lockOwnerUser?.color,
                }}
                size="xs"
                tooltipPrefix="Editing by"
              />
            </div>
          )}

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
});

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
          className="absolute top-0 left-0 right-0 h-[1.5px] z-50 ml-2 bg-primary"
        >
          <div
            className="absolute -bottom-[3px] -left-[5.5px] size-2 rounded-full border-[1.5px] bg-neutral-950 border-primary"
          />
        </div>
      )}
    </div>
  );
}

// Helper function to collect collapsed layer IDs from layer tree
function collectCollapsedIds(layers: Layer[]): Set<string> {
  const collapsed = new Set<string>();

  function traverse(layerList: Layer[]) {
    layerList.forEach(layer => {
      // If open is explicitly false, it's collapsed
      if (layer.open === false) {
        collapsed.add(layer.id);
      }
      if (layer.children) {
        traverse(layer.children);
      }
    });
  }

  traverse(layers);
  return collapsed;
}

// Helper function to update a layer's open state in the tree
function updateLayerOpenState(layers: Layer[], layerId: string, isOpen: boolean): Layer[] {
  return layers.map(layer => {
    if (layer.id === layerId) {
      return {
        ...layer,
        open: isOpen,
      };
    }
    if (layer.children) {
      return {
        ...layer,
        children: updateLayerOpenState(layer.children, layerId, isOpen),
      };
    }
    return layer;
  });
}

// Helper to find a layer's parent chain in the tree
function findParentChain(layers: Layer[], targetId: string, parentId: string | null = null): string[] | null {
  for (const layer of layers) {
    if (layer.id === targetId) {
      return parentId ? [parentId] : [];
    }

    if (layer.children) {
      const childResult = findParentChain(layer.children, targetId, layer.id);
      if (childResult !== null) {
        return parentId ? [parentId, ...childResult] : childResult;
      }
    }
  }

  return null;
}

// Helper to batch update multiple layers' open state
function setLayersOpen(layers: Layer[], idsToOpen: Set<string>): Layer[] {
  return layers.map(layer => {
    const shouldOpen = idsToOpen.has(layer.id);
    const hasChildren = layer.children && layer.children.length > 0;

    if (shouldOpen || hasChildren) {
      return {
        ...layer,
        ...(shouldOpen && { open: true }),
        ...(hasChildren && { children: setLayersOpen(layer.children!, idsToOpen) }),
      };
    }

    return layer;
  });
}

// Main LayersTree Component
export default function LayersTree({
  layers,
  selectedLayerId,
  selectedLayerIds: propSelectedLayerIds,
  onLayerSelect,
  onReorder,
  pageId,
  liveLayerUpdates,
  liveComponentUpdates,
}: LayersTreeProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | 'inside' | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => collectCollapsedIds(layers));
  const [cursorOffsetY, setCursorOffsetY] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [shouldScrollToSelected, setShouldScrollToSelected] = useState(false);

  // Pull multi-select state and breakpoint from editor store
  const { selectedLayerIds: storeSelectedLayerIds, lastSelectedLayerId, toggleSelection, selectRange, editingComponentId, activeBreakpoint } = useEditorStore();

  // Get component by ID function for drag overlay
  const { getComponentById } = useComponentsStore();

  // Get collections from store
  const { collections } = useCollectionsStore();

  // Use prop or store state (prop takes precedence for compatibility)
  const selectedLayerIds = propSelectedLayerIds ?? storeSelectedLayerIds;

  // Flatten the tree for rendering (sorted by CSS order on responsive breakpoints)
  const flattenedNodes = useMemo(
    () => {
      const flattened = flattenTree(layers, null, 0, collapsedIds, activeBreakpoint);

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
    [layers, collapsedIds, activeBreakpoint]
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

  // Sync collapsedIds state when layers change (from external updates)
  useEffect(() => {
    setCollapsedIds(collectCollapsedIds(layers));
  }, [layers]);

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

        // Persist the change to the layer tree
        const updatedLayers = updateLayerOpenState(layers, layerId, true);
        onReorder(updatedLayers);
      }
    };

    window.addEventListener('expandLayer', handleExpandLayer as EventListener);
    return () => window.removeEventListener('expandLayer', handleExpandLayer as EventListener);
  }, [collapsedIds, layers, onReorder]);

  // Listen for toggle collapse all layers event (Option + L shortcut)
  // When collapsed: shows body + first level elements expanded, but collapses their children (second level+)
  // When expanded: expands all layers
  useEffect(() => {
    const handleToggleCollapseAll = () => {
      // Collect IDs at different levels
      // First level = top-level layers in the tree (children of body)
      // Second level+ = children of first level elements and deeper
      const secondLevelAndDeeperIds: string[] = [];

      const collectChildIds = (children: Layer[]) => {
        for (const layer of children) {
          if (layer.children && layer.children.length > 0) {
            secondLevelAndDeeperIds.push(layer.id);
            collectChildIds(layer.children);
          }
        }
      };

      // For each first-level layer, collect its children (second level and deeper)
      for (const layer of layers) {
        if (layer.children && layer.children.length > 0) {
          // Collect children of this first-level layer (these are second level)
          collectChildIds(layer.children);
        }
      }

      // Check if any second-level+ layers are expanded
      const anySecondLevelExpanded = secondLevelAndDeeperIds.some(id => !collapsedIds.has(id));

      if (anySecondLevelExpanded || secondLevelAndDeeperIds.length === 0) {
        // Collapse: collapse second level and deeper (hide their children)
        // First level elements stay expanded, showing their direct children
        // But those children (second level) are collapsed
        const idsToCollapse = new Set(secondLevelAndDeeperIds);
        setCollapsedIds(idsToCollapse);
        // Persist to layer tree
        let updatedLayers = layers;
        // Keep first level expanded
        for (const layer of layers) {
          if (layer.children && layer.children.length > 0) {
            updatedLayers = updateLayerOpenState(updatedLayers, layer.id, true);
          }
        }
        // Collapse second level and deeper
        for (const id of secondLevelAndDeeperIds) {
          updatedLayers = updateLayerOpenState(updatedLayers, id, false);
        }
        onReorder(updatedLayers);
      } else {
        // Expand all
        setCollapsedIds(new Set());
        // Persist to layer tree - expand everything
        const collectAllIdsWithChildren = (layerList: Layer[]): string[] => {
          const ids: string[] = [];
          for (const layer of layerList) {
            if (layer.children && layer.children.length > 0) {
              ids.push(layer.id);
              ids.push(...collectAllIdsWithChildren(layer.children));
            }
          }
          return ids;
        };
        const allIds = collectAllIdsWithChildren(layers);
        let updatedLayers = layers;
        for (const id of allIds) {
          updatedLayers = updateLayerOpenState(updatedLayers, id, true);
        }
        onReorder(updatedLayers);
      }
    };

    window.addEventListener('toggleCollapseAllLayers', handleToggleCollapseAll);
    return () => window.removeEventListener('toggleCollapseAllLayers', handleToggleCollapseAll);
  }, [collapsedIds, layers, onReorder]);

  // Track previous selectedLayerId to only run when it actually changes
  const prevSelectedLayerIdRef = useRef<string | null>(null);

  // Auto-expand parents when layer is selected (e.g., from canvas click)
  useEffect(() => {
    // Only run if selectedLayerId actually changed
    if (!selectedLayerId || prevSelectedLayerIdRef.current === selectedLayerId) {
      prevSelectedLayerIdRef.current = selectedLayerId;
      return;
    }

    prevSelectedLayerIdRef.current = selectedLayerId;

    // Check if layer is already visible
    const isVisible = flattenedNodes.some(n => n.id === selectedLayerId);
    if (isVisible) {
      // Already visible - just trigger scroll
      setShouldScrollToSelected(true);
      return;
    }

    // Find which parents need to be expanded
    const parentChain = findParentChain(layers, selectedLayerId);
    if (!parentChain) return;

    const parentsToExpand = parentChain.filter(id => collapsedIds.has(id));
    if (parentsToExpand.length === 0) return;

    // Expand all collapsed parents in one pass
    const updatedLayers = setLayersOpen(layers, new Set(parentsToExpand));
    onReorder(updatedLayers);

    // Trigger scroll after expansion (will happen after re-render)
    setShouldScrollToSelected(true);
  }, [selectedLayerId, flattenedNodes, collapsedIds, layers, onReorder]);

  // Reset scroll trigger after it's been applied
  useEffect(() => {
    if (shouldScrollToSelected) {
      // Reset after a short delay to allow the scroll to complete
      const timeout = setTimeout(() => setShouldScrollToSelected(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [shouldScrollToSelected]);

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

      // Check if this is a within-parent reorder on a non-desktop breakpoint
      // If so, use CSS order classes instead of changing DOM structure
      const isWithinParentReorder = activeNode.parentId === newParentId;
      const isResponsiveBreakpoint = activeBreakpoint !== 'desktop';

      let newLayers: Layer[];

      if (isWithinParentReorder && isResponsiveBreakpoint) {
        // Apply CSS order classes for responsive visual reordering
        // This keeps DOM structure intact but changes visual order on this breakpoint
        newLayers = applyResponsiveOrderClasses(
          layers,
          newParentId!,
          activeNode.id,
          newOrder,
          activeBreakpoint as 'tablet' | 'mobile'
        );
      } else {
        // Standard DOM structure change (affects all breakpoints)
        newLayers = rebuildTree(flattenedNodes, activeNode.id, newParentId, newOrder);
      }

      onReorder(newLayers);
      setActiveId(null);
      setOverId(null);
      setDropPosition(null);
      setCursorOffsetY(0);

      // Use setTimeout to reset processing flag after state updates complete
      setTimeout(() => setIsProcessing(false), 0);
    },
    [flattenedNodes, dropPosition, onReorder, layers, activeBreakpoint]
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
    // Determine the new state
    const isCurrentlyCollapsed = collapsedIds.has(id);
    const willBeOpen = isCurrentlyCollapsed; // If collapsed, will open; if open, will collapse

    // Update local state
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlyCollapsed) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    // Persist the change to the layer tree (outside of setState)
    const updatedLayers = updateLayerOpenState(layers, id, willBeOpen);
    onReorder(updatedLayers);
  }, [layers, onReorder, collapsedIds]);

  // Handle layer selection
  const handleSelect = useCallback(
    (id: string) => {
      onLayerSelect(id);
    },
    [onLayerSelect]
  );

  // Pre-compute selection-related data for all nodes (avoids expensive calculations in render loop)
  const nodeSelectionData = useMemo(() => {
    const selectedIdsSet = new Set(selectedLayerIds);
    if (selectedLayerId) selectedIdsSet.add(selectedLayerId);

    // Build a parent lookup map for O(1) access
    const nodeById = new Map<string, FlattenedItem>();
    flattenedNodes.forEach(node => nodeById.set(node.id, node));

    // For each node, compute: isChildOfSelected, parentSelectedId
    const childOfSelectedMap = new Map<string, string | null>(); // nodeId -> parentSelectedId

    flattenedNodes.forEach(node => {
      if (selectedIdsSet.has(node.id)) {
        childOfSelectedMap.set(node.id, null); // Selected nodes are not "child of selected"
        return;
      }

      // Walk up parent chain to see if any ancestor is selected
      let current: FlattenedItem | undefined = node;
      while (current && current.parentId) {
        if (selectedIdsSet.has(current.parentId)) {
          childOfSelectedMap.set(node.id, current.parentId);
          return;
        }
        current = nodeById.get(current.parentId);
      }
      childOfSelectedMap.set(node.id, null);
    });

    // Find last visible descendants for each selected parent
    const lastDescendantMap = new Map<string, string>(); // parentSelectedId -> lastDescendantId

    selectedIdsSet.forEach(selectedId => {
      // Find all descendants of this selected node
      const descendants: string[] = [];
      flattenedNodes.forEach(node => {
        if (childOfSelectedMap.get(node.id) === selectedId) {
          descendants.push(node.id);
        }
      });
      if (descendants.length > 0) {
        lastDescendantMap.set(selectedId, descendants[descendants.length - 1]);
      }
    });

    // Build final map for each node
    const result = new Map<string, {
      isSelected: boolean;
      isChildOfSelected: boolean;
      isLastVisibleDescendant: boolean;
      hasVisibleChildren: boolean;
    }>();

    flattenedNodes.forEach(node => {
      const parentSelectedId = childOfSelectedMap.get(node.id) ?? null;
      const isChildOfSelected = parentSelectedId !== null;
      const isLastVisibleDescendant = parentSelectedId !== null &&
        lastDescendantMap.get(parentSelectedId!) === node.id;
      const hasVisibleChildren = !!(node.layer.children &&
        node.layer.children.length > 0 &&
        !collapsedIds.has(node.id));

      result.set(node.id, {
        isSelected: selectedIdsSet.has(node.id),
        isChildOfSelected,
        isLastVisibleDescendant,
        hasVisibleChildren,
      });
    });

    return result;
  }, [flattenedNodes, selectedLayerIds, selectedLayerId, collapsedIds]);

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
        {flattenedNodes.map((node) => {
          const selectionData = nodeSelectionData.get(node.id)!;

          return (
            <LayerRow
              key={node.id}
              node={node}
              isSelected={selectionData.isSelected}
              isChildOfSelected={selectionData.isChildOfSelected}
              isLastVisibleDescendant={selectionData.isLastVisibleDescendant}
              hasVisibleChildren={selectionData.hasVisibleChildren}
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
              liveLayerUpdates={liveLayerUpdates}
              liveComponentUpdates={liveComponentUpdates}
              scrollToSelected={shouldScrollToSelected}
              activeBreakpoint={activeBreakpoint}
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
              const layerIcon = getLayerIcon(activeNode.layer, 'box', activeBreakpoint);
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
              }, activeBreakpoint)}
            </span>
          </div>
        ) : null}
      </DragOverlay>
      <div className="min-h-10" />
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
  // Create a map of original layers to preserve all properties
  const originalLayerMap = new Map<string, Layer>();

  function collectLayers(layers: Layer[]) {
    layers.forEach(layer => {
      originalLayerMap.set(layer.id, layer);
      if (layer.children) {
        collectLayers(layer.children);
      }
    });
  }

  // Collect all layers from the flattened nodes
  flattenedNodes.forEach(node => {
    if (!originalLayerMap.has(node.id)) {
      collectLayers([node.layer]);
    }
  });

  // Create set of all visible node IDs (nodes that appear in flattened tree)
  const visibleNodeIds = new Set(flattenedNodes.map(n => n.id));

  // Create working copy of nodes with updated parent/index
  const nodeCopy = flattenedNodes.map(n => ({
    ...n,
    layer: originalLayerMap.get(n.id)! // Use original layer to preserve all properties
  }));

  // Find the moved node
  const movedNode = nodeCopy.find(n => n.id === movedId);
  if (!movedNode) {
    console.error('❌ REBUILD ERROR: Moved node not found!');
    return [];
  }

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

  // Build tree recursively, preserving properties but rebuilding structure
  // First, create a Set of all layer IDs in the visible tree (to detect moved layers)
  const allVisibleLayerIds = new Set(nodeCopy.map(n => n.id));

  function buildNode(nodeId: string): Layer {
    const node = nodeCopy.find(n => n.id === nodeId);
    const originalLayer = originalLayerMap.get(nodeId);

    if (!originalLayer) {
      console.error('❌ REBUILD ERROR: Original layer not found:', nodeId);
      return { id: nodeId, name: 'div', classes: '' };
    }

    // Get children from byParent (for visible nodes) OR from original layer (for collapsed)
    const childrenFromByParent = byParent.get(nodeId) || [];
    const originalChildren = originalLayer.children || [];

    // Preserve all layer properties EXCEPT children
    const { children: _, ...layerWithoutChildren } = originalLayer;
    const result: Layer = { ...layerWithoutChildren };

    // Decision: rebuild children OR preserve original?
    // - If this node is in the visible tree, rebuild from byParent
    // - If this node is NOT visible (hidden/collapsed), preserve original children
    const isNodeVisible = visibleNodeIds.has(nodeId);
    const isCollapsed = originalLayer.open === false;

    if (isNodeVisible) {
      // Node is visible - rebuild children from byParent to reflect the drag operation
      if (childrenFromByParent.length > 0) {
        // Build new/moved children from byParent
        const newChildren = childrenFromByParent.map(child => buildNode(child.id));

        if (isCollapsed && originalChildren.length > 0) {
          // Layer is collapsed - merge new children with original hidden children
          // IMPORTANT: Exclude children that were moved to other visible locations
          const newChildIds = new Set(childrenFromByParent.map(c => c.id));
          const preservedChildren = originalChildren.filter(c =>
            !newChildIds.has(c.id) && !allVisibleLayerIds.has(c.id)
          );
          result.children = [...newChildren, ...preservedChildren];
        } else {
          // Layer is expanded - use only byParent children (complete visible tree)
          result.children = newChildren;
        }
      } else {
        // No children in byParent - check if original had children
        // If original had children, they must be collapsed, so preserve them
        // But exclude any that appear in the visible tree (they were moved out)
        if (originalChildren.length > 0) {
          const preservedChildren = originalChildren.filter(c => !allVisibleLayerIds.has(c.id));
          if (preservedChildren.length > 0) {
            result.children = preservedChildren;
          }
        }
        // else: truly no children, don't set children property
      }
    } else {
      // Node is not visible (inside collapsed parent) - preserve original children completely
      if (originalChildren.length > 0) {
        result.children = originalChildren;
      }
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
    }
  }

  return result;
}

/**
 * Apply CSS order classes to reorder children visually for a specific breakpoint.
 * Instead of changing DOM structure, this applies order-{n} classes with breakpoint prefixes.
 *
 * @param layers - The full layer tree
 * @param parentId - The parent whose children should be reordered
 * @param movedChildId - The child that was moved
 * @param newIndex - The new visual index for the moved child
 * @param breakpoint - The active breakpoint (tablet or mobile)
 * @returns Updated layer tree with order classes applied
 */
function applyResponsiveOrderClasses(
  layers: Layer[],
  parentId: string,
  movedChildId: string,
  newIndex: number,
  breakpoint: 'tablet' | 'mobile'
): Layer[] {
  const prefix = getBreakpointPrefix(breakpoint); // max-lg: or max-md:

  // Helper to normalize classes to string
  const normalizeClasses = (classes: string | string[] | undefined): string => {
    if (!classes) return '';
    return Array.isArray(classes) ? classes.join(' ') : classes;
  };

  // Helper to remove existing order classes for this breakpoint
  const removeOrderClasses = (classes: string): string => {
    return classes
      .split(' ')
      .filter(cls => {
        // Remove order classes for this breakpoint
        if (prefix && cls.startsWith(prefix)) {
          const baseClass = cls.slice(prefix.length);
          return !baseClass.startsWith('order-');
        }
        // For desktop (no prefix), we don't touch those
        return true;
      })
      .join(' ');
  };

  // Helper to add order class
  const addOrderClass = (classes: string | string[] | undefined, order: number): string => {
    const normalized = normalizeClasses(classes);
    const cleaned = removeOrderClasses(normalized);
    const orderClass = `${prefix}order-${order}`;
    return cleaned ? `${cleaned} ${orderClass}` : orderClass;
  };

  // Recursively process the tree
  function processLayers(layerList: Layer[]): Layer[] {
    return layerList.map(layer => {
      if (layer.id === parentId && layer.children) {
        // Found the parent - reorder its children with order classes
        const children = [...layer.children];

        // Find the moved child's current index
        const currentIndex = children.findIndex(c => c.id === movedChildId);
        if (currentIndex === -1) {
          // Child not found, return as is
          return layer;
        }

        // Calculate new order values
        // We need to assign order values so the moved child appears at newIndex
        const updatedChildren = children.map((child, idx) => {
          let visualOrder: number;

          if (child.id === movedChildId) {
            // The moved child gets the target position
            visualOrder = newIndex;
          } else if (idx < currentIndex && idx >= newIndex) {
            // Children that need to shift right (moved child went before them)
            visualOrder = idx + 1;
          } else if (idx > currentIndex && idx <= newIndex) {
            // Children that need to shift left (moved child went after them)
            visualOrder = idx - 1;
          } else {
            // Children not affected by the move
            visualOrder = idx;
          }

          return {
            ...child,
            classes: addOrderClass(child.classes, visualOrder),
            children: child.children ? processLayers(child.children) : undefined,
          };
        });

        return {
          ...layer,
          children: updatedChildren,
        };
      }

      // Not the parent, but process children recursively
      if (layer.children) {
        return {
          ...layer,
          children: processLayers(layer.children),
        };
      }

      return layer;
    });
  }

  return processLayers(layers);
}
