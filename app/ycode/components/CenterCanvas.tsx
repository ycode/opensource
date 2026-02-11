'use client';

/**
 * Center Canvas - Preview Area with Canvas
 *
 * Shows live preview of the website being built.
 *
 * - Editor mode: Uses Canvas (React) with iframe for style isolation
 * - Preview mode: Uses iframe loading the actual SSR-rendered page
 *
 * @see ./Canvas.tsx for the editor canvas implementation
 */

// 1. React/Next.js
import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';

// 2. External libraries
import { ArrowLeft } from 'lucide-react';

// 3. ShadCN UI
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

// 4. Hooks
import { useEditorUrl } from '@/hooks/use-editor-url';
import { useZoom } from '@/hooks/use-zoom';
import { useUndoRedo } from '@/hooks/use-undo-redo';

// 5. Stores
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useCollectionLayerStore } from '@/stores/useCollectionLayerStore';
import { useLocalisationStore } from '@/stores/useLocalisationStore';
import { useAssetsStore } from '@/stores/useAssetsStore';
import { useCanvasTextEditorStore } from '@/stores/useCanvasTextEditorStore';

// 4b. Internal components
import Canvas from './Canvas';
import { CollectionFieldSelector } from './CollectionFieldSelector';
import SelectionOverlay from '@/components/SelectionOverlay';
import RichTextLinkPopover from './RichTextLinkPopover';

// 6. Utils
import { buildPageTree, getNodeIcon, buildLocalizedSlugPath, buildLocalizedDynamicPageUrl } from '@/lib/page-utils';
import { getTranslationValue } from '@/lib/localisation-utils';
import type { PageTreeNode } from '@/lib/page-utils';
import { cn } from '@/lib/utils';
import { getCollectionVariable, canDeleteLayer, findLayerById, findParentCollectionLayer, findAllParentCollectionLayers, canLayerHaveLink } from '@/lib/layer-utils';
import { CANVAS_BORDER, CANVAS_PADDING } from '@/lib/canvas-utils';
import { buildFieldGroups, hasFieldsMatching, flattenFieldGroups, DISPLAYABLE_FIELD_TYPES } from '@/lib/collection-field-utils';
import { DropContainerIndicator, DropLineIndicator } from '@/components/DropIndicators';
import { DragCaptureOverlay } from '@/components/DragCaptureOverlay';
import { setDragCursor, clearDragCursor } from '@/lib/drag-cursor';

// 7. Types
import type { Layer, Page, PageFolder, CollectionField, Asset } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type ViewportMode = 'desktop' | 'tablet' | 'mobile';

import type { UseLiveLayerUpdatesReturn } from '@/hooks/use-live-layer-updates';
import type { UseLiveComponentUpdatesReturn } from '@/hooks/use-live-component-updates';
import { useCanvasDropDetection } from '@/hooks/use-canvas-drop-detection';
import { useCanvasSiblingReorder } from '@/hooks/use-canvas-sibling-reorder';

interface CenterCanvasProps {
  selectedLayerId: string | null;
  currentPageId: string | null;
  viewportMode: ViewportMode;
  setViewportMode: (mode: ViewportMode) => void;
  onLayerSelect?: (layerId: string) => void;
  onLayerDeselect?: () => void;
  onExitComponentEditMode?: () => void;
  liveLayerUpdates?: UseLiveLayerUpdatesReturn | null;
  liveComponentUpdates?: UseLiveComponentUpdatesReturn | null;
}

const viewportSizes: Record<ViewportMode, { width: string; label: string; icon: string }> = {
  desktop: { width: '1366px', label: 'Desktop', icon: '🖥️' },
  tablet: { width: '768px', label: 'Tablet', icon: '📱' },
  mobile: { width: '375px', label: 'Mobile', icon: '📱' },
};

// Import the drop target type from the store
import type { CanvasDropTarget } from '@/stores/useEditorStore';

/**
 * Canvas Drop Indicator Overlay
 *
 * Subscribes to store directly to avoid re-rendering the parent CenterCanvas component.
 * Renders drop indicators inside the scaled canvas div during drag-and-drop.
 */
interface CanvasDropIndicatorOverlayProps {
  iframeElement: HTMLIFrameElement | null;
}

function CanvasDropIndicatorOverlay({
  iframeElement,
}: CanvasDropIndicatorOverlayProps) {
  // Subscribe to store directly - only this component re-renders on changes
  const isDraggingToCanvas = useEditorStore((state) => state.isDraggingToCanvas);
  const dropTarget = useEditorStore((state) => state.canvasDropTarget);

  if (!isDraggingToCanvas || !dropTarget || !iframeElement) return null;

  // Use display name from drop target (already computed during hit-testing)
  const displayName = dropTarget.targetDisplayName || '';

  // Find element in iframe and calculate position
  const iframeDoc = iframeElement.contentDocument;
  if (!iframeDoc) return null;

  const targetElement = iframeDoc.querySelector(`[data-layer-id="${dropTarget.layerId}"]`) as HTMLElement;
  if (!targetElement) return null;

  // Get element rect in iframe's internal coordinate system
  const elementRect = targetElement.getBoundingClientRect();

  const top = elementRect.top;
  const left = elementRect.left;
  const width = elementRect.width;
  const height = elementRect.height;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-50">
      <div
        style={{
          position: 'absolute',
          // Use transform for GPU-accelerated positioning
          transform: `translate(${left}px, ${top}px)`,
          width: `${width}px`,
          height: `${height}px`,
          // Hint to browser for GPU layer promotion
          willChange: 'transform',
          // Ensure it's on its own compositing layer
          contain: 'layout style',
        }}
      >
        {dropTarget.position === 'inside' ? (
          <DropContainerIndicator
            label={`Add in ${displayName}`}
            variant="dashed"
          />
        ) : (
          <DropLineIndicator position={dropTarget.position} />
        )}
      </div>
    </div>
  );
}

/**
 * Canvas Sibling Reorder Effect
 *
 * Applies CSS transforms to siblings in the iframe during drag to show
 * a real-time preview of the reordered layout. Also makes the dragged
 * element semi-transparent.
 *
 * This is implemented as an effect-only component (no visible render)
 * because we're manipulating iframe DOM directly for performance.
 */
interface CanvasSiblingReorderOverlayProps {
  iframeElement: HTMLIFrameElement | null;
}

function CanvasSiblingReorderOverlay({
  iframeElement,
}: CanvasSiblingReorderOverlayProps) {
  // Subscribe to store for drag state
  const isDragging = useEditorStore((state) => state.isDraggingLayerOnCanvas);
  const draggedId = useEditorStore((state) => state.draggedLayerId);
  const parentId = useEditorStore((state) => state.draggedLayerParentId);
  const originalIndex = useEditorStore((state) => state.draggedLayerOriginalIndex);
  const siblingIds = useEditorStore((state) => state.siblingLayerIds);
  const dropTarget = useEditorStore((state) => state.canvasSiblingDropTarget);

  const projectedIndex = dropTarget?.projectedIndex ?? null;

  // State for visual indicator positions
  const [parentRect, setParentRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [dropLineY, setDropLineY] = useState<number | null>(null);
  const [dropzoneHeight, setDropzoneHeight] = useState<number>(0);
  const [dropzoneWidth, setDropzoneWidth] = useState<number>(0);
  const [dropzoneLeft, setDropzoneLeft] = useState<number>(0);

  // Cache element references and heights to avoid repeated DOM queries
  const cachedDataRef = useRef<{
    elements: Map<string, HTMLElement>;
    heights: Map<string, number>;
    tops: Map<string, number>;
    draggedHeight: number;
    draggedWidth: number;
    draggedLeft: number;
    parentElement: HTMLElement | null;
  } | null>(null);

  // Track previous projected index to avoid unnecessary updates
  const prevProjectedIndexRef = useRef<number | null>(null);

  // Store siblingIds in a ref for cleanup (since store clears them before cleanup runs)
  const siblingIdsRef = useRef<string[]>([]);

  // Change cursor to "grabbing" when dragging
  useEffect(() => {
    if (!isDragging) return;

    const iframeDoc = iframeElement?.contentDocument;
    // Pass both iframe document and iframe element for comprehensive cursor setting
    setDragCursor(iframeDoc, iframeElement);

    return () => {
      clearDragCursor(iframeDoc);
    };
  }, [isDragging, iframeElement]);

  // Cache elements and heights when drag starts
  useEffect(() => {
    if (!iframeElement) return;

    const iframeDoc = iframeElement.contentDocument;
    if (!iframeDoc) return;

    if (isDragging && draggedId && siblingIds.length > 0) {
      // Store siblingIds in ref for cleanup (before store clears them)
      siblingIdsRef.current = [...siblingIds];

      // Build cache on drag start
      const elements = new Map<string, HTMLElement>();
      const heights = new Map<string, number>();
      const tops = new Map<string, number>();
      let draggedHeight = 0;
      let draggedWidth = 0;
      let draggedLeft = 0;

      siblingIds.forEach(id => {
        const el = iframeDoc.querySelector(`[data-layer-id="${id}"]`) as HTMLElement;
        if (el) {
          elements.set(id, el);
          const rect = el.getBoundingClientRect();
          heights.set(id, rect.height);
          tops.set(id, rect.top);
          if (id === draggedId) {
            draggedHeight = rect.height;
            draggedWidth = rect.width;
            draggedLeft = rect.left;
          }
        }
      });

      // Find and cache parent element
      let parentElement: HTMLElement | null = null;
      if (parentId) {
        parentElement = iframeDoc.querySelector(`[data-layer-id="${parentId}"]`) as HTMLElement;
      }

      cachedDataRef.current = { elements, heights, tops, draggedHeight, draggedWidth, draggedLeft, parentElement };
      prevProjectedIndexRef.current = null;

      // Set dropzone dimensions to match dragged element
      setDropzoneHeight(draggedHeight);
      setDropzoneWidth(draggedWidth);
      setDropzoneLeft(draggedLeft);

      // Set initial parent rect
      if (parentElement) {
        const rect = parentElement.getBoundingClientRect();
        setParentRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      }
    } else {
      // Clear cache and visual state when drag ends
      cachedDataRef.current = null;
      prevProjectedIndexRef.current = null;
      setParentRect(null);
      setDropLineY(null);
      setDropzoneHeight(0);
      setDropzoneWidth(0);
      setDropzoneLeft(0);
    }
  }, [iframeElement, isDragging, draggedId, parentId, siblingIds]);

  // Update dropzone box position and shift siblings when projectedIndex changes
  useEffect(() => {
    const cache = cachedDataRef.current;
    if (!cache || !isDragging || originalIndex === null) {
      return;
    }

    // For free-drag behavior: if projectedIndex is null during active drag,
    // keep the last valid projected index (preserve visual state)
    if (projectedIndex === null && prevProjectedIndexRef.current !== null) {
      // Still dragging but cursor moved outside valid positions - keep current visual state
      return;
    }

    const currentProjectedIndex = projectedIndex ?? originalIndex;

    // Skip if projected index hasn't changed
    if (currentProjectedIndex === prevProjectedIndexRef.current) {
      return;
    }

    // Check if this is the FIRST positioning (no previous index)
    // On first positioning, skip transition to avoid "jump" animation
    const isFirstPositioning = prevProjectedIndexRef.current === null;
    prevProjectedIndexRef.current = currentProjectedIndex;

    const { elements, heights, tops, draggedHeight } = cache;

    // Calculate dropzone Y position (where the blue box should appear)
    // The dropzone ALWAYS shows - at original position when first dragging,
    // then moves as you drag to different positions
    let lineY: number | null = null;

    if (currentProjectedIndex === originalIndex) {
      // Dropzone at original position (element "picked up", its spot is available)
      const draggedId = siblingIds[originalIndex];
      const draggedTop = tops.get(draggedId);
      if (draggedTop !== undefined) {
        lineY = draggedTop;
      }
    } else {
      const isDraggingDown = currentProjectedIndex > originalIndex;

      if (isDraggingDown) {
        // When dragging down, elements have shifted UP
        // The dropzone appears after the last shifted-up element
        if (currentProjectedIndex < siblingIds.length) {
          const targetId = siblingIds[currentProjectedIndex];
          const targetTop = tops.get(targetId);
          const targetHeight = heights.get(targetId);
          if (targetTop !== undefined && targetHeight !== undefined) {
            // Position at bottom of the target element, minus its shift
            lineY = targetTop + targetHeight - draggedHeight;
          }
        } else {
          // Dropping at the end
          const lastId = siblingIds[siblingIds.length - 1];
          const lastTop = tops.get(lastId);
          const lastHeight = heights.get(lastId);
          if (lastTop !== undefined && lastHeight !== undefined) {
            lineY = lastTop + lastHeight - draggedHeight;
          }
        }
      } else {
        // When dragging up, dropzone appears at the target position
        if (currentProjectedIndex < siblingIds.length) {
          const targetId = siblingIds[currentProjectedIndex];
          const targetTop = tops.get(targetId);
          if (targetTop !== undefined) {
            lineY = targetTop;
          }
        }
      }
    }
    setDropLineY(lineY);

    // Apply transforms to shift siblings and make space for dropzone
    siblingIds.forEach((layerId, index) => {
      const el = elements.get(layerId);
      if (!el) return;

      // The dragged element itself - hide it completely
      // Its position becomes the dropzone (element is "picked up")
      if (layerId === draggedId) {
        el.style.opacity = '0';
        // Only animate opacity after first frame to avoid initial "pop"
        el.style.transition = isFirstPositioning ? 'none' : 'opacity 100ms ease-out';
        return;
      }

      // Calculate shift amount based on direction of movement
      let shiftAmount = 0;

      if (currentProjectedIndex !== originalIndex) {
        const isDraggingDown = currentProjectedIndex > originalIndex;

        if (isDraggingDown) {
          // Dragging DOWN: elements between original and projected shift UP to fill gap
          // Elements at projected and after shift DOWN for dropzone (dropzone height = dragged element height)
          if (index > originalIndex && index <= currentProjectedIndex) {
            // These elements shift UP to fill the gap left by dragged element
            shiftAmount = -draggedHeight;
          }
          if (index > currentProjectedIndex) {
            // These elements shift DOWN for the dropzone
            // Since dropzone height = draggedHeight, net shift is 0
            shiftAmount = 0;
          }
        } else {
          // Dragging UP: elements between projected and original shift DOWN
          if (index >= currentProjectedIndex && index < originalIndex) {
            // These elements shift DOWN to make room for dropzone (dropzone height = dragged element height)
            shiftAmount = draggedHeight;
          }
        }
      }

      // Only animate after first frame to avoid initial "jump"
      el.style.transition = isFirstPositioning ? 'none' : 'transform 150ms ease-out';
      el.style.willChange = 'transform';
      el.style.transform = shiftAmount !== 0 ? `translate3d(0, ${shiftAmount}px, 0)` : '';
    });
  }, [isDragging, draggedId, originalIndex, siblingIds, projectedIndex]);

  // Cleanup effect - reset styles when drag ends with smooth animation
  // Uses siblingIdsRef because store clears siblingIds before this effect runs
  useEffect(() => {
    if (!iframeElement) return;

    const iframeDoc = iframeElement.contentDocument;
    if (!iframeDoc) return;

    // Only clean up when drag ends - use ref since store already cleared siblingIds
    if (!isDragging && siblingIdsRef.current.length > 0) {
      // Remove transforms INSTANTLY (no transition) to prevent "jump" on drop
      // The DOM reorder changes element positions, so animating transforms causes glitches
      siblingIdsRef.current.forEach(id => {
        const el = iframeDoc.querySelector(`[data-layer-id="${id}"]`) as HTMLElement;
        if (el) {
          el.style.transition = 'none';
          el.style.opacity = '1';
          el.style.transform = '';
          el.style.willChange = '';
        }
      });

      // Clear the ref after cleanup
      siblingIdsRef.current = [];
    }
  }, [iframeElement, isDragging]);

  // Don't render anything if not dragging
  if (!isDragging || !parentRect) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-50">
      {/* Blue dropzone box - shows where element will be inserted */}
      {dropLineY !== null && dropzoneHeight > 0 && dropzoneWidth > 0 && (
        <div
          className="animate-in fade-in duration-100"
          style={{
            position: 'absolute',
            transform: `translate(${dropzoneLeft}px, ${dropLineY}px)`,
            width: `${dropzoneWidth}px`,
            height: `${dropzoneHeight}px`,
            willChange: 'transform',
            transition: 'transform 150ms ease-out',
          }}
        >
          <div className="absolute inset-0 bg-blue-100 rounded-sm border border-blue-300 border-dashed" />
        </div>
      )}
    </div>
  );

  // This component doesn't render anything visible - it only applies effects
  return null;
}

const CenterCanvas = React.memo(function CenterCanvas({
  selectedLayerId,
  currentPageId,
  viewportMode,
  setViewportMode,
  onLayerSelect,
  onLayerDeselect,
  onExitComponentEditMode,
  liveLayerUpdates,
  liveComponentUpdates,
}: CenterCanvasProps) {
  const [showAddBlockPanel, setShowAddBlockPanel] = useState(false);
  const [pagePopoverOpen, setPagePopoverOpen] = useState(false);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // State for iframe element (for SelectionOverlay)
  const [canvasIframeElement, setCanvasIframeElement] = useState<HTMLIFrameElement | null>(null);

  // Track iframe content height from iframe reports
  const [reportedContentHeight, setReportedContentHeight] = useState(0);

  // Track container height for dynamic alignment
  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Store initial canvas height and zoom on load - this sets the iframe height once
  const initialCanvasHeightRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number | null>(null);
  const [initialZoomSet, setInitialZoomSet] = useState(false);

  // Optimize store subscriptions - use selective selectors
  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);
  const addLayerFromTemplate = usePagesStore((state) => state.addLayerFromTemplate);
  const updateLayer = usePagesStore((state) => state.updateLayer);
  const deleteLayer = usePagesStore((state) => state.deleteLayer);
  const deleteLayers = usePagesStore((state) => state.deleteLayers);
  const setDraftLayers = usePagesStore((state) => state.setDraftLayers);
  const pages = usePagesStore((state) => state.pages);
  const folders = usePagesStore((state) => state.folders);

  const setSelectedLayerId = useEditorStore((state) => state.setSelectedLayerId);
  const selectedLayerIds = useEditorStore((state) => state.selectedLayerIds);
  const getReturnDestination = useEditorStore((state) => state.getReturnDestination);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const setActiveSidebarTab = useEditorStore((state) => state.setActiveSidebarTab);
  const setActiveTextStyleKey = useEditorStore((state) => state.setActiveTextStyleKey);

  const selectedLocaleId = useLocalisationStore((state) => state.selectedLocaleId);
  const getSelectedLocale = useLocalisationStore((state) => state.getSelectedLocale);
  const translations = useLocalisationStore((state) => state.translations);
  const activeUIState = useEditorStore((state) => state.activeUIState);
  const editingComponentId = useEditorStore((state) => state.editingComponentId);
  const setCurrentPageId = useEditorStore((state) => state.setCurrentPageId);
  const returnToPageId = useEditorStore((state) => state.returnToPageId);
  const currentPageCollectionItemId = useEditorStore((state) => state.currentPageCollectionItemId);
  const setCurrentPageCollectionItemId = useEditorStore((state) => state.setCurrentPageCollectionItemId);
  const hoveredLayerId = useEditorStore((state) => state.hoveredLayerId);
  const setHoveredLayerId = useEditorStore((state) => state.setHoveredLayerId);
  const isPreviewMode = useEditorStore((state) => state.isPreviewMode);
  const activeInteractionTriggerLayerId = useEditorStore((state) => state.activeInteractionTriggerLayerId);
  const assets = useAssetsStore((state) => state.assets);

  // Note: Canvas drag-and-drop state is handled by useCanvasDropDetection hook
  // and CanvasDropIndicatorOverlay component (they subscribe to store directly)

  // Text editor toolbar state from store
  const isTextEditing = useCanvasTextEditorStore((state) => state.isEditing);
  const editingLayerId = useCanvasTextEditorStore((state) => state.editingLayerId);
  const textEditorActiveMarks = useCanvasTextEditorStore((state) => state.activeMarks);
  const toggleBold = useCanvasTextEditorStore((state) => state.toggleBold);
  const toggleItalic = useCanvasTextEditorStore((state) => state.toggleItalic);
  const toggleUnderline = useCanvasTextEditorStore((state) => state.toggleUnderline);
  const toggleStrike = useCanvasTextEditorStore((state) => state.toggleStrike);
  const toggleSubscript = useCanvasTextEditorStore((state) => state.toggleSubscript);
  const toggleSuperscript = useCanvasTextEditorStore((state) => state.toggleSuperscript);
  const toggleBulletList = useCanvasTextEditorStore((state) => state.toggleBulletList);
  const toggleOrderedList = useCanvasTextEditorStore((state) => state.toggleOrderedList);
  const setHeading = useCanvasTextEditorStore((state) => state.setHeading);
  const focusEditor = useCanvasTextEditorStore((state) => state.focusEditor);
  const requestFinishEditing = useCanvasTextEditorStore((state) => state.requestFinish);
  const addFieldVariable = useCanvasTextEditorStore((state) => state.addFieldVariable);
  const textEditor = useCanvasTextEditorStore((state) => state.editor);

  // State for variable dropdown in text editor toolbar
  const [textEditorVariableDropdownOpen, setTextEditorVariableDropdownOpen] = useState(false);
  const [textEditorLinkPopoverOpen, setTextEditorLinkPopoverOpen] = useState(false);

  // Exit text edit mode if a different layer is selected
  useEffect(() => {
    if (isTextEditing && editingLayerId && selectedLayerId !== editingLayerId) {
      requestFinishEditing();
    }
  }, [isTextEditing, editingLayerId, selectedLayerId, requestFinishEditing]);

  // Load draft when page changes (ensure draft exists before rendering)
  const loadDraft = usePagesStore((state) => state.loadDraft);
  useEffect(() => {
    if (currentPageId && !draftsByPageId[currentPageId]) {
      loadDraft(currentPageId);
    }
  }, [currentPageId, loadDraft, draftsByPageId]);

  // Reset content height when page changes to force Canvas to recalculate
  useEffect(() => {
    setReportedContentHeight(0);
  }, [currentPageId]);

  const getDropdownItems = useCollectionsStore((state) => state.getDropdownItems);
  const collectionItemsFromStore = useCollectionsStore((state) => state.items);
  const collectionsFromStore = useCollectionsStore((state) => state.collections);
  const collectionFieldsFromStore = useCollectionsStore((state) => state.fields);

  // Collection layer store for independent layer data
  const collectionLayerData = useCollectionLayerStore((state) => state.layerData);
  const referencedItems = useCollectionLayerStore((state) => state.referencedItems);
  const fetchReferencedCollectionItems = useCollectionLayerStore((state) => state.fetchReferencedCollectionItems);

  const { routeType, urlState, navigateToLayers, navigateToPage, navigateToPageEdit, updateQueryParams } = useEditorUrl();
  const components = useComponentsStore((state) => state.components);
  const componentDrafts = useComponentsStore((state) => state.componentDrafts);
  const [collectionItems, setCollectionItems] = useState<Array<{ id: string; label: string }>>([]);

  // Get editing component's variables for default value display
  // Depends on `components` array to react to variable changes
  const editingComponentVariables = useMemo(() => {
    if (!editingComponentId) return undefined;
    const component = components.find(c => c.id === editingComponentId);
    return component?.variables;
  }, [editingComponentId, components]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Undo/Redo hook - tracks versions for the current entity (page or component)
  const undoRedoEntityType = editingComponentId ? 'component' : 'page_layers';
  const undoRedoEntityId = editingComponentId || currentPageId;
  const {
    canUndo,
    canRedo,
    undo: performUndo,
    redo: performRedo,
    isLoading: isUndoRedoLoading,
  } = useUndoRedo({
    entityType: undoRedoEntityType,
    entityId: undoRedoEntityId,
    autoInit: true,
  });

  // Parse viewport width
  const viewportWidth = useMemo(() => {
    return parseInt(viewportSizes[viewportMode].width);
  }, [viewportMode]);

  // Calculate default iframe height to fill canvas (set once on load)
  const defaultCanvasHeight = useMemo(() => {
    if (!containerHeight) return 600;
    const calculatedHeight = containerHeight - CANVAS_PADDING;

    // Store the initial height when first calculated
    if (initialCanvasHeightRef.current === null) {
      initialCanvasHeightRef.current = calculatedHeight;
    }

    // Always use the initial height - don't change with zoom or container changes
    return initialCanvasHeightRef.current;
  }, [containerHeight]);

  // Effective iframe height: max of reported content and canvas height
  // This ensures Body fills canvas (min-height: 100%), but iframe shrinks when content is removed
  const iframeContentHeight = useMemo(() => {
    // Use max of reported content and canvas height
    // When content is small: iframe = canvas height, Body fills it with min-height: 100%
    // When content is large: iframe = content height, and shrinks when content is deleted
    return Math.max(reportedContentHeight, defaultCanvasHeight);
  }, [reportedContentHeight, defaultCanvasHeight]);

  // Calculate "zoom to fit" level - where scaled height equals container height
  const zoomToFitLevel = useMemo(() => {
    if (!containerHeight || !iframeContentHeight) return 100;
    return ((containerHeight - CANVAS_PADDING) / iframeContentHeight) * 100;
  }, [containerHeight, iframeContentHeight]);

  // Calculate content height for zoom calculations
  // Use actual iframe content height for both modes
  // This allows "Fit height" to zoom based on document content, not viewport
  const zoomContentHeight = iframeContentHeight;

  // Initialize zoom hook
  const {
    zoom,
    zoomMode,
    zoomIn,
    zoomOut,
    setZoomTo,
    resetZoom,
    zoomToFit,
    autofit,
    handleZoomGesture,
  } = useZoom({
    containerRef: canvasContainerRef,
    contentWidth: viewportWidth,
    contentHeight: zoomContentHeight,
    minZoom: 10,
    maxZoom: 1000,
    zoomStep: 10,
  });

  // Determine if we should center (zoomed out beyond "zoom to fit" level)
  const shouldCenter = zoom < zoomToFitLevel;

  // Set initial zoom once after autofit runs (when zoom changes from default 100)
  useEffect(() => {
    if (initialZoomRef.current === null && zoom > 0 && zoom !== 100) {
      initialZoomRef.current = zoom;
      setInitialZoomSet(true); // Trigger recalculation of finalIframeHeight
    }
  }, [zoom]);

  // Calculate final iframe height - compensate for initial zoom if needed
  const finalIframeHeight = useMemo(() => {
    const initialZoom = initialZoomRef.current;

    // If initial zoom < 100%, calculate the compensated height
    if (initialZoom && initialZoom < 100) {
      const compensatedHeight = defaultCanvasHeight / (initialZoom / 100);
      // Use the larger of: compensated height or content height
      // This ensures iframe doesn't shrink when adding small content
      return Math.max(compensatedHeight, iframeContentHeight);
    }

    return iframeContentHeight;
  }, [iframeContentHeight, defaultCanvasHeight]);

  // Recalculate autofit when viewport/breakpoint changes
  const prevViewportMode = useRef(viewportMode);
  useEffect(() => {
    if (prevViewportMode.current !== viewportMode) {
      // Small delay to ensure container dimensions are updated
      setTimeout(() => {
        autofit();
      }, 50);
      prevViewportMode.current = viewportMode;
    }
  }, [viewportMode, autofit]);

  // Recalculate zoom when content height becomes ready in preview mode
  const hasRecalculatedForContent = useRef(false);
  useEffect(() => {
    // In preview mode, wait for meaningful content height then recalculate once
    if (isPreviewMode && !hasRecalculatedForContent.current && iframeContentHeight > 600) {
      hasRecalculatedForContent.current = true;
      // Delay to ensure everything is ready
      setTimeout(() => {
        if (zoomMode === 'autofit') {
          autofit();
        } else if (zoomMode === 'fit') {
          zoomToFit();
        }
      }, 150);
    }
  }, [isPreviewMode, iframeContentHeight, zoomMode, autofit, zoomToFit]);

  // Reset flag when preview mode changes
  useEffect(() => {
    hasRecalculatedForContent.current = false;
  }, [isPreviewMode]);

  // Track container dimensions for dynamic alignment
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const updateContainerDimensions = () => {
      setContainerHeight(container.clientHeight);
      setContainerWidth(container.clientWidth);
    };

    updateContainerDimensions();
    const resizeObserver = new ResizeObserver(updateContainerDimensions);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  const layers = useMemo(() => {
    // If editing a component, show component layers
    if (editingComponentId) {
      return componentDrafts[editingComponentId] || [];
    }

    // Otherwise show page layers
    if (!currentPageId) {
      return [];
    }

    const draft = draftsByPageId[currentPageId];
    return draft ? draft.layers : [];
  }, [editingComponentId, componentDrafts, currentPageId, draftsByPageId]);

  // Check if we're waiting for a draft to load (page selected but no draft yet)
  const isDraftLoading = useMemo(() => {
    if (editingComponentId) return false;
    if (!currentPageId) return false;
    return !draftsByPageId[currentPageId];
  }, [editingComponentId, currentPageId, draftsByPageId]);

  // Check if canvas is empty (only Body layer with no children)
  const isCanvasEmpty = useMemo(() => {
    if (layers.length === 0) return false; // No layers at all - handled separately

    // Find Body layer
    const bodyLayer = layers.find(layer => layer.id === 'body' || layer.name === 'body');

    if (!bodyLayer) return false;

    // Check if Body has no children or empty children array
    const hasNoChildren = !bodyLayer.children || bodyLayer.children.length === 0;

    // Canvas is empty if we only have Body with no children
    return layers.length === 1 && hasNoChildren;
  }, [layers]);

  // Fetch collection data for all collection layers in the page
  const fetchLayerData = useCollectionLayerStore((state) => state.fetchLayerData);
  const fetchPage = useCollectionLayerStore((state) => state.fetchPage);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create a stable string representation of collection layer settings for dependency
  const collectionLayersKey = useMemo(() => {
    const extractCollectionSettings = (layerList: Layer[]): string[] => {
      const settings: string[] = [];
      layerList.forEach((layer) => {
        const collectionVariable = getCollectionVariable(layer);
        if (collectionVariable?.id) {
          settings.push(`${layer.id}:${collectionVariable.id}:${collectionVariable.sort_by ?? ''}:${collectionVariable.sort_order ?? ''}:${collectionVariable.limit ?? ''}:${collectionVariable.offset ?? ''}`);
        }
        if (layer.children && layer.children.length > 0) {
          settings.push(...extractCollectionSettings(layer.children));
        }
      });
      return settings;
    };

    return extractCollectionSettings(layers).join('|');
  }, [layers]);

  // Debounce the fetch to prevent duplicate calls during rapid updates
  useEffect(() => {
    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Set new timeout
    fetchTimeoutRef.current = setTimeout(() => {
      // Recursively find all collection layers and fetch their data
      const findAndFetchCollectionLayers = (layerList: Layer[]) => {
        layerList.forEach((layer) => {
          const collectionVariable = getCollectionVariable(layer);
          if (collectionVariable?.id) {
            fetchLayerData(
              layer.id,
              collectionVariable.id,
              collectionVariable.sort_by,
              collectionVariable.sort_order,
              collectionVariable.limit,
              collectionVariable.offset
            );
          }

          // Recursively check children
          if (layer.children && layer.children.length > 0) {
            findAndFetchCollectionLayers(layer.children);
          }
        });
      };

      if (layers.length > 0) {
        findAndFetchCollectionLayers(layers);
      }

      fetchTimeoutRef.current = null;
    }, 100); // 100ms debounce - waits for rapid updates to settle

    // Cleanup function
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, [collectionLayersKey, fetchLayerData, layers]);

  // Separate regular pages from error pages
  const { regularPages, errorPages } = useMemo(() => {
    const regular = pages.filter(page => page.error_page === null);
    const errors = pages
      .filter(page => page.error_page !== null)
      .sort((a, b) => (a.error_page || 0) - (b.error_page || 0));
    return { regularPages: regular, errorPages: errors };
  }, [pages]);

  // Build page tree for navigation (only with regular pages)
  const pageTree = useMemo(() => buildPageTree(regularPages, folders), [regularPages, folders]);

  // Create virtual "Error pages" folder node
  const errorPagesNode: PageTreeNode | null = useMemo(() => {
    if (errorPages.length === 0) return null;

    const virtualFolder: PageFolder = {
      id: 'virtual-error-pages-folder',
      name: 'Error pages',
      slug: 'error-pages',
      page_folder_id: null,
      depth: 0,
      order: 999999,
      settings: {},
      is_published: false,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const errorPageNodes: PageTreeNode[] = errorPages.map(page => ({
      id: page.id,
      type: 'page',
      data: page,
      children: [],
    }));

    return {
      id: virtualFolder.id,
      type: 'folder',
      data: virtualFolder,
      children: errorPageNodes,
    };
  }, [errorPages]);

  // Get current page name and icon
  const currentPage = useMemo(() => pages.find(p => p.id === currentPageId), [pages, currentPageId]);
  const currentPageName = currentPage?.name || 'Loading...';
  const currentPageIcon = useMemo(() => {
    if (!currentPage) return 'homepage';
    const node: PageTreeNode = {
      id: currentPage.id,
      type: 'page',
      data: currentPage,
      children: []
    };
    return getNodeIcon(node);
  }, [currentPage]);

  // Get collection ID from current page if it's dynamic
  const collectionId = useMemo(() => {
    if (!currentPage?.is_dynamic) return null;
    return currentPage.settings?.cms?.collection_id || null;
  }, [currentPage]);

  const pageCollectionItem = useMemo(() => {
    if (!currentPage?.is_dynamic) {
      return null;
    }

    // First, check if we have an optimistically updated item in the draft
    if (currentPageId) {
      const draft = draftsByPageId[currentPageId];
      if (draft && (draft as any).collectionItem) {
        return (draft as any).collectionItem;
      }
    }

    // Fall back to fetching from collections store
    const collectionId = currentPage.settings?.cms?.collection_id;
    if (!collectionId || !currentPageCollectionItemId) {
      return null;
    }
    const itemsForCollection = collectionItemsFromStore[collectionId] || [];
    return itemsForCollection.find((item) => item.id === currentPageCollectionItemId) || null;
  }, [currentPage, currentPageId, currentPageCollectionItemId, collectionItemsFromStore, draftsByPageId]);

  // Page collection fields (used for Canvas props and reference loading)
  const pageCollectionFields = useMemo(() => {
    if (!currentPage?.is_dynamic) {
      return [];
    }
    const collectionId = currentPage.settings?.cms?.collection_id;
    if (!collectionId) {
      return [];
    }
    return collectionFieldsFromStore[collectionId] || [];
  }, [currentPage, collectionFieldsFromStore]);

  // Get parent collection layer for the layer being edited (for inline variables in text editor)
  const editingLayerParentCollection = useMemo(() => {
    if (!editingLayerId || !currentPageId) return null;

    // Get layers from either component draft or page draft
    let layersToSearch: Layer[] = [];
    if (editingComponentId) {
      layersToSearch = componentDrafts[editingComponentId] || [];
    } else {
      const draft = draftsByPageId[currentPageId];
      layersToSearch = draft ? draft.layers : [];
    }

    if (!layersToSearch.length) return null;

    // Find parent collection layer
    return findParentCollectionLayer(layersToSearch, editingLayerId);
  }, [editingLayerId, editingComponentId, componentDrafts, currentPageId, draftsByPageId]);

  // Find all parent collection layers (for nested collections)
  const allParentCollectionLayers = useMemo(() => {
    if (!editingLayerId) return [];

    let layersToSearch: Layer[] = [];
    if (editingComponentId) {
      layersToSearch = componentDrafts[editingComponentId] || [];
    } else {
      const draft = currentPageId ? draftsByPageId[currentPageId] : null;
      layersToSearch = draft ? draft.layers : [];
    }

    if (!layersToSearch.length) return [];

    return findAllParentCollectionLayers(layersToSearch, editingLayerId);
  }, [editingLayerId, editingComponentId, componentDrafts, currentPageId, draftsByPageId]);

  // Build field groups for multi-source inline variable selection
  const fieldGroups = useMemo(() => {
    const collectionVariable = editingLayerParentCollection
      ? getCollectionVariable(editingLayerParentCollection)
      : null;

    // Check if parent is a multi-asset collection
    const isMultiAssetParent = collectionVariable?.source_field_type === 'multi_asset';
    const multiAssetContext = isMultiAssetParent && collectionVariable.source_field_id
      ? {
        sourceFieldId: collectionVariable.source_field_id,
        source: (collectionVariable.source_field_source || 'collection') as 'page' | 'collection',
      }
      : null;

    // Get all parent collection layers (closest first)
    const parentCollectionLayers = allParentCollectionLayers
      .map(layer => ({ layerId: layer.id, collectionId: getCollectionVariable(layer)?.id }))
      .filter((item): item is { layerId: string; collectionId: string } => !!item.collectionId);

    return buildFieldGroups({
      parentCollectionLayers,
      page: currentPage,
      fieldsByCollectionId: collectionFieldsFromStore,
      collections: collectionsFromStore,
      multiAssetContext,
    });
  }, [editingLayerParentCollection, allParentCollectionLayers, currentPage, collectionFieldsFromStore, collectionsFromStore]);

  // Create assets map for Canvas (asset ID -> asset)
  const assetsMap = useMemo(() => {
    const map: Record<string, Asset> = {};
    assets.forEach(asset => {
      map[asset.id] = asset;
    });
    return map;
  }, [assets]);

  // Handle any click inside the canvas (closes ElementLibrary panel and other popovers)
  const handleCanvasClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent('closeElementLibrary'));
    window.dispatchEvent(new CustomEvent('canvasClick'));
  }, []);

  // Canvas callback handlers
  const handleCanvasLayerClick = useCallback((layerId: string, event?: React.MouseEvent) => {
    // Skip selection changes during drag operations
    const { isDraggingLayerOnCanvas, isDraggingToCanvas } = useEditorStore.getState();
    if (isDraggingLayerOnCanvas || isDraggingToCanvas) {
      return;
    }

    if (!isPreviewMode) {
      setSelectedLayerId(layerId);
      // Switch to Layers tab when a layer is clicked on canvas
      setActiveSidebarTab('layers');

      // Detect if clicked on a text style element (bold, italic, etc.)
      if (event) {
        let target = event.target as HTMLElement;
        let textStyleKey: string | null = null;

        // Walk up the DOM tree to find data-style attribute
        while (target && target !== event.currentTarget) {
          const styleAttr = target.getAttribute?.('data-style');
          if (styleAttr) {
            textStyleKey = styleAttr;
            break;
          }
          target = target.parentElement as HTMLElement;
        }

        // Set the active text style key if found
        setActiveTextStyleKey(textStyleKey);
      }
    }
  }, [isPreviewMode, setSelectedLayerId, setActiveSidebarTab, setActiveTextStyleKey]);

  const handleCanvasLayerUpdate = useCallback((layerId: string, updates: Partial<Layer>) => {
    if (editingComponentId) {
      // Update layer in component draft
      const { updateComponentDraft } = useComponentsStore.getState();
      const currentDraft = componentDrafts[editingComponentId] || [];

      // Helper to update a layer in the tree
      const updateLayerInTree = (layers: Layer[], targetId: string, layerUpdates: Partial<Layer>): Layer[] => {
        return layers.map(layer => {
          if (layer.id === targetId) {
            return { ...layer, ...layerUpdates };
          }
          if (layer.children) {
            return { ...layer, children: updateLayerInTree(layer.children, targetId, layerUpdates) };
          }
          return layer;
        });
      };

      const updatedLayers = updateLayerInTree(currentDraft, layerId, updates);
      updateComponentDraft(editingComponentId, updatedLayers);
    } else if (currentPageId) {
      // Update layer in page draft
      updateLayer(currentPageId, layerId, updates);
    }
  }, [editingComponentId, componentDrafts, currentPageId, updateLayer]);

  const handleCanvasDeleteLayer = useCallback(() => {
    if (!selectedLayerId || !currentPageId) return;

    // Check if multi-select
    if (selectedLayerIds.length > 1) {
      // Check restrictions for all layers
      const draft = draftsByPageId[currentPageId];
      if (draft) {
        const layersToCheck = selectedLayerIds.map(id => findLayerById(draft.layers, id)).filter(Boolean) as Layer[];
        const canDeleteAll = layersToCheck.every(layer => canDeleteLayer(layer));

        if (canDeleteAll) {
          deleteLayers(currentPageId, selectedLayerIds);
          clearSelection();
        }
      }
    } else {
      // Single layer deletion - check restrictions
      const draft = draftsByPageId[currentPageId];
      if (draft) {
        const layer = findLayerById(draft.layers, selectedLayerId);
        if (!layer || !canDeleteLayer(layer)) {
          return;
        }
        deleteLayer(currentPageId, selectedLayerId);
        setSelectedLayerId(null);
      }
    }
  }, [selectedLayerId, currentPageId, selectedLayerIds, draftsByPageId, deleteLayers, clearSelection, deleteLayer, setSelectedLayerId]);

  const handleCanvasGapUpdate = useCallback((layerId: string, gapValue: string) => {
    if (!currentPageId) return;

    // Find the layer and update its gap class
    const draft = draftsByPageId[currentPageId];
    if (!draft) return;

    const layer = findLayerById(draft.layers, layerId);
    if (!layer) return;

    // Get current classes
    const currentClasses = Array.isArray(layer.classes) ? layer.classes : (layer.classes?.split(' ') || []);

    // Remove existing gap classes
    const filteredClasses = currentClasses.filter((cls: string) => !cls.startsWith('gap-'));

    // Add new gap class
    const newClasses = [...filteredClasses, `gap-[${gapValue}]`];

    // Update the layer
    updateLayer(currentPageId, layerId, { classes: newClasses });
  }, [currentPageId, draftsByPageId, updateLayer]);

  // Handle iframe ready callback (for SelectionOverlay)
  const handleIframeReady = useCallback((iframeElement: HTMLIFrameElement) => {
    setCanvasIframeElement(iframeElement);
  }, []);

  // Handle layer hover from Canvas (for SelectionOverlay)
  const handleCanvasLayerHover = useCallback((layerId: string | null) => {
    setHoveredLayerId(layerId);
  }, [setHoveredLayerId]);

  // Undo/Redo handlers
  // Note: We don't auto-save after undo/redo to preserve the redo stack
  // The state will be saved when the user makes the next change
  const handleUndo = useCallback(async () => {
    if (!canUndo || isUndoRedoLoading) return;
    await performUndo();
  }, [canUndo, isUndoRedoLoading, performUndo]);

  const handleRedo = useCallback(async () => {
    if (!canRedo || isUndoRedoLoading) return;
    await performRedo();
  }, [canRedo, isUndoRedoLoading, performRedo]);

  // Handle drop callback for useCanvasDropDetection
  const handleCanvasDrop = useCallback((
    elementType: string,
    source: 'elements' | 'layouts' | 'components',
    dropTarget: { layerId: string; position: 'above' | 'below' | 'inside'; parentId: string | null }
  ) => {
    if (!currentPageId) return;

    if (source === 'elements') {
      // Determine insert position based on drop target
      // If dropping 'inside', no sibling positioning needed
      // If dropping 'above' or 'below', we need to specify the sibling position
      const insertPosition = (dropTarget.position === 'above' || dropTarget.position === 'below')
        ? { siblingId: dropTarget.layerId, position: dropTarget.position as 'above' | 'below' }
        : undefined;

      const result = addLayerFromTemplate(currentPageId, dropTarget.parentId, elementType, insertPosition);
      if (result) {
        setSelectedLayerId(result.newLayerId);
        // Expand parent if needed
        if (result.parentToExpand) {
          window.dispatchEvent(new CustomEvent('expandLayer', {
            detail: { layerId: result.parentToExpand }
          }));
        }
        // Broadcast to collaborators
        if (liveLayerUpdates) {
          const freshDraft = usePagesStore.getState().draftsByPageId[currentPageId];
          if (freshDraft) {
            const findLayerWithParent = (layersList: Layer[], id: string, parent: Layer | null = null): { layer: Layer; parent: Layer | null } | null => {
              for (const layer of layersList) {
                if (layer.id === id) return { layer, parent };
                if (layer.children) {
                  const found = findLayerWithParent(layer.children, id, layer);
                  if (found) return found;
                }
              }
              return null;
            };
            const found = findLayerWithParent(freshDraft.layers, result.newLayerId);
            if (found?.layer) {
              const actualParentId = found.parent?.id || null;
              liveLayerUpdates.broadcastLayerAdd(currentPageId, actualParentId, elementType, found.layer);
            }
          }
        }
      }
    } else if (source === 'layouts') {
      // TODO: Add layout using similar logic
      console.log('Layout drop not yet implemented:', elementType);
    } else if (source === 'components') {
      // TODO: Add component using similar logic
      console.log('Component drop not yet implemented:', elementType);
    }
  }, [currentPageId, addLayerFromTemplate, setSelectedLayerId, liveLayerUpdates]);

  // Use the canvas drop detection hook for throttled hit-testing
  useCanvasDropDetection({
    iframeElement: canvasIframeElement,
    zoom,
    layers,
    pageId: currentPageId,
    onDrop: handleCanvasDrop,
  });

  // Handle layer reorder callback for sibling reordering on canvas
  const handleLayerReorder = useCallback((newLayers: Layer[]) => {
    if (!currentPageId) return;

    // If editing component, would need to update component draft instead
    if (editingComponentId) {
      // TODO: Support component editing
      console.log('Sibling reorder in component not yet implemented');
      return;
    }

    setDraftLayers(currentPageId, newLayers);
  }, [currentPageId, editingComponentId, setDraftLayers]);

  // Use the canvas sibling reorder hook for drag-to-reorder within same parent
  // Disable during text edit mode so text selection works
  useCanvasSiblingReorder({
    iframeElement: canvasIframeElement,
    zoom,
    layers,
    pageId: currentPageId,
    selectedLayerId,
    disabled: isTextEditing,
    onReorder: handleLayerReorder,
    onLayerSelect: setSelectedLayerId,
  });

  // Calculate parent layer ID for selection overlay (one level up from selected)
  const parentLayerId = useMemo(() => {
    if (!selectedLayerId || !currentPageId) return null;

    // Get layers from either component draft or page draft
    let layersToSearch: Layer[] = [];
    if (editingComponentId) {
      layersToSearch = componentDrafts[editingComponentId] || [];
    } else {
      const draft = draftsByPageId[currentPageId];
      layersToSearch = draft ? draft.layers : [];
    }

    if (!layersToSearch.length) return null;

    // Recursive function to find parent of a layer
    const findParentId = (layers: Layer[], targetId: string, parentId: string | null = null): string | null | undefined => {
      for (const layer of layers) {
        if (layer.id === targetId) {
          return parentId;
        }
        if (layer.children && layer.children.length > 0) {
          const result = findParentId(layer.children, targetId, layer.id);
          if (result !== undefined) {
            return result;
          }
        }
      }
      return undefined; // Not found in this branch
    };

    const result = findParentId(layersToSearch, selectedLayerId);
    return result === undefined ? null : result;
  }, [selectedLayerId, currentPageId, editingComponentId, componentDrafts, draftsByPageId]);

  // Get selected layer name for drag preview
  const selectedLayerName = useMemo(() => {
    if (!selectedLayerId) return null;
    const layer = findLayerById(layers, selectedLayerId);
    // Use layer's name property (e.g., 'div', 'section', 'heading')
    return layer?.name || null;
  }, [selectedLayerId, layers]);

  // Get selected locale and translations
  const selectedLocale = getSelectedLocale();
  const localeTranslations = useMemo(() => {
    return selectedLocaleId ? translations[selectedLocaleId] : undefined;
  }, [selectedLocaleId, translations]);

  // Build preview URL for preview mode
  const previewUrl = useMemo(() => {
    if (!currentPage) return '';

    // Error pages use special preview route
    if (currentPage.error_page !== null) {
      return `/ycode/preview/error-pages/${currentPage.error_page}`;
    }

    // Get collection item slug value for dynamic pages (with translation support)
    const collectionItemSlug = currentPage.is_dynamic && currentPageCollectionItemId
      ? (() => {
        const collectionId = currentPage.settings?.cms?.collection_id;
        const slugFieldId = currentPage.settings?.cms?.slug_field_id;

        if (!collectionId || !slugFieldId) return null;

        const collectionItems = collectionItemsFromStore[collectionId] || [];
        const selectedItem = collectionItems.find(item => item.id === currentPageCollectionItemId);

        if (!selectedItem || !selectedItem.values) return null;

        let slugValue = selectedItem.values[slugFieldId];

        // If locale is selected, check for translated slug
        if (localeTranslations && slugValue) {
          const collectionFields = collectionFieldsFromStore[collectionId] || [];
          const slugField = collectionFields.find(f => f.id === slugFieldId);

          if (slugField) {
            // Build translation key: field:key:{key} or field:id:{id}
            const contentKey = slugField.key
              ? `field:key:${slugField.key}`
              : `field:id:${slugField.id}`;
            const translationKey = `cms:${currentPageCollectionItemId}:${contentKey}`;
            const translation = localeTranslations[translationKey];

            const translatedSlug = getTranslationValue(translation);
            if (translatedSlug) {
              slugValue = translatedSlug;
            }
          }
        }

        return slugValue || null;
      })()
      : null;

    // Build localized path with translated slugs
    const path = currentPage.is_dynamic
      ? buildLocalizedDynamicPageUrl(currentPage, folders, collectionItemSlug, selectedLocale, localeTranslations)
      : buildLocalizedSlugPath(currentPage, folders, 'page', selectedLocale, localeTranslations);

    return `/ycode/preview${path === '/' ? '' : path}`;
  }, [currentPage, folders, currentPageCollectionItemId, collectionItemsFromStore, collectionFieldsFromStore, selectedLocale, localeTranslations]);

  // Generate a stable preview key that changes when layers are actually modified
  const previewKey = useMemo(() => {
    // Use JSON.stringify of layer structure to detect changes
    // This is more efficient than Date.now() which would refresh constantly
    const layerHash = JSON.stringify(layers);
    return `preview-${currentPageId}-${layerHash.length}`;
  }, [currentPageId, layers]);

  // Load collection items when dynamic page is selected
  useEffect(() => {
    if (!collectionId || !currentPage?.is_dynamic) {
      setCollectionItems([]);
      setIsLoadingItems(false);
      return;
    }

    const loadItems = async () => {
      setIsLoadingItems(true);
      try {
        const itemsWithLabels = await getDropdownItems(collectionId);
        setCollectionItems(itemsWithLabels);
        // Auto-select first item if none selected
        if (!currentPageCollectionItemId && itemsWithLabels.length > 0) {
          setCurrentPageCollectionItemId(itemsWithLabels[0].id);
        }
      } catch (error) {
        console.error('Failed to load collection items:', error);
      } finally {
        setIsLoadingItems(false);
      }
    };

    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, currentPage?.is_dynamic, getDropdownItems]);

  // Get return page for component edit mode
  const returnToPage = useMemo(() => {
    return returnToPageId ? pages.find(p => p.id === returnToPageId) : null;
  }, [returnToPageId, pages]);

  // Initialize all folders as collapsed on mount (including virtual error pages folder)
  useEffect(() => {
    const allFolderIds = new Set(folders.map(f => f.id));
    // Also collapse the virtual error pages folder by default
    allFolderIds.add('virtual-error-pages-folder');
    setCollapsedFolderIds(allFolderIds);
  }, [folders]);

  // Toggle folder collapse state
  const toggleFolder = useCallback((folderId: string) => {
    setCollapsedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Handle page selection
  const handlePageSelect = useCallback((pageId: string) => {
    // Clear selection FIRST to release locks on the current page's channel
    // before switching to the new page's channel
    setSelectedLayerId(null);

    // Set the page ID immediately for responsive UI
    // The URL effect in YCodeBuilderMain uses a ref to track when we're navigating
    // to prevent reverting to the old page before the URL updates
    setCurrentPageId(pageId);

    setPagePopoverOpen(false);

    // Navigate to the same route type but with the new page ID
    // IMPORTANT: Explicitly pass 'body' as the layer to avoid carrying over invalid layer IDs from the old page
    if (routeType === 'layers') {
      navigateToLayers(pageId, undefined, undefined, 'body');
    } else if (routeType === 'page' && urlState.isEditing) {
      navigateToPageEdit(pageId);
    } else if (routeType === 'page') {
      navigateToPage(pageId, undefined, undefined, 'body');
    } else {
      // Default to layers if no route type
      navigateToLayers(pageId, undefined, undefined, 'body');
    }
  }, [setSelectedLayerId, setCurrentPageId, routeType, urlState.isEditing, navigateToLayers, navigateToPage, navigateToPageEdit]);

  // Render page tree recursively
  const renderPageTreeNode = useCallback((node: PageTreeNode, depth: number = 0) => {
    const isFolder = node.type === 'folder';
    const isCollapsed = isFolder && collapsedFolderIds.has(node.id);
    const isCurrentPage = !isFolder && node.id === currentPageId;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id}>
        <div
          onClick={() => {
            if (isFolder) {
              toggleFolder(node.id);
            } else {
              handlePageSelect(node.id);
            }
          }}
          className={cn(
            "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-pointer items-center gap-1.25 rounded-sm py-1.5 pr-8 pl-2 text-xs outline-hidden select-none data-disabled:opacity-50 data-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
            isCurrentPage && 'bg-secondary/50'
          )}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          {/* Expand/Collapse Button */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isFolder) {
                  toggleFolder(node.id);
                }
              }}
              className={cn(
                'size-3 flex items-center justify-center shrink-0',
                isCollapsed ? '' : 'rotate-90'
              )}
            >
              <Icon name="chevronRight" className={cn('size-2.5 opacity-50', isCurrentPage && 'opacity-80')} />
            </button>
          ) : (
            <div className="size-3 shrink-0 flex items-center justify-center">
              <div className={cn('ml-px w-1.5 h-px bg-white opacity-0', isCurrentPage && 'opacity-0')} />
            </div>
          )}

          {/* Icon */}
          <Icon
            name={getNodeIcon(node)}
            className={cn('size-3 mr-0.5', isCurrentPage ? 'opacity-90' : 'opacity-50')}
          />

          {/* Label */}
          <span className="grow text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none">
            {isFolder ? (node.data as PageFolder).name : (node.data as Page).name}
          </span>

          {/* Check indicator */}
          {isCurrentPage && (
            <span className="absolute right-2 flex size-3 items-center justify-center">
              <Icon name="check" className="size-3 opacity-50" />
            </span>
          )}

        </div>
        {isFolder && !isCollapsed && node.children && (
          <div>
            {node.children.map(child => renderPageTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }, [collapsedFolderIds, currentPageId, toggleFolder, handlePageSelect]);

  // Fetch referenced collection items recursively when layers with reference fields are detected
  useEffect(() => {
    // Recursively find all referenced collection IDs by following reference chains
    const findAllReferencedCollections = (
      fieldsMap: Record<string, CollectionField[]>,
      visited: Set<string> = new Set()
    ): Set<string> => {
      const referencedIds = new Set<string>();

      const processFields = (fields: CollectionField[]) => {
        fields.forEach((field) => {
          if (field.type === 'reference' && field.reference_collection_id) {
            const refId = field.reference_collection_id;
            if (!visited.has(refId)) {
              referencedIds.add(refId);
              visited.add(refId);

              // Recursively check the referenced collection's fields
              const refFields = fieldsMap[refId];
              if (refFields) {
                processFields(refFields);
              }
            }
          }
        });
      };

      // Process all loaded collection fields
      Object.values(fieldsMap).forEach(processFields);

      return referencedIds;
    };

    // Start with loaded fields
    const allReferencedIds = findAllReferencedCollections(collectionFieldsFromStore);

    // Also check page collection fields
    if (pageCollectionFields) {
      pageCollectionFields.forEach((field) => {
        if (field.type === 'reference' && field.reference_collection_id) {
          allReferencedIds.add(field.reference_collection_id);
        }
      });
    }

    // Fetch items for each referenced collection
    allReferencedIds.forEach((collectionId) => {
      fetchReferencedCollectionItems(collectionId);
    });
  }, [collectionFieldsFromStore, pageCollectionFields, fetchReferencedCollectionItems]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    if (isPreviewMode) return; // No undo/redo in preview mode

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with text input fields
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (isInputFocused) return;

      // Check for Cmd/Ctrl + Z (undo) and Cmd/Ctrl + Shift + Z (redo)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();

        if (e.shiftKey) {
          // Redo: Cmd/Ctrl + Shift + Z
          handleRedo();
        } else {
          // Undo: Cmd/Ctrl + Z
          handleUndo();
        }
        return;
      }

      // Check for Cmd/Ctrl + Y (redo alternative)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewMode, handleUndo, handleRedo]);

  // Add zoom gesture handlers for preview mode (when iframe doesn't have them)
  useEffect(() => {
    if (!isPreviewMode) return; // Editor iframe handles its own zoom gestures

    const container = canvasContainerRef.current;
    const iframe = iframeRef.current;
    if (!container) return;

    // Get iframe's window and document for event listening
    let iframeWindow: Window | null = null;
    let iframeDocument: Document | null = null;

    // Wait for iframe to load before attaching listeners
    const setupIframeListeners = () => {
      try {
        iframeWindow = iframe?.contentWindow || null;
        iframeDocument = iframe?.contentDocument || null;

        if (!iframeWindow || !iframeDocument) return;

        // Attach listeners to iframe's document
        iframeDocument.addEventListener('wheel', handleWheel, { passive: false, capture: true });
        iframeDocument.addEventListener('touchstart', handleTouchStart, { passive: true });
        iframeDocument.addEventListener('touchmove', handleTouchMove, { passive: true });
        iframeDocument.addEventListener('touchend', handleTouchEnd, { passive: true });
      } catch (e) {
        // Cross-origin iframe - fall back to container listeners only
        console.warn('Cannot access iframe document for zoom gestures:', e);
      }
    };

    // Wheel event for Ctrl/Cmd + wheel zoom (includes trackpad pinch on Mac)
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        // Positive deltaY means zoom out, negative means zoom in
        const delta = -e.deltaY;
        handleZoomGesture(delta);

        return false;
      }
    };

    // Touch events for pinch zoom on mobile/tablet
    let lastTouchDistance: number | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistance !== null) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);

        // Calculate delta and send zoom gesture
        const delta = (currentDistance - lastTouchDistance) * 2;
        handleZoomGesture(delta);

        lastTouchDistance = currentDistance;
      }
    };

    const handleTouchEnd = () => {
      lastTouchDistance = null;
    };

    // Add event listeners to container (fallback for when cursor is outside iframe)
    container.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Setup iframe listeners when iframe loads
    if (iframe) {
      iframe.addEventListener('load', setupIframeListeners);
      // Try to set up immediately in case iframe is already loaded
      if (iframe.contentDocument?.readyState === 'complete') {
        setupIframeListeners();
      }
    }

    return () => {
      // Remove container listeners
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);

      // Remove iframe listeners if they were added
      if (iframeDocument) {
        try {
          iframeDocument.removeEventListener('wheel', handleWheel);
          iframeDocument.removeEventListener('touchstart', handleTouchStart);
          iframeDocument.removeEventListener('touchmove', handleTouchMove);
          iframeDocument.removeEventListener('touchend', handleTouchEnd);
        } catch (e) {
          // Ignore errors when removing listeners
        }
      }

      if (iframe) {
        iframe.removeEventListener('load', setupIframeListeners);
      }
    };
  }, [isPreviewMode, handleZoomGesture]);

  return (
    <div className="flex-1 min-w-0 flex flex-col relative">
      {/* Top Bar */}
      <div className="grid grid-cols-3 items-center p-4 border-b bg-background">
        {/* Page Selector or Back to Page Button */}
        {editingComponentId ? (
          <Button
            variant="purple"
            size="sm"
            onClick={onExitComponentEditMode}
            className="gap-1 w-fit"
          >
            <Icon name="arrowLeft" />
            {(() => {
              const returnDestination = getReturnDestination();
              if (returnDestination && returnDestination.name) {
                return returnDestination.type === 'page'
                  ? `Return to ${returnDestination.name}`
                  : `Return to ${returnDestination.name}`;
              }
              // Fallback: Try to get name from stores if stack entry exists but name is empty
              if (returnDestination) {
                if (returnDestination.type === 'page') {
                  const page = pages.find(p => p.id === returnDestination.id);
                  if (page) return `Return to ${page.name}`;
                } else {
                  const component = components.find(c => c.id === returnDestination.id);
                  if (component) return `Return to ${component.name}`;
                }
              }
              // Final fallback to old behavior if stack is empty
              return `Back to ${returnToPage ? returnToPage.name : 'Homepage'}`;
            })()}
          </Button>
        ) : (
          <div className="flex items-center gap-1.5">
            <Popover open={pagePopoverOpen} onOpenChange={setPagePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="input"
                  size="sm"
                  role="combobox"
                  aria-expanded={pagePopoverOpen}
                  className="w-40 justify-between"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Icon name={currentPageIcon} className="size-3 opacity-50 shrink-0" />
                    <span className="truncate">
                      {currentPageName}
                    </span>
                  </div>
                  <div className="shrink-0">
                    <Icon name="chevronCombo" className="size-2.5! shrink-0 opacity-50" />
                  </div>
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-auto min-w-60 max-w-96 p-1" align="start">
                <div className="max-h-100 overflow-y-auto">
                  {/* Regular pages tree */}
                  {pageTree.length > 0 && pageTree.map(node => renderPageTreeNode(node, 0))}

                  {/* Separator before error pages */}
                  <Separator className="my-1" />

                  {/* Virtual "Error pages" folder */}
                  {errorPagesNode && renderPageTreeNode(errorPagesNode, 0)}

                  {/* Empty state - only show if no pages at all */}
                  {pageTree.length === 0 && !errorPagesNode && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No pages found
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Collection item selector for dynamic pages */}
            {currentPage?.is_dynamic && collectionId && (
              <Select
                value={currentPageCollectionItemId || ''}
                onValueChange={setCurrentPageCollectionItemId}
                disabled={isLoadingItems || collectionItems.length === 0}
              >
                <SelectTrigger className="w-24 justify-between" size="sm">
                  {isLoadingItems ? (
                    <Spinner className="size-3" />
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="shrink-0">
                            <Icon name="database" className="size-3 opacity-50" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Collection item</TooltipContent>
                      </Tooltip>
                      <span className="truncate">
                        {collectionItems.find(item => item.id === currentPageCollectionItemId)?.label || 'Select item'}
                      </span>
                    </div>
                  )}
                </SelectTrigger>

                <SelectContent>
                  {collectionItems.length > 0 ? (
                    collectionItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No items available
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Viewport Controls */}
        <div className="flex justify-center gap-2">
          <Tabs value={viewportMode} onValueChange={(value) => setViewportMode(value as ViewportMode)}>
            <TabsList className="w-50">
            <TabsTrigger value="desktop" title="Desktop View">
              Desktop
            </TabsTrigger>
            <TabsTrigger value="tablet" title="Tablet View">
              Tablet
            </TabsTrigger>
            <TabsTrigger value="mobile" title="Mobile View">
              Phone
            </TabsTrigger>
          </TabsList>
          </Tabs>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="input" size="sm">
                {Math.round(zoom)}%
                <div>
                  <Icon name="chevronCombo" className="size-2.5! opacity-50" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="bottom"
              sideOffset={4}
              avoidCollisions={false}
              collisionPadding={0}
              className="max-h-75! w-38"
            >
              <DropdownMenuItem onClick={zoomIn}>
                Zoom in
                <DropdownMenuShortcut>⌘+</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={zoomOut}>
                Zoom out
                <DropdownMenuShortcut>⌘-</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetZoom}>
                Zoom to 100%
                <DropdownMenuShortcut>⌘0</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={zoomToFit}>
                Fit height
                <DropdownMenuShortcut>⌘1</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={autofit}>
                Fit width
                <DropdownMenuShortcut>⌘2</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Undo/Redo Buttons (hidden in preview mode) */}
        {!isPreviewMode && (
          <div className="flex justify-end gap-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleUndo}
              disabled={!canUndo || isUndoRedoLoading}
              title="Undo (⌘Z)"
            >
              <Icon name="undo" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRedo}
              disabled={!canRedo || isUndoRedoLoading}
              title="Redo (⌘⇧Z)"
            >
              <Icon name="redo" />
            </Button>
          </div>
        )}
      </div>

      {/* Text Editor Toolbar - shown when editing text */}
      {isTextEditing && !isPreviewMode && (
        <div className="absolute top-0 h-16.25 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 bg-background border-b">
          {/* Heading/Paragraph Dropdown */}
          <Select
            value={
              textEditorActiveMarks.headingLevel
                ? `h${textEditorActiveMarks.headingLevel}`
                : 'paragraph'
            }
            onValueChange={(value) => {
              if (value === 'paragraph') {
                setHeading(null);
              } else {
                const level = parseInt(value.replace('h', '')) as 1 | 2 | 3 | 4 | 5 | 6;
                setHeading(level);
              }
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="paragraph">Paragraph</SelectItem>
              <SelectItem value="h1">Heading 1</SelectItem>
              <SelectItem value="h2">Heading 2</SelectItem>
              <SelectItem value="h3">Heading 3</SelectItem>
              <SelectItem value="h4">Heading 4</SelectItem>
              <SelectItem value="h5">Heading 5</SelectItem>
              <SelectItem value="h6">Heading 6</SelectItem>
            </SelectContent>
          </Select>

          {/* Link Button */}
          {textEditor && (() => {
            // Find the current layer being edited
            let editingLayer: Layer | null = null;
            let layersToSearch: Layer[] = [];
            if (editingLayerId) {
              if (editingComponentId) {
                layersToSearch = componentDrafts[editingComponentId] || [];
              } else if (currentPageId) {
                const draft = draftsByPageId[currentPageId];
                layersToSearch = draft ? draft.layers : [];
              }
              editingLayer = findLayerById(layersToSearch, editingLayerId);
            }

            // Check if layer can have rich text links
            const { canHaveLinks } = editingLayer
              ? canLayerHaveLink(editingLayer, layersToSearch, 'richText')
              : { canHaveLinks: true };

            return canHaveLinks ? (
              <ToggleGroup
                type="single"
                size="xs"
                variant="secondary"
                spacing={1}
              >
                <RichTextLinkPopover
                  editor={textEditor}
                  fieldGroups={fieldGroups}
                  allFields={collectionFieldsFromStore}
                  collections={collectionsFromStore}
                  isInsideCollectionLayer={!!editingLayerParentCollection}
                  layer={editingLayer}
                  open={textEditorLinkPopoverOpen}
                  onOpenChange={setTextEditorLinkPopoverOpen}
                  disabled={false}
                  trigger={
                    <ToggleGroupItem
                      value="link"
                      data-state={textEditorActiveMarks.richTextLink ? 'on' : 'off'}
                      asChild
                    >
                      <button
                        type="button" title="Link"
                        className="w-auto min-w-0 shrink-0"
                      >
                        <Icon name="link" className="size-3" />
                      </button>
                    </ToggleGroupItem>
                  }
                />
              </ToggleGroup>
            ) : (
              <ToggleGroup
                type="single" size="xs"
                variant="secondary" spacing={1}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToggleGroupItem
                      value="link" disabled
                      asChild
                    >
                      <button type="button" className="w-auto min-w-0 shrink-0">
                        <Icon name="link" className="size-3" />
                      </button>
                    </ToggleGroupItem>
                  </TooltipTrigger>
                  <TooltipContent>Links cannot be nested</TooltipContent>
                </Tooltip>
              </ToggleGroup>
            );
          })()}

          {/* Text formatting */}
          <ToggleGroup
            type="multiple"
            size="xs"
            variant="secondary"
            spacing={1}
          >
            <ToggleGroupItem
              value="bold"
              data-state={textEditorActiveMarks.bold ? 'on' : 'off'}
              onMouseDown={(e) => {
                e.preventDefault();
                toggleBold();
              }}
              title="Bold (⌘B)"
            >
              <Icon name="bold" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="italic"
              data-state={textEditorActiveMarks.italic ? 'on' : 'off'}
              onMouseDown={(e) => {
                e.preventDefault();
                toggleItalic();
              }}
              title="Italic (⌘I)"
            >
              <Icon name="italic" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="underline"
              data-state={textEditorActiveMarks.underline ? 'on' : 'off'}
              onMouseDown={(e) => {
                e.preventDefault();
                toggleUnderline();
              }}
              title="Underline (⌘U)"
            >
              <Icon name="underline" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="strike"
              data-state={textEditorActiveMarks.strike ? 'on' : 'off'}
              onMouseDown={(e) => {
                e.preventDefault();
                toggleStrike();
              }}
              title="Strikethrough"
            >
              <Icon name="strikethrough" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="superscript"
              data-state={textEditorActiveMarks.superscript ? 'on' : 'off'}
              onMouseDown={(e) => {
                e.preventDefault();
                toggleSuperscript();
              }}
              title="Superscript"
            >
              <Icon name="superscript" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="subscript"
              data-state={textEditorActiveMarks.subscript ? 'on' : 'off'}
              onMouseDown={(e) => {
                e.preventDefault();
                toggleSubscript();
              }}
              title="Subscript"
            >
              <Icon name="subscript" className="size-3" />
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Lists */}
          <ToggleGroup
            type="multiple"
            size="xs"
            variant="secondary"
            spacing={1}
          >
            <ToggleGroupItem
              value="bulletList"
              data-state={textEditorActiveMarks.bulletList ? 'on' : 'off'}
              onMouseDown={(e) => {
                e.preventDefault();
                toggleBulletList();
              }}
              title="Bullet List"
            >
              <Icon name="listUnordered" className="size-3" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="orderedList"
              data-state={textEditorActiveMarks.orderedList ? 'on' : 'off'}
              onMouseDown={(e) => {
                e.preventDefault();
                toggleOrderedList();
              }}
              title="Numbered List"
            >
              <Icon name="listOrdered" className="size-3" />
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Inline Variable Button */}
          {hasFieldsMatching(fieldGroups, f => DISPLAYABLE_FIELD_TYPES.includes(f.type)) && (
            <ToggleGroup
              type="single"
              size="xs"
              variant="secondary"
              spacing={1}
            >
              <DropdownMenu
                open={textEditorVariableDropdownOpen}
                onOpenChange={setTextEditorVariableDropdownOpen}
              >
                <DropdownMenuTrigger asChild>
                  <ToggleGroupItem value="variable" asChild>
                    <button
                      type="button" title="Insert Variable"
                      className="w-auto min-w-0 shrink-0"
                    >
                      <Icon name="database" className="size-3" />
                    </button>
                  </ToggleGroupItem>
                </DropdownMenuTrigger>

                {fieldGroups && (
                  <DropdownMenuContent
                    className="w-56 py-1 px-1 max-h-none!"
                    align="start"
                    sideOffset={4}
                  >
                    <CollectionFieldSelector
                      fieldGroups={fieldGroups}
                      allFields={collectionFieldsFromStore}
                      collections={collectionsFromStore}
                      onSelect={(fieldId, relationshipPath, source) => {
                        const flatFields = flattenFieldGroups(fieldGroups);
                        const field = flatFields.find(f => f.id === fieldId);
                        addFieldVariable(
                          {
                            type: 'field',
                            data: {
                              field_id: fieldId,
                              relationships: relationshipPath,
                              source,
                              field_type: field?.type || null,
                            },
                          },
                          flatFields,
                          collectionFieldsFromStore
                        );
                        setTextEditorVariableDropdownOpen(false);
                      }}
                    />
                  </DropdownMenuContent>
                )}
              </DropdownMenu>
            </ToggleGroup>
          )}

          {/*<span className="text-xs text-muted-foreground mr-0.5">*/}
          {/*  Press <kbd className="mx-0.5 px-1.5 py-0.75 bg-secondary rounded text-[10px] text-foreground">ESC</kbd> to*/}
          {/*</span>*/}

          {/*<Button size="xs" variant="secondary" onClick={() => {*/}
          {/*    requestFinishEditing();*/}
          {/*  }}>*/}
          {/*  Close*/}
          {/*</Button>*/}
        </div>
      )}

      {/* Canvas Area */}
      <div
        ref={canvasContainerRef}
        className="flex-1 relative overflow-hidden bg-neutral-50 dark:bg-neutral-950/80"
      >
        {/* Loading skeleton overlay when draft is being fetched */}
        {isDraftLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-50/80 dark:bg-neutral-950/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading page...</span>
            </div>
          </div>
        )}

        {/* Selection overlay - renders outlines on top of the iframe */}
        {!isPreviewMode && canvasIframeElement && (
          <SelectionOverlay
            iframeElement={canvasIframeElement}
            containerElement={scrollContainerRef.current}
            selectedLayerId={selectedLayerId}
            hoveredLayerId={hoveredLayerId}
            parentLayerId={parentLayerId}
            zoom={zoom}
          />
        )}

        {/* Drag capture overlay - prevents iframe from swallowing mouse events during drag */}
        {!isPreviewMode && <DragCaptureOverlay />}

        {/* Scrollable container with hidden scrollbars */}
        <div
          ref={scrollContainerRef}
          className={cn(
            'absolute inset-0 z-0',
            isPreviewMode ? 'overflow-hidden' : 'overflow-auto'
          )}
          style={{
            // Hide scrollbars but keep scrolling functionality (editor mode only)
            scrollbarWidth: isPreviewMode ? undefined : 'none', // Firefox
            msOverflowStyle: isPreviewMode ? undefined : 'none', // IE/Edge
            WebkitOverflowScrolling: isPreviewMode ? undefined : 'touch', // Smooth scrolling on iOS
          }}
          onClick={handleCanvasClick}
        >
          {/* Hide scrollbars for Webkit browsers (editor mode only) */}
          {!isPreviewMode && (
            <style jsx>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
          )}

          {/* Preview mode: Scaled iframe with internal scrolling */}
          {isPreviewMode ? (
            <div
              className="w-full h-full flex items-start justify-center"
              style={{
                padding: `${CANVAS_BORDER}px`,
              }}
            >
              <div
                className="bg-white shadow-3xl relative"
                style={{
                  width: viewportSizes[viewportMode].width,
                  // Compensate height for zoom so visual size = 100% after scaling
                  height: `${((containerHeight - CANVAS_PADDING) / (zoom / 100))}px`,
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'top center',
                  willChange: 'transform',
                  backfaceVisibility: 'hidden',
                  transition: 'none',
                }}
              >
                {layers.length > 0 ? (
                  <iframe
                    key={previewKey}
                    ref={iframeRef}
                    src={previewUrl}
                    className="w-full h-full border-0"
                    title="Preview"
                    tabIndex={-1}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-12">
                    <div className="text-center max-w-md">
                      <div className="w-20 h-20 bg-linear-to-br from-blue-100 to-blue-50 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                        <Icon name="layout" className="w-10 h-10 text-blue-500" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-3">
                        No content
                      </h2>
                      <p className="text-gray-600">
                        This page has no content to preview.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Editor mode: Scaled canvas with zoom controls */
            <div
              style={{
                position: 'relative',
                minWidth: '100%',
                minHeight: '100%',
              }}
            >
              <div
                style={{
                  // Width: exact scaled size, min 100% to fill viewport horizontally
                  width: `${viewportWidth * (zoom / 100) + CANVAS_PADDING}px`,
                  minWidth: '100%',
                  // Height: exact viewport height when centered, scaled size when top-aligned
                  height: shouldCenter
                    ? `${containerHeight}px`  // Use actual viewport height
                    : `${finalIframeHeight * (zoom / 100) + CANVAS_PADDING}px`,
                  display: 'flex',
                  // Always use flex-start - we'll handle centering via padding
                  alignItems: 'flex-start',
                  justifyContent: 'center', // Center horizontally
                  // Calculate padding: center based on VISUAL (scaled) height, or fixed border when top-aligned
                  paddingTop: shouldCenter
                    ? `${Math.max(0, (containerHeight - finalIframeHeight * (zoom / 100)) / 2)}px`
                    : `${CANVAS_BORDER}px`,
                  position: 'relative',
                }}
              >
                <div
                  className="bg-white shadow-3xl relative"
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top center', // Always scale from top
                    width: viewportSizes[viewportMode].width,
                    height: `${finalIframeHeight}px`,
                    flexShrink: 0, // Prevent shrinking - maintain fixed size
                    // GPU optimization hints
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                    // No transition to prevent shifts
                    transition: 'none',
                  }}
                >
                  {/* Canvas for editor */}
                  {layers.length > 0 ? (
                    <>
                      <Canvas
                        key={`editor-${currentPageId}`}
                        layers={layers}
                        components={components}
                        selectedLayerId={selectedLayerId}
                        hoveredLayerId={hoveredLayerId}
                        breakpoint={viewportMode}
                        activeUIState={activeUIState}
                        editingComponentId={editingComponentId || null}
                        collectionItems={{ ...collectionItemsFromStore, ...referencedItems }}
                        collectionFields={collectionFieldsFromStore}
                        pageCollectionItem={pageCollectionItem}
                        pageCollectionFields={pageCollectionFields}
                        assets={assetsMap}
                        collectionLayerData={collectionLayerData}
                        pageId={currentPageId || ''}
                        onLayerClick={handleCanvasLayerClick}
                        onLayerUpdate={handleCanvasLayerUpdate}
                        onDeleteLayer={handleCanvasDeleteLayer}
                        onContentHeightChange={setReportedContentHeight}
                        onGapUpdate={handleCanvasGapUpdate}
                        onZoomGesture={handleZoomGesture}
                        onZoomIn={zoomIn}
                        onZoomOut={zoomOut}
                        onResetZoom={resetZoom}
                        onZoomToFit={zoomToFit}
                        onAutofit={autofit}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        liveLayerUpdates={liveLayerUpdates}
                        liveComponentUpdates={liveComponentUpdates}
                        onIframeReady={handleIframeReady}
                        onLayerHover={handleCanvasLayerHover}
                        onCanvasClick={handleCanvasClick}
                        editingComponentVariables={editingComponentVariables}
                        disableEditorHiddenLayers={!!activeInteractionTriggerLayerId}
                      />

                      {/* Drop indicator overlay - subscribes to store directly */}
                      <CanvasDropIndicatorOverlay iframeElement={canvasIframeElement} />

                      {/* Sibling reorder indicator overlay - for drag-to-reorder on canvas */}
                      <CanvasSiblingReorderOverlay iframeElement={canvasIframeElement} />

                      {/* Empty overlay when only Body with no children */}
                      {isCanvasEmpty && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                          <div className="pointer-events-auto">
                            <Empty className="bg-transparent border-0 text-neutral-900">
                              <EmptyContent>
                                <EmptyMedia variant="icon" className="size-9 mb-0 bg-neutral-900/5">
                                  <Icon name="layout" className="size-3 text-neutral-900" />
                                </EmptyMedia>
                                <EmptyHeader>
                                  <EmptyTitle className="text-sm">Start building</EmptyTitle>
                                  <EmptyDescription>
                                    Add your first block to begin creating your page.
                                  </EmptyDescription>
                                </EmptyHeader>
                                <Button
                                  onClick={(e) => {
                                    // Stop propagation to prevent canvas click handler from
                                    // dispatching closeElementLibrary and immediately closing the panel
                                    e.stopPropagation();
                                    // Open ElementLibrary with layouts tab active
                                    window.dispatchEvent(new CustomEvent('toggleElementLibrary', {
                                      detail: { tab: 'layouts' }
                                    }));
                                  }}
                                  size="sm"
                                  variant="secondary"
                                  className="bg-neutral-900/5 hover:bg-neutral-900/10 text-neutral-900"
                                >
                                  <Icon name="plus" />
                                  Add layout
                                </Button>
                              </EmptyContent>
                            </Empty>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-12">
                      <div className="text-center max-w-md relative">
                        <div className="w-20 h-20 bg-linear-to-br from-blue-100 to-blue-50 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                          <Icon name="layout" className="w-10 h-10 text-blue-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">
                          Start building
                        </h2>
                        <p className="text-gray-600 mb-8">
                          Add your first block to begin creating your page.
                        </p>
                        <div className="relative inline-block">
                          <Button
                            onClick={() => setShowAddBlockPanel(!showAddBlockPanel)}
                            size="lg"
                            className="gap-2"
                          >
                            <Icon name="plus" className="w-5 h-5" />
                            Add Block
                          </Button>

                          {/* Add Block Panel */}
                          {showAddBlockPanel && currentPageId && (
                            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl min-w-60">
                              <div className="p-2">
                                <div className="text-xs text-gray-500 px-3 py-2 mb-1 font-medium">Choose a block</div>

                                <Button
                                  onClick={() => {
                                    // Always add inside Body container
                                    const result = addLayerFromTemplate(currentPageId, 'body', 'div');
                                    if (result && liveLayerUpdates) {
                                      // Get FRESH state and find actual parent
                                      const freshDraft = usePagesStore.getState().draftsByPageId[currentPageId];
                                      if (freshDraft) {
                                        const findLayerWithParent = (layers: Layer[], id: string, parent: Layer | null = null): { layer: Layer; parent: Layer | null } | null => {
                                          for (const l of layers) {
                                            if (l.id === id) return { layer: l, parent };
                                            if (l.children) {
                                              const found = findLayerWithParent(l.children, id, l);
                                              if (found) return found;
                                            }
                                          }
                                          return null;
                                        };
                                        const found = findLayerWithParent(freshDraft.layers, result.newLayerId);
                                        if (found?.layer) {
                                          const actualParentId = found.parent?.id || null;
                                          liveLayerUpdates.broadcastLayerAdd(currentPageId, actualParentId, 'div', found.layer);
                                        }
                                      }
                                    }
                                    setShowAddBlockPanel(false);
                                  }}
                                  variant="ghost"
                                  className="w-full justify-start gap-3 px-3 py-3 h-auto"
                                >
                                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Icon name="container" className="w-5 h-5 text-gray-700" />
                                  </div>
                                  <div className="text-left">
                                    <div className="text-sm font-semibold text-gray-900">Div</div>
                                    <div className="text-xs text-gray-500">Container element</div>
                                  </div>
                                </Button>

                                <Button
                                  onClick={() => {
                                    // Always add inside Body container
                                    const result = addLayerFromTemplate(currentPageId, 'body', 'heading');
                                    if (result && liveLayerUpdates) {
                                      // Get FRESH state and find actual parent
                                      const freshDraft = usePagesStore.getState().draftsByPageId[currentPageId];
                                      if (freshDraft) {
                                        const findLayerWithParent = (layers: Layer[], id: string, parent: Layer | null = null): { layer: Layer; parent: Layer | null } | null => {
                                          for (const l of layers) {
                                            if (l.id === id) return { layer: l, parent };
                                            if (l.children) {
                                              const found = findLayerWithParent(l.children, id, l);
                                              if (found) return found;
                                            }
                                          }
                                          return null;
                                        };
                                        const found = findLayerWithParent(freshDraft.layers, result.newLayerId);
                                        if (found?.layer) {
                                          const actualParentId = found.parent?.id || null;
                                          liveLayerUpdates.broadcastLayerAdd(currentPageId, actualParentId, 'heading', found.layer);
                                        }
                                      }
                                    }
                                    setShowAddBlockPanel(false);
                                  }}
                                  variant="ghost"
                                  className="w-full justify-start gap-3 px-3 py-3 h-auto"
                                >
                                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Icon name="heading" className="w-5 h-5 text-gray-700" />
                                  </div>
                                  <div className="text-left">
                                    <div className="text-sm font-semibold text-gray-900">Heading</div>
                                    <div className="text-xs text-gray-500">Title text</div>
                                  </div>
                                </Button>

                                <Button
                                  onClick={() => {
                                    // Always add inside Body container
                                    const result = addLayerFromTemplate(currentPageId, 'body', 'text');
                                    if (result && liveLayerUpdates) {
                                      // Get FRESH state and find actual parent
                                      const freshDraft = usePagesStore.getState().draftsByPageId[currentPageId];
                                      if (freshDraft) {
                                        const findLayerWithParent = (layers: Layer[], id: string, parent: Layer | null = null): { layer: Layer; parent: Layer | null } | null => {
                                          for (const l of layers) {
                                            if (l.id === id) return { layer: l, parent };
                                            if (l.children) {
                                              const found = findLayerWithParent(l.children, id, l);
                                              if (found) return found;
                                            }
                                          }
                                          return null;
                                        };
                                        const found = findLayerWithParent(freshDraft.layers, result.newLayerId);
                                        if (found?.layer) {
                                          const actualParentId = found.parent?.id || null;
                                          liveLayerUpdates.broadcastLayerAdd(currentPageId, actualParentId, 'text', found.layer);
                                        }
                                      }
                                    }
                                    setShowAddBlockPanel(false);
                                  }}
                                  variant="ghost"
                                  className="w-full justify-start gap-3 px-3 py-3 h-auto"
                                >
                                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Icon name="type" className="w-5 h-5 text-gray-700" />
                                  </div>
                                  <div className="text-left">
                                    <div className="text-sm font-semibold text-gray-900">Paragraph</div>
                                    <div className="text-xs text-gray-500">Body text</div>
                                  </div>
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default CenterCanvas;
