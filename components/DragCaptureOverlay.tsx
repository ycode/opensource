'use client';

/**
 * DragCaptureOverlay Component
 * 
 * Renders a transparent overlay during drag-and-drop operations from
 * ElementLibrary to Canvas. This overlay prevents the iframe from
 * capturing/swallowing mouse events, ensuring they bubble up to the
 * document level where our drag handlers are listening.
 * 
 * Renders as a PORTAL to document.body to escape CSS stacking contexts
 * created by transform (zoom) on the canvas. Without this, the overlay
 * would be behind the transformed canvas despite having higher z-index.
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '@/stores/useEditorStore';
import { setDragCursor, clearDragCursor } from '@/lib/drag-cursor';

export function DragCaptureOverlay() {
  // Subscribe directly to store to avoid parent re-renders
  const isDraggingToCanvas = useEditorStore((state) => state.isDraggingToCanvas);
  const isDraggingLayerOnCanvas = useEditorStore((state) => state.isDraggingLayerOnCanvas);
  
  // Show overlay for both element-to-canvas drag AND sibling reorder drag
  const isDragging = isDraggingToCanvas || isDraggingLayerOnCanvas;

  // Set cursor on both documents when overlay appears
  useEffect(() => {
    if (!isDragging) return;
    
    // Find the canvas iframe and set cursor on its document AND the iframe element itself
    const iframe = document.querySelector('iframe[title="Canvas Editor"]') as HTMLIFrameElement | null;
    const iframeDoc = iframe?.contentDocument;
    
    // Pass both iframe document and iframe element for comprehensive cursor setting
    setDragCursor(iframeDoc, iframe);
    
    return () => {
      clearDragCursor(iframeDoc);
    };
  }, [isDragging]);

  // Only render when actively dragging
  if (!isDragging || typeof document === 'undefined') return null;

  // Render as portal to document.body to escape stacking context issues
  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9998,
        // Transparent
        background: 'transparent',
        // Ensure pointer events are captured by this overlay
        pointerEvents: 'auto',
        // Cursor to indicate dragging is active - must be grabbing
        cursor: 'grabbing',
      }}
      // Prevent any click/mousedown from reaching elements beneath
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => e.preventDefault()}
    />,
    document.body
  );
}

export default DragCaptureOverlay;
