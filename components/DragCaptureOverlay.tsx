'use client';

/**
 * DragCaptureOverlay Component
 * 
 * Renders a transparent overlay during drag-and-drop operations from
 * ElementLibrary to Canvas. This overlay prevents the iframe from
 * capturing/swallowing mouse events, ensuring they bubble up to the
 * document level where our drag handlers are listening.
 * 
 * Without this overlay, mouse events that enter the iframe's area
 * are captured by the iframe and don't propagate to the parent document.
 */

import { useEditorStore } from '@/stores/useEditorStore';

export function DragCaptureOverlay() {
  // Subscribe directly to store to avoid parent re-renders
  const isDragging = useEditorStore((state) => state.isDraggingToCanvas);

  // Only render when actively dragging to canvas
  if (!isDragging) return null;

  return (
    <div
      className="absolute inset-0 z-[100]"
      style={{
        // Transparent but captures all mouse events
        background: 'transparent',
        // Ensure pointer events are captured by this overlay
        pointerEvents: 'auto',
        // Cursor to indicate dragging is active
        cursor: 'grabbing',
      }}
      // Prevent any click/mousedown from reaching the iframe
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => e.preventDefault()}
    />
  );
}

export default DragCaptureOverlay;
