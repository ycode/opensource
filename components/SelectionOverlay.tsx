'use client';

/**
 * SelectionOverlay Component
 *
 * Renders selection, hover, and parent outlines on top of the canvas iframe.
 * This approach ensures outlines are always visible above other UI elements
 * like the ElementLibrary panel.
 */

import React, { useEffect, useState, useCallback, useLayoutEffect } from 'react';

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

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function SelectionOverlay({
  iframeElement,
  containerElement,
  selectedLayerId,
  hoveredLayerId,
  parentLayerId,
  zoom,
}: SelectionOverlayProps) {
  const [selectedRect, setSelectedRect] = useState<Rect | null>(null);
  const [hoveredRect, setHoveredRect] = useState<Rect | null>(null);
  const [parentRect, setParentRect] = useState<Rect | null>(null);

  // Calculate the position of an element inside the iframe relative to the container
  const calculateRect = useCallback((
    layerId: string,
    iframeDoc: Document,
    iframeElement: HTMLIFrameElement,
    containerElement: HTMLElement
  ): Rect | null => {
    // Find the element inside the iframe
    const element = iframeDoc.querySelector(`[data-layer-id="${layerId}"]`) as HTMLElement;
    if (!element) return null;

    // Get the element's bounding rect inside the iframe
    const elementRect = element.getBoundingClientRect();

    // Get the iframe's position relative to the container
    const iframeRect = iframeElement.getBoundingClientRect();
    const containerRect = containerElement.getBoundingClientRect();

    // Calculate position relative to container, accounting for zoom
    const scale = zoom / 100;

    return {
      top: iframeRect.top - containerRect.top + (elementRect.top * scale),
      left: iframeRect.left - containerRect.left + (elementRect.left * scale),
      width: elementRect.width * scale,
      height: elementRect.height * scale,
    };
  }, [zoom]);

  // Update all rectangles
  const updateRects = useCallback(() => {
    if (!iframeElement || !containerElement) {
      setSelectedRect(null);
      setHoveredRect(null);
      setParentRect(null);
      return;
    }

    const iframeDoc = iframeElement.contentDocument;
    if (!iframeDoc) {
      setSelectedRect(null);
      setHoveredRect(null);
      setParentRect(null);
      return;
    }

    // Calculate selected rect
    if (selectedLayerId) {
      setSelectedRect(calculateRect(selectedLayerId, iframeDoc, iframeElement, containerElement));
    } else {
      setSelectedRect(null);
    }

    // Calculate hovered rect (only if different from selected)
    if (hoveredLayerId && hoveredLayerId !== selectedLayerId) {
      setHoveredRect(calculateRect(hoveredLayerId, iframeDoc, iframeElement, containerElement));
    } else {
      setHoveredRect(null);
    }

    // Calculate parent rect
    if (parentLayerId && parentLayerId !== selectedLayerId) {
      setParentRect(calculateRect(parentLayerId, iframeDoc, iframeElement, containerElement));
    } else {
      setParentRect(null);
    }
  }, [iframeElement, containerElement, selectedLayerId, hoveredLayerId, parentLayerId, calculateRect]);

  // Use useLayoutEffect for instant updates (no delay)
  useLayoutEffect(() => {
    updateRects();
  }, [updateRects]);

  // Set up observers for continuous updates
  useEffect(() => {
    if (!iframeElement || !containerElement) return;

    const iframeDoc = iframeElement.contentDocument;
    if (!iframeDoc) return;

    // Update on scroll (both container and iframe)
    const handleScroll = () => {
      requestAnimationFrame(updateRects);
    };

    // Update on resize
    const handleResize = () => {
      requestAnimationFrame(updateRects);
    };

    // MutationObserver for DOM changes inside iframe
    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(updateRects);
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

    // Add event listeners
    containerElement.addEventListener('scroll', handleScroll, { passive: true });
    iframeDoc.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    // Cleanup
    return () => {
      mutationObserver.disconnect();
      containerElement.removeEventListener('scroll', handleScroll);
      iframeDoc.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [iframeElement, containerElement, updateRects]);

  // Don't render if no rects to show
  if (!selectedRect && !hoveredRect && !parentRect) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-40"
    >
      {/* Parent outline (dashed) */}
      {parentRect && (
        <div
          className="absolute border border-dashed border-blue-400"
          style={{
            top: parentRect.top,
            left: parentRect.left,
            width: parentRect.width,
            height: parentRect.height,
          }}
        />
      )}

      {/* Hover outline */}
      {hoveredRect && (
        <div
          className="absolute outline outline-1 outline-blue-400/50"
          style={{
            top: hoveredRect.top,
            left: hoveredRect.left,
            width: hoveredRect.width,
            height: hoveredRect.height,
          }}
        />
      )}

      {/* Selection outline */}
      {selectedRect && (
        <div
          className="absolute outline outline-1 outline-blue-500"
          style={{
            top: selectedRect.top,
            left: selectedRect.left,
            width: selectedRect.width,
            height: selectedRect.height,
          }}
        />
      )}
    </div>
  );
}

export default SelectionOverlay;
