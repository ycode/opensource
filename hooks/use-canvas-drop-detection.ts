'use client';

/**
 * useCanvasDropDetection Hook
 * 
 * Handles throttled hit-testing for drag-and-drop from ElementLibrary to Canvas.
 * Listens to global mousemove events during drag and detects drop targets
 * inside the canvas iframe.
 * 
 * Performance optimizations:
 * - Uses refs to avoid re-creating callbacks
 * - Only updates store when drop target actually changes
 * - Uses requestAnimationFrame for smooth throttling
 * - Caches iframe rect during drag (doesn't change)
 * - Builds layer lookup Map for O(1) layer access
 * - Skips processing for minimal mouse movements
 */

import { useRef, useEffect, useMemo } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { canHaveChildren } from '@/lib/layer-utils';
import { calculateDropPosition, validateDrop, getDropTargetDisplayName } from '@/lib/drop-utils';
import type { Layer } from '@/types';
import type { CanvasDropTarget } from '@/stores/useEditorStore';

// Minimum pixel movement required to trigger hit-testing
const MOVEMENT_THRESHOLD = 2;

interface UseCanvasDropDetectionOptions {
  /** Reference to the canvas iframe element */
  iframeElement: HTMLIFrameElement | null;
  /** Current zoom level (percentage) */
  zoom: number;
  /** Current layers in the canvas */
  layers: Layer[];
  /** Current page ID */
  pageId: string | null;
  /** Callback when an element should be added */
  onDrop?: (elementType: string, source: 'elements' | 'layouts' | 'components', dropTarget: CanvasDropTarget) => void;
}

/**
 * Build a Map for O(1) layer lookup by ID
 */
function buildLayerMap(layers: Layer[]): Map<string, Layer> {
  const map = new Map<string, Layer>();
  
  const traverse = (layerList: Layer[]) => {
    for (const layer of layerList) {
      map.set(layer.id, layer);
      if (layer.children && layer.children.length > 0) {
        traverse(layer.children);
      }
    }
  };
  
  traverse(layers);
  return map;
}

export function useCanvasDropDetection({
  iframeElement,
  zoom,
  layers,
  pageId,
  onDrop,
}: UseCanvasDropDetectionOptions) {
  const isDraggingToCanvas = useEditorStore((state) => state.isDraggingToCanvas);
  const canvasDropTarget = useEditorStore((state) => state.canvasDropTarget);

  // Build layer lookup map - O(1) access instead of O(n) tree traversal
  const layerMap = useMemo(() => buildLayerMap(layers), [layers]);

  // Use refs to store values that shouldn't trigger effect re-runs
  const iframeRef = useRef(iframeElement);
  const zoomRef = useRef(zoom);
  const layersRef = useRef(layers);
  const layerMapRef = useRef(layerMap);
  const onDropRef = useRef(onDrop);
  
  // Track current drop target to avoid unnecessary updates
  const currentTargetRef = useRef<{ layerId: string; position: string } | null>(null);
  
  // Cache iframe rect during drag (it doesn't change)
  const cachedIframeRectRef = useRef<DOMRect | null>(null);
  
  // Track last mouse position for movement threshold
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  
  // RAF handle for cleanup
  const rafRef = useRef<number | null>(null);

  // Update refs when props change
  useEffect(() => {
    iframeRef.current = iframeElement;
    // Invalidate cached rect when iframe changes
    cachedIframeRectRef.current = null;
  }, [iframeElement]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    layersRef.current = layers;
    layerMapRef.current = layerMap;
  }, [layers, layerMap]);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  // Main drag effect
  useEffect(() => {
    if (!isDraggingToCanvas) {
      currentTargetRef.current = null;
      // Clear cached values when drag ends
      cachedIframeRectRef.current = null;
      lastMousePosRef.current = null;
      return;
    }

    const updateCanvasDropTarget = useEditorStore.getState().updateCanvasDropTarget;
    const endCanvasDrag = useEditorStore.getState().endCanvasDrag;

    const performHitTest = (clientX: number, clientY: number) => {
      const iframe = iframeRef.current;
      const currentZoom = zoomRef.current;
      const currentLayerMap = layerMapRef.current;
      const currentLayers = layersRef.current;
      
      if (!iframe) {
        return;
      }

      const state = useEditorStore.getState();
      const dragElementType = state.dragElementType;
      
      if (!dragElementType) {
        return;
      }

      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) {
        return;
      }

      // Use cached iframe rect or compute and cache it
      if (!cachedIframeRectRef.current) {
        cachedIframeRectRef.current = iframe.getBoundingClientRect();
      }
      const iframeRect = cachedIframeRectRef.current;
      const scale = currentZoom / 100;

      // Check if cursor is over the iframe
      const isOverIframe =
        clientX >= iframeRect.left &&
        clientX <= iframeRect.right &&
        clientY >= iframeRect.top &&
        clientY <= iframeRect.bottom;

      if (!isOverIframe) {
        if (currentTargetRef.current !== null) {
          currentTargetRef.current = null;
          updateCanvasDropTarget(null);
        }
        return;
      }

      // Convert to iframe coordinates (accounting for zoom)
      const iframeX = (clientX - iframeRect.left) / scale;
      const iframeY = (clientY - iframeRect.top) / scale;

      // elementFromPoint uses viewport coordinates within the iframe
      const element = iframeDoc.elementFromPoint(iframeX, iframeY);
      const layerElement = element?.closest('[data-layer-id]') as HTMLElement | null;
      const layerId = layerElement?.getAttribute('data-layer-id');

      if (!layerId || !layerElement) {
        if (currentTargetRef.current !== null) {
          currentTargetRef.current = null;
          updateCanvasDropTarget(null);
        }
        return;
      }

      // Calculate relative Y position within the element
      const rect = layerElement.getBoundingClientRect();
      const relativeY = (iframeY - rect.top) / rect.height;

      // O(1) layer lookup using Map instead of O(n) tree traversal
      const targetLayer = currentLayerMap.get(layerId);
      if (!targetLayer) {
        if (currentTargetRef.current !== null) {
          currentTargetRef.current = null;
          updateCanvasDropTarget(null);
        }
        return;
      }

      // Use shared calculation (same thresholds as LayersTree)
      const isDraggingSection = dragElementType === 'section';
      const targetCanHaveChildren = canHaveChildren(targetLayer);
      const targetHasVisibleChildren = !!(targetLayer.children && targetLayer.children.length > 0);
      const isTargetBody = layerId === 'body' || targetLayer.name === 'body';

      const position = calculateDropPosition(
        relativeY,
        targetCanHaveChildren,
        targetHasVisibleChildren,
        isDraggingSection,
        isTargetBody
      );

      // Validate using shared logic
      const validation = validateDrop(currentLayers, layerId, position, dragElementType);

      if (!validation.isValid) {
        if (currentTargetRef.current !== null) {
          currentTargetRef.current = null;
          updateCanvasDropTarget(null);
        }
        return;
      }

      // Only update if target changed
      const newTargetKey = `${layerId}:${position}`;
      const currentTargetKey = currentTargetRef.current 
        ? `${currentTargetRef.current.layerId}:${currentTargetRef.current.position}` 
        : null;
      
      if (newTargetKey !== currentTargetKey) {
        currentTargetRef.current = { layerId, position };
        
        // Get display name for the label
        const targetDisplayName = getDropTargetDisplayName(targetLayer);

        updateCanvasDropTarget({
          layerId,
          position,
          parentId: validation.targetParentId,
          targetDisplayName,
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Check movement threshold - skip if mouse hasn't moved enough
      const lastPos = lastMousePosRef.current;
      if (lastPos) {
        const dx = Math.abs(e.clientX - lastPos.x);
        const dy = Math.abs(e.clientY - lastPos.y);
        if (dx < MOVEMENT_THRESHOLD && dy < MOVEMENT_THRESHOLD) {
          return; // Skip processing for minimal movement
        }
      }
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      
      // Cancel any pending RAF
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      
      // Schedule hit test on next frame
      rafRef.current = requestAnimationFrame(() => {
        performHitTest(e.clientX, e.clientY);
        rafRef.current = null;
      });
    };

    const handleMouseUp = () => {
      // Read fresh state from store
      const state = useEditorStore.getState();
      const currentDropTarget = state.canvasDropTarget;
      const currentElementType = state.dragElementType;
      const currentElementSource = state.dragElementSource;
      
      // Handle drop
      if (currentDropTarget && onDropRef.current && currentElementType && currentElementSource) {
        onDropRef.current(currentElementType, currentElementSource, currentDropTarget);
      }
      
      // Clear state
      currentTargetRef.current = null;
      cachedIframeRectRef.current = null;
      lastMousePosRef.current = null;
      updateCanvasDropTarget(null);
      endCanvasDrag();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key cancels drag
      if (e.key === 'Escape') {
        currentTargetRef.current = null;
        cachedIframeRectRef.current = null;
        lastMousePosRef.current = null;
        updateCanvasDropTarget(null);
        endCanvasDrag();
      }
    };

    // Add listeners
    // Use passive: true for mousemove to improve scroll performance
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      
      // Clean up pending RAF
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isDraggingToCanvas]);

  return {
    isDragging: isDraggingToCanvas,
    dropTarget: canvasDropTarget,
  };
}
