'use client';

/**
 * DragPreviewPortal Component
 * 
 * Renders a floating drag preview that follows the cursor during
 * drag-and-drop from ElementLibrary to Canvas.
 * 
 * Uses direct DOM manipulation for smooth 60fps updates instead of React state.
 * Renders as a portal to document.body to ensure it's always on top.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEditorStore } from '@/stores/useEditorStore';
import Icon from '@/components/ui/icon';
import { getBlockIcon } from '@/lib/templates/blocks';

export function DragPreviewPortal() {
  const isDragging = useEditorStore((state) => state.isDraggingToCanvas);
  const elementName = useEditorStore((state) => state.dragElementName);
  const elementType = useEditorStore((state) => state.dragElementType);
  const elementSource = useEditorStore((state) => state.dragElementSource);
  
  const previewRef = useRef<HTMLDivElement>(null);

  // Listen to mousemove and update position directly (no React state)
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (previewRef.current) {
        // Direct DOM manipulation for 60fps performance
        previewRef.current.style.left = `${e.clientX}px`;
        previewRef.current.style.top = `${e.clientY}px`;
      }
    };

    // Attach listener
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDragging]);

  // Don't render if not dragging or if we're on the server
  if (!isDragging || typeof document === 'undefined') return null;

  // Get the appropriate icon based on source
  let iconName: React.ComponentProps<typeof Icon>['name'] = 'box'; // Default fallback
  if (elementSource === 'components') {
    iconName = 'component';
  } else if (elementSource === 'layouts') {
    iconName = 'layout';
  } else if (elementType) {
    iconName = getBlockIcon(elementType);
  }

  return createPortal(
    <div
      ref={previewRef}
      className="fixed pointer-events-none z-[9999]"
      style={{
        // Start off-screen, will be positioned by mousemove
        left: '-1000px',
        top: '-1000px',
        // Center on cursor
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg bg-primary text-primary-foreground text-sm font-medium whitespace-nowrap">
        <Icon name={iconName} className="size-4" />
        <span>{elementName || 'Element'}</span>
      </div>
    </div>,
    document.body
  );
}

export default DragPreviewPortal;
