'use client';

/**
 * useCanvasSiblingReorder Hook
 * 
 * Handles drag-and-drop reordering of sibling layers on the canvas.
 * Constrained to only allow reordering within the same parent container.
 * 
 * Features:
 * - Initiates drag from mousedown on selected layer in iframe
 * - Only detects siblings as valid drop targets
 * - Above/below positioning based on 50% vertical threshold
 * - Cannot move to different parents or nest into children
 * 
 * Performance optimizations (matching use-canvas-drop-detection):
 * - Uses refs to avoid re-creating callbacks
 * - Only updates store when drop target actually changes
 * - Uses requestAnimationFrame for smooth throttling
 * - Caches iframe rect during drag
 * - Builds sibling ID set for O(1) validation
 * - Skips processing for minimal mouse movements
 */

import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { findLayerById, getSiblingIds, reorderSiblings } from '@/lib/layer-utils';
import type { Layer } from '@/types';

// Minimum pixel movement required to trigger hit-testing
const MOVEMENT_THRESHOLD = 2;

// Minimum pixels to move before starting a drag
const DRAG_THRESHOLD = 5;

// Hysteresis zone around the 50% threshold to prevent oscillation
// Position only changes if cursor moves past this threshold from current position
const HYSTERESIS_PERCENT = 0.15; // 15% dead zone

/**
 * Get sibling layer info for a given layer ID
 */
function getSiblingInfo(layers: Layer[], layerId: string): { originalIndex: number; siblingIds: string[]; parentId: string | null } | null {
  const findInChildren = (children: Layer[], targetId: string, parentId: string | null): { originalIndex: number; siblingIds: string[]; parentId: string | null } | null => {
    for (let i = 0; i < children.length; i++) {
      if (children[i].id === targetId) {
        const siblingIds = children.map(c => c.id);
        return { originalIndex: i, siblingIds, parentId };
      }
      if (children[i].children) {
        const result = findInChildren(children[i].children!, targetId, children[i].id);
        if (result) return result;
      }
    }
    return null;
  };

  for (let i = 0; i < layers.length; i++) {
    if (layers[i].id === layerId) {
      const siblingIds = layers.map(l => l.id);
      return { originalIndex: i, siblingIds, parentId: null };
    }
    if (layers[i].children) {
      const result = findInChildren(layers[i].children!, layerId, layers[i].id);
      if (result) return result;
    }
  }
  return null;
}

interface UseCanvasSiblingReorderOptions {
  /** Reference to the canvas iframe element */
  iframeElement: HTMLIFrameElement | null;
  /** Current zoom level (percentage) */
  zoom: number;
  /** Current layers in the canvas */
  layers: Layer[];
  /** Current page ID */
  pageId: string | null;
  /** Currently selected layer ID (for drag initiation) */
  selectedLayerId: string | null;
  /** Callback when layers are reordered */
  onReorder?: (newLayers: Layer[]) => void;
  /** Callback when a layer is selected (for drag-to-select) */
  onLayerSelect?: (layerId: string) => void;
}

export function useCanvasSiblingReorder({
  iframeElement,
  zoom,
  layers,
  pageId,
  selectedLayerId,
  onReorder,
  onLayerSelect,
}: UseCanvasSiblingReorderOptions) {
  const isDraggingLayerOnCanvas = useEditorStore((state) => state.isDraggingLayerOnCanvas);
  const draggedLayerId = useEditorStore((state) => state.draggedLayerId);
  const draggedLayerParentId = useEditorStore((state) => state.draggedLayerParentId);
  const canvasSiblingDropTarget = useEditorStore((state) => state.canvasSiblingDropTarget);

  // Build sibling ID set for O(1) lookup
  const siblingIds = useMemo(() => {
    if (!draggedLayerId) return new Set<string>();
    return new Set(getSiblingIds(layers, draggedLayerId));
  }, [layers, draggedLayerId]);

  // Drag initiation state
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isPotentialDragRef = useRef(false);
  const hasDragStartedRef = useRef(false);
  
  // Hit-testing state
  const currentDropTargetRef = useRef<{ layerId: string; position: 'above' | 'below' } | null>(null);
  
  // RAF-based throttling for smooth hit-testing
  const rafRef = useRef<number | null>(null);
  const pendingHitTestRef = useRef<{ x: number; y: number } | null>(null);
  
  // Cache of original sibling positions (captured at drag start, before any transforms)
  // This prevents feedback loops where shifted elements cause hit-test oscillation
  const cachedSiblingRectsRef = useRef<Map<string, { top: number; bottom: number; height: number }>>(new Map());

  // Store refs for use in event handlers
  const layersRef = useRef(layers);
  const selectedLayerIdRef = useRef(selectedLayerId);
  const onReorderRef = useRef(onReorder);
  const onLayerSelectRef = useRef(onLayerSelect);
  const zoomRef = useRef(zoom);
  const iframeRef = useRef(iframeElement);
  
  // Track the layer being potentially dragged (may differ from selected)
  const potentialDragLayerIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);
  
  useEffect(() => {
    selectedLayerIdRef.current = selectedLayerId;
  }, [selectedLayerId]);
  
  useEffect(() => {
    onReorderRef.current = onReorder;
  }, [onReorder]);
  
  useEffect(() => {
    onLayerSelectRef.current = onLayerSelect;
  }, [onLayerSelect]);
  
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  
  useEffect(() => {
    iframeRef.current = iframeElement;
  }, [iframeElement]);

  // Set up drag initiation from iframe mousedown
  useEffect(() => {
    if (!iframeElement) return;
    
    const iframeDoc = iframeElement.contentDocument;
    if (!iframeDoc) return;

    const handleIframeMouseDown = (e: MouseEvent) => {
      // Check if the click is on any layer (not just selected)
      const target = e.target as HTMLElement;
      const layerElement = target.closest('[data-layer-id]') as HTMLElement | null;
      const clickedLayerId = layerElement?.getAttribute('data-layer-id');
      
      if (!clickedLayerId) {
        // Clicked on something that's not a layer - don't initiate drag
        return;
      }
      
      // Store the layer being potentially dragged
      potentialDragLayerIdRef.current = clickedLayerId;
      
      // Prevent text selection from starting during potential drag
      e.preventDefault();
      
      // Convert iframe coordinates to window coordinates
      const currentIframe = iframeRef.current;
      let startX = e.clientX;
      let startY = e.clientY;
      
      if (currentIframe) {
        const iframeRect = currentIframe.getBoundingClientRect();
        const scale = zoomRef.current / 100;
        startX = iframeRect.left + (e.clientX * scale);
        startY = iframeRect.top + (e.clientY * scale);
      }
      
      // Store start position in WINDOW coordinates for threshold check
      dragStartPosRef.current = { x: startX, y: startY };
      isPotentialDragRef.current = true;
      hasDragStartedRef.current = false;
    };

    const handleDocumentMouseMove = (e: MouseEvent) => {
      // Convert coordinates to window space if event came from iframe
      let clientX = e.clientX;
      let clientY = e.clientY;
      
      // Check if event came from iframe document
      const eventDoc = e.target && (e.target as Node).ownerDocument;
      const isFromIframe = eventDoc !== document;
      
      if (isFromIframe) {
        // Event is in iframe coordinates - convert to window coordinates
        const currentIframe = iframeRef.current;
        if (currentIframe) {
          const iframeRect = currentIframe.getBoundingClientRect();
          const scale = zoomRef.current / 100;
          clientX = iframeRect.left + (e.clientX * scale);
          clientY = iframeRect.top + (e.clientY * scale);
        }
      }
      
      // If drag already started, perform hit-testing (RAF-throttled)
      if (hasDragStartedRef.current) {
        // Store the latest position
        pendingHitTestRef.current = { x: clientX, y: clientY };
        
        // Only schedule RAF if not already pending
        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            const pending = pendingHitTestRef.current;
            if (pending) {
              performHitTest(pending.x, pending.y);
            }
          });
        }
        return;
      }
      
      // Otherwise, check for drag initiation
      if (!isPotentialDragRef.current || !dragStartPosRef.current) return;
      
      const dx = Math.abs(clientX - dragStartPosRef.current.x);
      const dy = Math.abs(clientY - dragStartPosRef.current.y);
      
      // Check threshold
      if (dx >= DRAG_THRESHOLD || dy >= DRAG_THRESHOLD) {
        hasDragStartedRef.current = true;
        
        // Clear any text selection that might have started
        const iframeDoc = iframeElement?.contentDocument;
        if (iframeDoc) {
          iframeDoc.getSelection()?.removeAllRanges();
        }
        window.getSelection()?.removeAllRanges();
        
        // Prevent default to stop any ongoing selection
        e.preventDefault();
        
        // Get sibling info and start the drag
        // Use the layer that was clicked (not necessarily the selected one)
        const currentLayers = layersRef.current;
        const dragLayerId = potentialDragLayerIdRef.current;
        
        if (dragLayerId) {
          const siblingInfoData = getSiblingInfo(currentLayers, dragLayerId);
          
          if (siblingInfoData) {
            const layer = findLayerById(currentLayers, dragLayerId);
            const layerName = layer?.name || 'Layer';
            
            // Select the layer being dragged (if not already selected)
            if (onLayerSelectRef.current && dragLayerId !== selectedLayerIdRef.current) {
              onLayerSelectRef.current(dragLayerId);
            }
            
            // Cache original sibling positions BEFORE any transforms are applied
            // This prevents hit-test oscillation from shifted elements
            // IMPORTANT: Convert iframe coords to window coords for comparison with clientX/Y
            const iframeDoc = iframeElement?.contentDocument;
            const currentIframe = iframeRef.current;
            if (iframeDoc && currentIframe) {
              const iframeRect = currentIframe.getBoundingClientRect();
              const scale = zoomRef.current / 100;
              
              cachedSiblingRectsRef.current.clear();
              siblingInfoData.siblingIds.forEach(id => {
                const el = iframeDoc.querySelector(`[data-layer-id="${id}"]`) as HTMLElement;
                if (el) {
                  const rect = el.getBoundingClientRect();
                  // Convert iframe-relative coords to window coords
                  const windowTop = iframeRect.top + (rect.top * scale);
                  const windowBottom = iframeRect.top + (rect.bottom * scale);
                  const windowHeight = rect.height * scale;
                  
                  cachedSiblingRectsRef.current.set(id, {
                    top: windowTop,
                    bottom: windowBottom,
                    height: windowHeight,
                  });
                }
              });
            }
            
            const startCanvasLayerDrag = useEditorStore.getState().startCanvasLayerDrag;
            startCanvasLayerDrag(
              dragLayerId,
              layerName,
              siblingInfoData.parentId,
              siblingInfoData.originalIndex,
              siblingInfoData.siblingIds
            );
            hasDragStartedRef.current = true;
          }
        }
      }
    };
    
    // Hit-testing function for sibling reorder
    // Uses CACHED original positions to prevent feedback loops from shifted elements
    const performHitTest = (clientX: number, clientY: number) => {
      const currentIframe = iframeRef.current;
      const currentZoom = zoomRef.current;
      
      if (!currentIframe) return;
      
      const state = useEditorStore.getState();
      const currentDraggedLayerId = state.draggedLayerId;
      const siblingIdsArray = state.siblingLayerIds;
      const originalIndex = state.draggedLayerOriginalIndex ?? 0;
      
      if (!currentDraggedLayerId || siblingIdsArray.length === 0) return;
      
      // Get fresh iframe rect (this doesn't change during drag)
      const iframeRect = currentIframe.getBoundingClientRect();
      const scale = currentZoom / 100;
      
      // Check if cursor is over the iframe
      const isOverIframe = clientX >= iframeRect.left && 
                           clientX <= iframeRect.right && 
                           clientY >= iframeRect.top && 
                           clientY <= iframeRect.bottom;
      
      // If not over iframe, keep the last valid drop target (free drag behavior)
      // The drop target is only cleared on explicit drag end or escape
      if (!isOverIframe) {
        return;
      }
      
      // Use CACHED original positions for hit-testing (not live DOM)
      // This prevents oscillation caused by shifted elements changing their bounds
      const cachedRects = cachedSiblingRectsRef.current;
      if (cachedRects.size === 0) {
        return; // No cached positions yet
      }
      
      // Find which sibling the cursor is over using cached positions
      let matchedLayerId: string | null = null;
      let matchedPosition: 'above' | 'below' = 'below';
      
      for (let i = 0; i < siblingIdsArray.length; i++) {
        const siblingId = siblingIdsArray[i];
        
        // Skip the dragged element
        if (siblingId === currentDraggedLayerId) continue;
        
        const cachedRect = cachedRects.get(siblingId);
        if (!cachedRect) continue;
        
        // Check if cursor Y is within this element's cached bounds
        if (clientY >= cachedRect.top && clientY <= cachedRect.bottom) {
          matchedLayerId = siblingId;
          
          // Calculate above/below with hysteresis to prevent oscillation
          const relativeY = (clientY - cachedRect.top) / cachedRect.height;
          
          // Check current position for this sibling
          const currentTarget = currentDropTargetRef.current;
          const isCurrentTarget = currentTarget?.layerId === siblingId;
          
          if (isCurrentTarget) {
            // Apply hysteresis - only change if we've moved significantly past the threshold
            const currentPosition = currentTarget.position;
            if (currentPosition === 'above') {
              // Currently above - only switch to below if past 50% + hysteresis
              matchedPosition = relativeY > (0.5 + HYSTERESIS_PERCENT) ? 'below' : 'above';
            } else {
              // Currently below - only switch to above if past 50% - hysteresis
              matchedPosition = relativeY < (0.5 - HYSTERESIS_PERCENT) ? 'above' : 'below';
            }
          } else {
            // New target - use simple 50% threshold
            matchedPosition = relativeY < 0.5 ? 'above' : 'below';
          }
          break;
        }
      }
      
      // If cursor is not directly over a sibling, keep the last valid drop target (free drag behavior)
      // This allows the user to drag freely anywhere while the dropzone stays stable
      if (!matchedLayerId) {
        return;
      }
      
      // Calculate projected index
      const targetIndex = siblingIdsArray.indexOf(matchedLayerId);
      
      let projectedIndex: number;
      if (targetIndex === -1) {
        projectedIndex = matchedPosition === 'above' ? 0 : siblingIdsArray.length;
      } else {
        if (matchedPosition === 'above') {
          projectedIndex = targetIndex;
        } else {
          projectedIndex = targetIndex + 1;
        }
        if (originalIndex < projectedIndex) {
          projectedIndex = projectedIndex - 1;
        }
      }
      
      // Only update if target changed
      const newTargetKey = `${matchedLayerId}:${matchedPosition}`;
      const currentTargetKey = currentDropTargetRef.current 
        ? `${currentDropTargetRef.current.layerId}:${currentDropTargetRef.current.position}` 
        : null;
      
      if (newTargetKey !== currentTargetKey) {
        currentDropTargetRef.current = { layerId: matchedLayerId, position: matchedPosition };
        useEditorStore.getState().updateCanvasSiblingDropTarget({ layerId: matchedLayerId, position: matchedPosition, projectedIndex });
      }
    };

    const handleDocumentMouseUp = () => {
      // Reset potential drag state
      isPotentialDragRef.current = false;
      dragStartPosRef.current = null;
      potentialDragLayerIdRef.current = null;
      
      // If a drag was actually started, end it now
      if (hasDragStartedRef.current) {
        hasDragStartedRef.current = false;
        
        // Read fresh state and handle drop
        const state = useEditorStore.getState();
        const { endCanvasLayerDrag, updateCanvasSiblingDropTarget } = state;
        const currentDropTarget = state.canvasSiblingDropTarget;
        const currentDraggedLayerId = state.draggedLayerId;
        const currentLayers = layersRef.current;
        const onReorderCallback = onReorderRef.current;
        
        // Handle drop - reorder siblings if we have a valid target
        if (currentDropTarget && currentDraggedLayerId && onReorderCallback) {
          const newLayers = reorderSiblings(
            currentLayers,
            currentDraggedLayerId,
            currentDropTarget.layerId,
            currentDropTarget.position
          );
          onReorderCallback(newLayers);
        }
        
        // Clear all state
        currentDropTargetRef.current = null;
        cachedSiblingRectsRef.current.clear();
        updateCanvasSiblingDropTarget(null);
        endCanvasLayerDrag();
      }
      
      hasDragStartedRef.current = false;
    };

    // Prevent text selection during potential drag
    const handleSelectStart = (e: Event) => {
      if (isPotentialDragRef.current) {
        e.preventDefault();
      }
    };

    // Listen to mousedown in iframe
    iframeDoc.addEventListener('mousedown', handleIframeMouseDown);
    // Listen to mousemove and mouseup on BOTH documents
    // (iframe events don't bubble to parent document)
    iframeDoc.addEventListener('mousemove', handleDocumentMouseMove);
    iframeDoc.addEventListener('mouseup', handleDocumentMouseUp);
    iframeDoc.addEventListener('selectstart', handleSelectStart);
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);

    return () => {
      iframeDoc.removeEventListener('mousedown', handleIframeMouseDown);
      iframeDoc.removeEventListener('mousemove', handleDocumentMouseMove);
      iframeDoc.removeEventListener('mouseup', handleDocumentMouseUp);
      iframeDoc.removeEventListener('selectstart', handleSelectStart);
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
      
      // Cancel any pending RAF
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [iframeElement]);

  // Cleanup effect - reset state when drag is cancelled externally (e.g., Escape key)
  useEffect(() => {
    if (!isDraggingLayerOnCanvas) {
      // Clear local refs when drag ends
      currentDropTargetRef.current = null;
      pendingHitTestRef.current = null;
      cachedSiblingRectsRef.current.clear();
      
      // Cancel any pending RAF
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }
  }, [isDraggingLayerOnCanvas]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && hasDragStartedRef.current) {
        hasDragStartedRef.current = false;
        isPotentialDragRef.current = false;
        dragStartPosRef.current = null;
        potentialDragLayerIdRef.current = null;
        currentDropTargetRef.current = null;
        cachedSiblingRectsRef.current.clear();
        
        const { updateCanvasSiblingDropTarget, endCanvasLayerDrag } = useEditorStore.getState();
        updateCanvasSiblingDropTarget(null);
        endCanvasLayerDrag();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isDragging: isDraggingLayerOnCanvas,
    draggedLayerId,
    draggedLayerParentId,
    dropTarget: canvasSiblingDropTarget,
  };
}
