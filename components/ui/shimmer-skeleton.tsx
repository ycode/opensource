import React from 'react';
import { cn } from '@/lib/utils';

export interface ShimmerSkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number;
  gap?: string;
}

export function ShimmerSkeleton({
  width = '100%',
  height = '20px',
  className,
  count = 1,
  gap = '0.5rem',
}: ShimmerSkeletonProps) {
  if (count > 1) {
    return (
      <div className="flex flex-col" style={{ gap }}>
        {Array.from({ length: count }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'animate-pulse bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%] rounded',
              'shimmer-animation',
              className
            )}
            style={{
              width: typeof width === 'number' ? `${width}px` : width,
              height: typeof height === 'number' ? `${height}px` : height,
              animation: 'shimmer 2s infinite',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'animate-pulse bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 bg-[length:200%_100%] rounded',
        'shimmer-animation',
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        animation: 'shimmer 2s infinite',
      }}
    />
  );
}

// Add default export for compatibility
export default ShimmerSkeleton;
