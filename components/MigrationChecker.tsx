'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

/**
 * Migration Checker Component: Checks for and runs pending migrations before allowing
 * builder access. This prevents the builder from trying to query tables that don't exist yet.
 */

interface MigrationCheckerProps {
  onComplete: () => void;
}

export default function MigrationChecker({ onComplete }: MigrationCheckerProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [progress, setProgress] = useState('Checking database status...');
  const [error, setError] = useState<string | null>(null);

  // Ref to ensure migration only runs once (prevents React Strict Mode double-run)
  const hasRunRef = useRef(false);

  const checkAndRunMigrations = useCallback(async () => {
    try {
      setIsChecking(true);
      setProgress('Checking and running migrations...');
      setError(null);

      // Single API call: checks AND runs migrations if needed
      const response = await fetch('/api/setup/migrate', {
        method: 'POST',
      });

      if (!response.ok) {
        console.error('Migration request failed');
        onComplete(); // Allow builder to load anyway
        return;
      }

      const result = await response.json();

      if (result.error) {
        setError(result.error);
        setIsChecking(false);
        return;
      }

      // Successfully ran migrations, allow builder to load
      onComplete();
    } catch (err) {
      console.error('Failed to run migrations:', err);
      setError(err instanceof Error ? err.message : 'Migration failed');
      setIsChecking(false);
    }
  }, [onComplete]);

  useEffect(() => {
    // Skip if already run (React Strict Mode protection)
    if (hasRunRef.current) {
      return;
    }
    hasRunRef.current = true;
    checkAndRunMigrations();
  }, [checkAndRunMigrations]);

  const handleRetry = () => {
    setError(null);
    checkAndRunMigrations();
  };

  const handleSkip = () => {
    // Allow user to skip and try to use builder anyway (risky but their choice)
    onComplete();
  };

  // Always show this component while checking migrations
  if (!isChecking && !error) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-950 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        {error ? (
        // Error state - BLOCKING

            <div className="flex-1 flex items-center text-center flex-col gap-1">
              <Label size="sm">
                Migration failed
              </Label>
              <Label variant="muted" size="sm">
                {error}
              </Label>
              <div className="w-full max-w-xs grid grid-cols-2 gap-3 mt-2">
                <Button onClick={handleRetry}>
                  Retry migration
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleSkip}
                >
                  <span>Skip</span>
                  <span className="text-[10px] opacity-60">Not recommended</span>
                </Button>
              </div>
            </div>
        ) : (
            // Running/Checking state - BLOCKING
            <div className="flex-1 flex items-center text-center flex-col gap-2">
              <Label size="sm">
                Please wait
              </Label>
              <Label
                variant="muted" size="sm"
                className="bg-gradient-to-r from-muted-foreground via-muted-foreground/40 to-muted-foreground bg-[length:200%_100%] animate-shimmer bg-clip-text text-transparent !font-normal"
              >
                {progress}
              </Label>
            </div>
        )}
      </div>
    </div>
  );
}

