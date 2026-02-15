'use client';

/**
 * SelectionOverlay Component
 *
 * Renders selection, hover, and parent outlines on top of the canvas iframe.
 * Uses direct DOM manipulation for instant updates during scrolling.
 * 
 * Note: Drag initiation for sibling reordering is handled by the
 * useCanvasSiblingReorder hook, which listens to iframe mousedown events.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';

interface SelectionOverlayProps {
  /** Reference to the canvas iframe element */
  iframeElement: HTMLIFrameElement | null;
  /** Reference to the container element for positioning */
  containerElement: HTMLElement | null;
  /** Currently selected layer ID */
  selectedLayerId: string | null;
  /** Currently hovered layer ID */
  hoveredLayerId: string | null;
  /** Parent layer ID (one level up from selected) */
  parentLayerId: string | null;
  /** Current zoom level (percentage) */
  zoom: number;
}

export function SelectionOverlay({
  iframeElement,
  containerElement,
  selectedLayerId,
  hoveredLayerId,
  parentLayerId,
  zoom,
}: SelectionOverlayProps) {
  // Refs for direct DOM manipulation (no React re-render needed)
  const selectedRef = useRef<HTMLDivElement>(null);
  const hoveredRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Track drag state for scroll/mutation handlers
  const isDraggingRef = useRef(false);

  // Update a single outline element's position directly via DOM
  const updateOutline = useCallback((
    element: HTMLDivElement | null,
    layerId: string | null,
    iframeDoc: Document,
    iframeElement: HTMLIFrameElement,
    containerElement: HTMLElement,
    scale: number
  ) => {
    if (!element) return;

    if (!layerId) {
      element.style.display = 'none';
      return;
    }

    // Find the element inside the iframe
    const targetElement = iframeDoc.querySelector(`[data-layer-id="${layerId}"]`) as HTMLElement;
    if (!targetElement) {
      element.style.display = 'none';
      return;
    }

    // Get bounding rects
    const elementRect = targetElement.getBoundingClientRect();
    const iframeRect = iframeElement.getBoundingClientRect();
    const containerRect = containerElement.getBoundingClientRect();

    // Calculate position relative to container, accounting for zoom
    const top = iframeRect.top - containerRect.top + (elementRect.top * scale);
    const left = iframeRect.left - containerRect.left + (elementRect.left * scale);
    const width = elementRect.width * scale;
    const height = elementRect.height * scale;

    // Apply styles directly
    element.style.display = 'block';
    element.style.top = `${top}px`;
    element.style.left = `${left}px`;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
  }, []);

  // Update all outlines
  const updateAllOutlines = useCallback((skipSolidBorders = false) => {
    if (!iframeElement || !containerElement) {
      if (selectedRef.current) selectedRef.current.style.display = 'none';
      if (hoveredRef.current) hoveredRef.current.style.display = 'none';
      if (parentRef.current) parentRef.current.style.display = 'none';
      return;
    }

    const iframeDoc = iframeElement.contentDocument;
    if (!iframeDoc) {
      if (selectedRef.current) selectedRef.current.style.display = 'none';
      if (hoveredRef.current) hoveredRef.current.style.display = 'none';
      if (parentRef.current) parentRef.current.style.display = 'none';
      return;
    }

    const scale = zoom / 100;

    // Update selected outline (skip during drag)
    if (!skipSolidBorders) {
      updateOutline(selectedRef.current, selectedLayerId, iframeDoc, iframeElement, containerElement, scale);

      // Update hovered outline (only if different from selected)
      const effectiveHoveredId = hoveredLayerId !== selectedLayerId ? hoveredLayerId : null;
      updateOutline(hoveredRef.current, effectiveHoveredId, iframeDoc, iframeElement, containerElement, scale);
    }

    // Update parent outline (only if different from selected) - always visible
    const effectiveParentId = parentLayerId !== selectedLayerId ? parentLayerId : null;
    updateOutline(parentRef.current, effectiveParentId, iframeDoc, iframeElement, containerElement, scale);
  }, [iframeElement, containerElement, selectedLayerId, hoveredLayerId, parentLayerId, zoom, updateOutline]);

  // Initial update and updates when IDs change
  useEffect(() => {
    updateAllOutlines();
  }, [updateAllOutlines]);

  // Set up scroll/resize/mutation listeners
  useEffect(() => {
    if (!iframeElement || !containerElement) return;

    const iframeDoc = iframeElement.contentDocument;
    if (!iframeDoc) return;

    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;

    // Hide outlines during scroll, show after scroll ends
    const handleScroll = () => {
      // Hide outlines immediately on scroll
      if (selectedRef.current) selectedRef.current.style.display = 'none';
      if (hoveredRef.current) hoveredRef.current.style.display = 'none';
      if (parentRef.current) parentRef.current.style.display = 'none';

      // Clear existing timeout
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }

      // Show outlines after scrolling stops (150ms delay)
      scrollTimeout = setTimeout(() => {
        // Skip solid borders if dragging
        updateAllOutlines(isDraggingRef.current);
      }, 150);
    };

    // MutationObserver for DOM changes inside iframe
    let mutationTimeout: ReturnType<typeof setTimeout> | null = null;
    const mutationObserver = new MutationObserver((mutations) => {
      // Check if any mutation is a structural change (element added/removed)
      const hasStructuralChange = mutations.some(m => m.type === 'childList');

      if (hasStructuralChange) {
        // Hide outlines immediately during structural DOM changes (new element added/removed)
        if (selectedRef.current) selectedRef.current.style.display = 'none';
        if (hoveredRef.current) hoveredRef.current.style.display = 'none';
        if (parentRef.current) parentRef.current.style.display = 'none';

        if (mutationTimeout) clearTimeout(mutationTimeout);

        // Show outlines after DOM settles
        mutationTimeout = setTimeout(() => {
          updateAllOutlines(isDraggingRef.current);
        }, 150);
      } else {
        // Attribute-only changes (class/style) - update immediately
        updateAllOutlines(isDraggingRef.current);
      }
    });

    // Observe the iframe body for changes
    if (iframeDoc.body) {
      mutationObserver.observe(iframeDoc.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
    }

    // Hide outlines during viewport switch, show after transition settles
    let viewportTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleViewportChange = () => {
      // Hide outlines immediately
      if (selectedRef.current) selectedRef.current.style.display = 'none';
      if (hoveredRef.current) hoveredRef.current.style.display = 'none';
      if (parentRef.current) parentRef.current.style.display = 'none';

      if (viewportTimeout) clearTimeout(viewportTimeout);

      // Show outlines after viewport transition settles
      viewportTimeout = setTimeout(() => {
        updateAllOutlines(isDraggingRef.current);
      }, 150);
    };

    // Add event listeners
    containerElement.addEventListener('scroll', handleScroll, { passive: true });
    iframeDoc.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    window.addEventListener('viewportChange', handleViewportChange);

    // Cleanup
    return () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      if (viewportTimeout) clearTimeout(viewportTimeout);
      if (mutationTimeout) clearTimeout(mutationTimeout);
      mutationObserver.disconnect();
      containerElement.removeEventListener('scroll', handleScroll);
      iframeDoc.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      window.removeEventListener('viewportChange', handleViewportChange);
    };
  }, [iframeElement, containerElement, updateAllOutlines]);

  // Check if layer dragging is active (to hide selection during drag)
  const isDraggingLayerOnCanvas = useEditorStore((state) => state.isDraggingLayerOnCanvas);

  // Hide solid selection/hover outlines during drag, but keep dashed parent outline
  useEffect(() => {
    isDraggingRef.current = isDraggingLayerOnCanvas;
    
    if (isDraggingLayerOnCanvas) {
      // Hide solid borders during drag
      if (selectedRef.current) selectedRef.current.style.display = 'none';
      if (hoveredRef.current) hoveredRef.current.style.display = 'none';
      // Keep parent dashed outline visible - update just the parent
      updateAllOutlines(true); // skipSolidBorders = true
    } else {
      // Re-show all outlines when drag ends
      updateAllOutlines(false);
    }
  }, [isDraggingLayerOnCanvas, updateAllOutlines]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {/* Parent outline (dashed) - visible during drag */}
      <div
        ref={parentRef}
        className="absolute outline outline-1 outline-dashed outline-blue-400"
        style={{ display: 'none' }}
      />

      {/* Hover outline - hidden during drag */}
      <div
        ref={hoveredRef}
        className="absolute outline outline-1 outline-blue-400/50"
        style={{ display: 'none' }}
      />

      {/* Selection outline - hidden during drag */}
      <div
        ref={selectedRef}
        className="absolute outline outline-1 outline-blue-500"
        style={{ display: 'none' }}
      />
    </div>
  );
}

export default SelectionOverlay;
