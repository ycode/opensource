'use client';

/**
 * Gap Indicators Component
 *
 * Shows draggable gap indicators between children of flex-column containers.
 * Allows visual adjustment of gap values.
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface GapIndicatorProps {
  top: number;
  left: number;
  width: number;
  height: number;
  layerId: string;
  gapValue: string;
  onGapUpdate: (layerId: string, gapValue: string) => void;
  isVisible: boolean;
}

/**
 * Extract gap value from Tailwind classes
 */
function extractGapValue(classesString: string): string | null {
  if (!classesString) return null;

  // Match gap-[value] arbitrary values
  const arbitraryMatch = classesString.match(/gap-\[([^\]]+)\]/);
  if (arbitraryMatch) {
    return arbitraryMatch[1];
  }

  // Match standard gap-{size} classes
  const standardMatch = classesString.match(/gap-(\d+\.?\d*)/);
  if (standardMatch) {
    const value = parseFloat(standardMatch[1]);
    // Tailwind uses 0.25rem per unit (e.g., gap-4 = 1rem)
    return (value * 0.25) + 'rem';
  }

  return null;
}

/**
 * Convert gap value string to pixels
 */
function parseGapValueToPixels(gapValue: string): number {
  if (!gapValue) return 0;

  // Already in pixels
  if (gapValue.endsWith('px')) {
    return parseFloat(gapValue);
  }

  // Convert rem to pixels (1rem = 16px by default)
  if (gapValue.endsWith('rem')) {
    return parseFloat(gapValue) * 16;
  }

  // Convert em to pixels (assume 16px base)
  if (gapValue.endsWith('em')) {
    return parseFloat(gapValue) * 16;
  }

  // Try to parse as number (assume pixels)
  const num = parseFloat(gapValue);
  return isNaN(num) ? 0 : num;
}

/**
 * Single Gap Indicator
 */
const GapIndicator: React.FC<GapIndicatorProps> = ({
  top,
  left,
  width,
  height,
  layerId,
  gapValue,
  onGapUpdate,
  isVisible,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const startYRef = useRef(0);
  const startGapValueRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    startYRef.current = e.clientY;
    startGapValueRef.current = parseGapValueToPixels(gapValue);

    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, [gapValue]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startYRef.current;
      const newGapValue = Math.max(0, startGapValueRef.current + deltaY);
      const newGapString = Math.round(newGapValue) + 'px';
      onGapUpdate(layerId, newGapString);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const deltaY = e.clientY - startYRef.current;
      const newGapValue = Math.max(0, startGapValueRef.current + deltaY);
      const newGapString = Math.round(newGapValue) + 'px';
      onGapUpdate(layerId, newGapString);

      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, layerId, onGapUpdate]);

  const showIndicator = isVisible || isHovering || isDragging;

  return (
    <div
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'auto',
        cursor: 'ns-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: showIndicator ? 1 : 0,
        transition: 'opacity 150ms ease',
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Background overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: isHovering || isDragging ? 'rgba(236, 72, 153, 0.05)' : 'transparent',
          pointerEvents: 'none',
        }}
      />
      {/* Marker line */}
      <div
        style={{
          width: '20px',
          height: '2px',
          backgroundColor: '#ec4899', // pink-500
          borderRadius: '20px',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

interface GapIndicatorsProps {
  /** Currently selected layer ID */
  selectedLayerId: string | null;
  /** Container element to find gaps in (shadow root or document) */
  containerRef: React.RefObject<HTMLElement | ShadowRoot | null>;
  /** Callback when gap is updated */
  onGapUpdate: (layerId: string, gapValue: string) => void;
  /** Portal target for rendering indicators */
  portalTarget?: HTMLElement | ShadowRoot | null;
}

/**
 * Gap Indicators Container
 * Renders gap indicators between children of the selected flex-col element
 */
export default function GapIndicators({
  selectedLayerId,
  containerRef,
  onGapUpdate,
  portalTarget,
}: GapIndicatorsProps) {
  const [gaps, setGaps] = useState<Array<{
    top: number;
    left: number;
    width: number;
    height: number;
    gapValue: string;
  }>>([]);
  const [isParentHovered, setIsParentHovered] = useState(false);
  const selectedElementRef = useRef<Element | null>(null);

  // Calculate gap positions
  useEffect(() => {
    if (!selectedLayerId || !containerRef.current) {
      setGaps([]);
      return;
    }

    const container = containerRef.current;
    const selectedElement = container.querySelector(`[data-layer-id="${selectedLayerId}"]`);
    
    if (!selectedElement) {
      setGaps([]);
      return;
    }

    selectedElementRef.current = selectedElement;

    // Check if it's a flex-column container
    const classes = selectedElement.className;
    if (typeof classes !== 'string' || !classes.includes('flex') || !classes.includes('flex-col')) {
      setGaps([]);
      return;
    }

    // Get gap value
    const gapValue = extractGapValue(classes);
    if (!gapValue) {
      setGaps([]);
      return;
    }

    // Get direct children (excluding gap dividers and collection wrappers handled separately)
    const children = Array.from(selectedElement.children).filter(
      (child) =>
        !child.hasAttribute('data-gap-divider') &&
        child.getAttribute('data-layer-id') // Only count actual layers
    );

    // Calculate gaps between children
    const newGaps: typeof gaps = [];
    for (let i = 0; i < children.length - 1; i++) {
      const currentChild = children[i];
      const nextChild = children[i + 1];

      const currentRect = currentChild.getBoundingClientRect();
      const nextRect = nextChild.getBoundingClientRect();

      // Gap is between bottom of current and top of next
      const gapTop = currentRect.bottom;
      const gapHeight = nextRect.top - currentRect.bottom;

      // Only show if there's actual gap space
      if (gapHeight > 0) {
        newGaps.push({
          top: gapTop,
          left: currentRect.left,
          width: currentRect.width,
          height: gapHeight,
          gapValue,
        });
      }
    }

    setGaps(newGaps);

    // Add hover listeners to parent element
    const handleMouseEnter = () => setIsParentHovered(true);
    const handleMouseLeave = () => setIsParentHovered(false);

    selectedElement.addEventListener('mouseenter', handleMouseEnter);
    selectedElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      selectedElement.removeEventListener('mouseenter', handleMouseEnter);
      selectedElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [selectedLayerId, containerRef]);

  // Recalculate on scroll/resize
  useEffect(() => {
    if (!selectedLayerId || gaps.length === 0) return;

    const handleUpdate = () => {
      // Trigger recalculation by changing selectedLayerId temporarily
      // This is a bit hacky but works for now
      const event = new CustomEvent('gap-indicators-update');
      window.dispatchEvent(event);
    };

    window.addEventListener('scroll', handleUpdate);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [selectedLayerId, gaps.length]);

  if (!selectedLayerId || gaps.length === 0) {
    return null;
  }

  const indicators = gaps.map((gap, index) => (
    <GapIndicator
      key={`gap-${index}`}
      top={gap.top}
      left={gap.left}
      width={gap.width}
      height={gap.height}
      layerId={selectedLayerId}
      gapValue={gap.gapValue}
      onGapUpdate={onGapUpdate}
      isVisible={isParentHovered}
    />
  ));

  // Render into portal target if provided, otherwise render directly
  if (portalTarget) {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 9999,
        }}
      >
        {indicators}
      </div>,
      portalTarget
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      {indicators}
    </div>
  );
}
