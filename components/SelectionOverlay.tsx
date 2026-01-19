'use client';

/**
 * SelectionOverlay Component
 *
 * Renders selection, hover, and parent outlines on top of the canvas iframe.
 * Uses direct DOM manipulation for instant updates during scrolling.
 */

import React, { useEffect, useRef, useCallback } from 'react';

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
  const updateAllOutlines = useCallback(() => {
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

    // Update selected outline
    updateOutline(selectedRef.current, selectedLayerId, iframeDoc, iframeElement, containerElement, scale);

    // Update hovered outline (only if different from selected)
    const effectiveHoveredId = hoveredLayerId !== selectedLayerId ? hoveredLayerId : null;
    updateOutline(hoveredRef.current, effectiveHoveredId, iframeDoc, iframeElement, containerElement, scale);

    // Update parent outline (only if different from selected)
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
        updateAllOutlines();
      }, 150);
    };

    // MutationObserver for DOM changes inside iframe
    const mutationObserver = new MutationObserver(() => {
      updateAllOutlines();
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
    window.addEventListener('resize', handleScroll, { passive: true });

    // Cleanup
    return () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      mutationObserver.disconnect();
      containerElement.removeEventListener('scroll', handleScroll);
      iframeDoc.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [iframeElement, containerElement, updateAllOutlines]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {/* Parent outline (dashed) */}
      <div
        ref={parentRef}
        className="absolute outline outline-1 outline-dashed outline-blue-400"
        style={{ display: 'none' }}
      />

      {/* Hover outline */}
      <div
        ref={hoveredRef}
        className="absolute outline outline-1 outline-blue-400/50"
        style={{ display: 'none' }}
      />

      {/* Selection outline */}
      <div
        ref={selectedRef}
        className="absolute outline outline-1 outline-blue-500"
        style={{ display: 'none' }}
      />
    </div>
  );
}

export default SelectionOverlay;
