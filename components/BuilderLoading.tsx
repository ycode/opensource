'use client';

import { Label } from '@/components/ui/label';

interface BuilderLoadingProps {
  title?: string;
  message?: string;
}

/**
 * BuilderLoading - Reusable loading screen for builder initialization
 * Used for migrations, data loading, and other blocking operations
 */
export default function BuilderLoading({
  title = 'Please wait',
  message = 'Loading...'
}: BuilderLoadingProps) {
  return (
    <div className="absolute inset-0 z-[200] bg-neutral-950 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        <div className="flex-1 flex items-center text-center flex-col gap-2">
          <Label size="sm">
            {title}
          </Label>
          <Label
            variant="muted" size="sm"
            className="bg-gradient-to-r from-muted-foreground via-muted-foreground/40 to-muted-foreground bg-[length:200%_100%] animate-shimmer bg-clip-text text-transparent !font-normal"
          >
            {message}
          </Label>
        </div>
      </div>
    </div>
  );
}
