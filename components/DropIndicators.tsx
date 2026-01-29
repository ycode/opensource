'use client';

/**
 * Shared Drop Indicator Components
 * 
 * Reusable visual feedback components for drag-and-drop operations.
 * Used by both LayersTree and CenterCanvas for consistent drop indicators.
 */

import { cn } from '@/lib/utils';

export type DropPosition = 'above' | 'below' | 'inside';

interface DropLineIndicatorProps {
  /** Position of the line relative to the target element */
  position: 'above' | 'below';
  /** Left offset in pixels (for tree indentation) */
  offsetLeft?: number;
  /** Additional class names */
  className?: string;
}

/**
 * Horizontal line indicator for inserting before/after a sibling element.
 * Shows a blue line with a circular endpoint.
 */
export function DropLineIndicator({ 
  position, 
  offsetLeft = 0, 
  className 
}: DropLineIndicatorProps) {
  return (
    <div
      className={cn(
        'absolute left-0 right-0 h-[1.5px] z-50 bg-primary',
        'animate-in fade-in duration-100',
        position === 'above' ? 'top-0' : 'bottom-0',
        className
      )}
      style={{ marginLeft: `${offsetLeft}px` }}
    >
      {/* Circular endpoint */}
      <div className="absolute -bottom-[3px] -left-[5.5px] size-2 rounded-full border-[1.5px] bg-neutral-950 border-primary" />
    </div>
  );
}

interface DropContainerIndicatorProps {
  /** Optional label to show (e.g., "Add in Section") */
  label?: string;
  /** Whether to show as dashed border (for canvas) or solid (for tree) */
  variant?: 'dashed' | 'solid';
  /** Additional class names */
  className?: string;
}

/**
 * Container highlight indicator for dropping inside an element.
 * Shows a background fill for canvas drops, border for tree drops.
 */
export function DropContainerIndicator({ 
  label, 
  variant = 'solid',
  className 
}: DropContainerIndicatorProps) {
  return (
    <>
      <div 
        className={cn(
          'absolute inset-0 z-40 pointer-events-none',
          'animate-in fade-in duration-100',
          // Canvas variant: blue background fill
          variant === 'dashed' && 'bg-primary/15',
          // Tree variant: solid border
          variant === 'solid' && 'border-[1.5px] rounded-lg border-primary',
          className
        )} 
      />
      {label && (
        <div className="absolute -top-6 left-0 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded z-50 whitespace-nowrap font-medium animate-in fade-in slide-in-from-top-1 duration-100">
          {label}
        </div>
      )}
    </>
  );
}

interface DropIndicatorProps {
  /** Current drop position */
  position: DropPosition;
  /** Left offset for line indicators (tree indentation) */
  offsetLeft?: number;
  /** Label for container indicators */
  label?: string;
  /** Variant for container indicator */
  variant?: 'dashed' | 'solid';
}

/**
 * Combined drop indicator that renders the appropriate indicator based on position.
 * Convenience component for common use cases.
 */
export function DropIndicator({ 
  position, 
  offsetLeft = 0, 
  label,
  variant = 'solid'
}: DropIndicatorProps) {
  if (position === 'inside') {
    return <DropContainerIndicator label={label} variant={variant} />;
  }
  
  return <DropLineIndicator position={position} offsetLeft={offsetLeft} />;
}
