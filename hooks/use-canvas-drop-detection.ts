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
 */

import { useRef, useEffect } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { findLayerById, canHaveChildren } from '@/lib/layer-utils';
import { calculateDropPosition, validateDrop, getDropTargetDisplayName } from '@/lib/drop-utils';
import type { Layer } from '@/types';
import type { CanvasDropTarget } from '@/stores/useEditorStore';

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
  onDrop?: (elementType: string, source: 'elements' | 'layouts' | 'components', parentId: string | null) => void;
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

  // Use refs to store values that shouldn't trigger effect re-runs
  const iframeRef = useRef(iframeElement);
  const zoomRef = useRef(zoom);
  const layersRef = useRef(layers);
  const onDropRef = useRef(onDrop);
  
  // Track current drop target to avoid unnecessary updates
  const currentTargetRef = useRef<{ layerId: string; position: string } | null>(null);
  
  // RAF handle for cleanup
  const rafRef = useRef<number | null>(null);

  // Update refs when props change
  useEffect(() => {
    iframeRef.current = iframeElement;
  }, [iframeElement]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  // Main drag effect
  useEffect(() => {
    if (!isDraggingToCanvas) {
      currentTargetRef.current = null;
      return;
    }

    const updateCanvasDropTarget = useEditorStore.getState().updateCanvasDropTarget;
    const endCanvasDrag = useEditorStore.getState().endCanvasDrag;

    const performHitTest = (clientX: number, clientY: number) => {
      const iframe = iframeRef.current;
      const currentZoom = zoomRef.current;
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

      const iframeRect = iframe.getBoundingClientRect();
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
      // getBoundingClientRect returns visual (scaled) coordinates
      // We need to convert to internal iframe coordinates
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

      // Find the target layer in our data
      const targetLayer = findLayerById(currentLayers, layerId);
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
        onDropRef.current(currentElementType, currentElementSource, currentDropTarget.parentId);
      }
      
      // Clear state
      currentTargetRef.current = null;
      updateCanvasDropTarget(null);
      endCanvasDrag();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key cancels drag
      if (e.key === 'Escape') {
        currentTargetRef.current = null;
        updateCanvasDropTarget(null);
        endCanvasDrag();
      }
    };

    // Add listeners
    document.addEventListener('mousemove', handleMouseMove);
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
