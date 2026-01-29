'use client';

/**
 * DragPreviewPortal Component
 * 
 * Renders a floating drag preview that follows the cursor during:
 * 1. drag-and-drop from ElementLibrary to Canvas (isDraggingToCanvas) - shows pill
 * 2. sibling reordering on canvas (isDraggingLayerOnCanvas) - shows clone of element
 * 
 * For sibling reordering, the original element stays dimmed in place AND a ghost
 * clone follows the cursor freely. This combines both visual feedback patterns.
 * 
 * Uses direct DOM manipulation for smooth 60fps updates instead of React state.
 * Renders as a portal to document.body to ensure it's always on top.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '@/stores/useEditorStore';
import Icon from '@/components/ui/icon';
import { getBlockIcon } from '@/lib/templates/blocks';
import { cloneElementFromIframe } from '@/lib/dom-utils';
import { getIframeScale, iframeToWindowCoords } from '@/lib/iframe-utils';

export function DragPreviewPortal() {
  // Element library drag state
  const isDraggingToCanvas = useEditorStore((state) => state.isDraggingToCanvas);
  const elementName = useEditorStore((state) => state.dragElementName);
  const elementType = useEditorStore((state) => state.dragElementType);
  const elementSource = useEditorStore((state) => state.dragElementSource);
  
  // Sibling reorder drag state
  const isDraggingLayerOnCanvas = useEditorStore((state) => state.isDraggingLayerOnCanvas);
  const draggedLayerId = useEditorStore((state) => state.draggedLayerId);
  const layerDragStartPosition = useEditorStore((state) => state.layerDragStartPosition);
  
  const previewRef = useRef<HTMLDivElement>(null);
  const cloneContainerRef = useRef<HTMLDivElement>(null);
  
  // Cache iframe reference to avoid repeated DOM queries
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  
  // Ref to track cloneSize for mousemove handler (no useState = no re-renders)
  const cloneSizeRef = useRef<{ width: number; height: number } | null>(null);
  
  // Ref to track the initial position of the ghost (in window coordinates)
  const initialPositionRef = useRef<{ x: number; y: number } | null>(null);
  
  // Ref to track the offset between cursor and ghost position (for drag following)
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  
  // Ref to track if we're in sibling reorder mode (avoids stale closure)
  const isDraggingLayerRef = useRef(false);
  
  // Show preview for both drag types
  const isActive = isDraggingToCanvas || isDraggingLayerOnCanvas;
  
  // Keep refs in sync with state (for mousemove handler)
  isDraggingLayerRef.current = isDraggingLayerOnCanvas;
  
  // Cache iframe reference when drag becomes active
  useEffect(() => {
    if (isActive) {
      iframeRef.current = document.querySelector('iframe[title="Canvas Editor"]') as HTMLIFrameElement | null;
    } else {
      iframeRef.current = null;
    }
  }, [isActive]);

  // Track if we've already cloned for this drag session
  const hasClonedRef = useRef(false);
  
  // Clone the actual element when sibling reorder starts
  useEffect(() => {
    if (!isDraggingLayerOnCanvas || !draggedLayerId) {
      hasClonedRef.current = false;
      return;
    }
    
    let rafId: number;
    let attempts = 0;
    const maxAttempts = 10;
    
    // Use requestAnimationFrame to wait for render, with retry logic
    const tryClone = () => {
      attempts++;
      
      // Check if already cloned or max attempts reached
      if (hasClonedRef.current) return;
      if (attempts > maxAttempts) return;
      
      // Wait for refs to be available
      if (!cloneContainerRef.current || !iframeRef.current) {
        rafId = requestAnimationFrame(tryClone);
        return;
      }
      
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument;
      const iframeWindow = iframe.contentWindow;
      if (!iframeDoc || !iframeWindow) {
        rafId = requestAnimationFrame(tryClone);
        return;
      }

      const originalElement = iframeDoc.querySelector(`[data-layer-id="${draggedLayerId}"]`) as HTMLElement | null;
      if (!originalElement) {
        rafId = requestAnimationFrame(tryClone);
        return;
      }

      const rect = originalElement.getBoundingClientRect();
      
      // Get zoom from the parent wrapper's CSS transform
      const scale = getIframeScale(iframe);
      
      // Calculate element's position in WINDOW coordinates
      const coords = iframeToWindowCoords(iframe, rect.left, rect.top);
      const elementWindowX = coords.windowX;
      const elementWindowY = coords.windowY;
      
      // Store the initial position (center of element in window coords)
      const cloneWidth = rect.width * scale;
      const cloneHeight = rect.height * scale;
      initialPositionRef.current = {
        x: elementWindowX + cloneWidth / 2,
        y: elementWindowY + cloneHeight / 2,
      };
      
      // Clone the element with all computed styles
      const clone = cloneElementFromIframe(originalElement, iframeWindow);
      
      // Semi-transparent ghost that follows cursor with subtle shadow for "lift" effect
      clone.style.margin = '0';
      clone.style.position = 'relative';
      clone.style.pointerEvents = 'none';
      clone.style.opacity = '0.7';
      clone.style.filter = 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))';
      
      clone.style.transform = `scale(${scale})`;
      clone.style.transformOrigin = 'top left';
      
      // Set up the container
      cloneContainerRef.current.innerHTML = '';
      cloneContainerRef.current.style.width = `${cloneWidth}px`;
      cloneContainerRef.current.style.height = `${cloneHeight}px`;
      cloneContainerRef.current.style.overflow = 'visible';
      cloneContainerRef.current.appendChild(clone);
      
      const size = { width: cloneWidth, height: cloneHeight };
      cloneSizeRef.current = size;
      hasClonedRef.current = true;
      
      // IMMEDIATELY position the ghost and make it visible (no React state = no re-render issues)
      if (previewRef.current) {
        const transformValue = `translate(${elementWindowX}px, ${elementWindowY}px)`;
        previewRef.current.style.transform = transformValue;
        previewRef.current.style.visibility = 'visible';
        
        // Store the initial ghost position
        initialPositionRef.current = { x: elementWindowX, y: elementWindowY };
        
        // Calculate offset immediately using the stored drag start position
        // This ensures the ghost stays "locked" to where the user grabbed it
        const startPos = useEditorStore.getState().layerDragStartPosition;
        if (startPos) {
          dragOffsetRef.current = {
            x: startPos.x - elementWindowX,
            y: startPos.y - elementWindowY,
          };
        } else {
          dragOffsetRef.current = null;
        }
      }
    };
    
    // Start trying after first animation frame (ensures render is complete)
    rafId = requestAnimationFrame(tryClone);

    return () => {
      cancelAnimationFrame(rafId);
      if (cloneContainerRef.current) {
        cloneContainerRef.current.innerHTML = '';
      }
      if (previewRef.current) {
        previewRef.current.style.visibility = 'hidden';
      }
      cloneSizeRef.current = null;
      initialPositionRef.current = null;
      dragOffsetRef.current = null;
      hasClonedRef.current = false;
    };
  }, [isDraggingLayerOnCanvas, draggedLayerId]);

  // Listen to mousemove on BOTH document and iframe
  // Events inside iframe don't bubble to parent document, so we need both listeners
  useEffect(() => {
    if (!isActive) return;
    
    const iframe = iframeRef.current;
    const iframeDoc = iframe?.contentDocument;

    const updatePosition = (windowX: number, windowY: number) => {
      if (!previewRef.current) return;
      
      const currentCloneSize = cloneSizeRef.current;
      const isLayerDrag = isDraggingLayerRef.current;
      
      if (isLayerDrag) {
        if (!currentCloneSize) return;
        
        // Use the stored offset to position ghost relative to cursor
        // Offset is calculated at clone creation time using layerDragStartPosition
        const offset = dragOffsetRef.current || { x: 0, y: 0 };
        const newX = windowX - offset.x;
        const newY = windowY - offset.y;
        
        previewRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
      } else {
        previewRef.current.style.transform = `translate(${windowX + 15}px, ${windowY + 15}px)`;
      }
    };

    // Document listener - receives events from parent window
    const handleDocumentMouseMove = (e: MouseEvent) => {
      updatePosition(e.clientX, e.clientY);
    };

    // Iframe listener - receives events from inside iframe, needs coordinate conversion
    const handleIframeMouseMove = (e: MouseEvent) => {
      if (!iframe) return;
      
      // Convert iframe coords to window coords using utility
      const coords = iframeToWindowCoords(iframe, e.clientX, e.clientY);
      updatePosition(coords.windowX, coords.windowY);
    };

    // Add listeners to both documents
    // Use passive: true for better scroll performance
    document.addEventListener('mousemove', handleDocumentMouseMove, { passive: true });
    if (iframeDoc) {
      iframeDoc.addEventListener('mousemove', handleIframeMouseMove, { passive: true });
    }

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      if (iframeDoc) {
        iframeDoc.removeEventListener('mousemove', handleIframeMouseMove);
      }
    };
  }, [isActive]);

  if (!isActive || typeof document === 'undefined') return null;

  // For sibling reorder, show the cloned element
  if (isDraggingLayerOnCanvas) {
    return createPortal(
      <div
        ref={previewRef}
        className="fixed pointer-events-none z-[9999]"
        style={{
          left: 0,
          top: 0,
          // NO transform here - position is set purely via previewRef.current.style.transform
          // This prevents React from overwriting our imperative DOM updates on re-render
          willChange: 'transform',
          // Start hidden - RAF callback will set visibility: visible after positioning
          visibility: 'hidden',
        }}
      >
        <div ref={cloneContainerRef} />
      </div>,
      document.body
    );
  }

  // For element library drag, show the pill
  const displayName = elementName || 'Element';
  let iconName: React.ComponentProps<typeof Icon>['name'];
  
  if (elementSource === 'components') {
    iconName = 'component';
  } else if (elementSource === 'layouts') {
    iconName = 'layout';
  } else if (elementType) {
    iconName = getBlockIcon(elementType);
  } else {
    iconName = 'box';
  }

  return createPortal(
    <div
      ref={previewRef}
      className="fixed pointer-events-none z-[9999]"
      style={{
        left: 0,
        top: 0,
        transform: 'translate(-1000px, -1000px)',
        willChange: 'transform',
      }}
    >
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md shadow-xl bg-primary text-primary-foreground text-xs font-medium whitespace-nowrap border border-primary-foreground/20">
        <Icon name={iconName} className="size-3.5 opacity-80" />
        <span>{displayName}</span>
      </div>
    </div>,
    document.body
  );
}

export default DragPreviewPortal;
