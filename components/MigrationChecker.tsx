'use client';

import { useState, useEffect } from 'react';

/**
 * Migration Checker Component
 * 
 * BLOCKING: Checks for and runs pending migrations before allowing builder access
 * This prevents the builder from trying to query tables that don't exist yet
 */

interface MigrationStatus {
  pending: string[];
  completed: Array<{
    name: string;
    batch: number;
    migration_time: Date;
  }>;
  pendingCount: number;
}

interface MigrationCheckerProps {
  onComplete: () => void;
}

export default function MigrationChecker({ onComplete }: MigrationCheckerProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState('Checking database status...');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAndRunMigrations();
  }, []);

  const checkAndRunMigrations = async () => {
    try {
      setIsChecking(true);
      setProgress('Checking for pending migrations...');

      const response = await fetch('/api/setup/migrate');
      if (!response.ok) {
        // If migrations check fails, allow builder to load anyway
        // (might be first-time setup or different issue)
        console.error('Failed to check migrations');
        onComplete();
        return;
      }

      const data: MigrationStatus = await response.json();
      
      if (data.pendingCount > 0) {
        // BLOCK: Run migrations before allowing builder access
        await runPendingMigrations(data.pendingCount);
      } else {
        // No pending migrations - allow immediate access
        onComplete();
      }
    } catch (err) {
      console.error('Failed to check migrations:', err);
      // Don't block on error - let user proceed
      onComplete();
    } finally {
      setIsChecking(false);
    }
  };

  const runPendingMigrations = async (count: number) => {
    setIsRunning(true);
    setProgress(`Running ${count} database migration(s)...`);
    setError(null);

    try {
      const response = await fetch('/api/setup/migrate', {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setError(result.error || 'Failed to run migrations');
        setIsRunning(false);
        // Don't call onComplete - keep user on migration screen
        return;
      }

      setProgress('Migrations completed successfully! Loading builder...');
      
      // Wait 1 second to show success message, then allow builder to load
      setTimeout(() => {
        onComplete();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run migrations');
      setIsRunning(false);
      // Don't call onComplete - keep user on error screen
    }
  };

  const handleRetry = () => {
    setError(null);
    checkAndRunMigrations();
  };

  const handleSkip = () => {
    // Allow user to skip and try to use builder anyway (risky but their choice)
    onComplete();
  };

  // Always show this component while checking or running migrations
  if (!isChecking && !isRunning && !error) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] bg-zinc-950 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        {error ? (
          // Error state - BLOCKING
          <div className="bg-zinc-900 border border-red-500/50 rounded-lg shadow-2xl p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-500" fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Migration Failed</h3>
                <p className="text-sm text-zinc-400 mb-4">{error}</p>
                <p className="text-xs text-zinc-500">
                  Database migrations could not complete. You can retry or skip (not recommended).
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Retry Migration
              </button>
              <button
                onClick={handleSkip}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                Skip (Risky)
              </button>
            </div>
          </div>
        ) : (
          // Running/Checking state - BLOCKING
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex-shrink-0">
                <svg
                  className="w-12 h-12 text-blue-500 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-1">
                  {isRunning ? 'Updating Database' : 'Preparing Builder'}
                </h3>
                <p className="text-sm text-zinc-400">{progress}</p>
              </div>
            </div>
            
            <div className="bg-zinc-800 rounded-lg p-4">
              <p className="text-xs text-zinc-500 text-center">
                Please wait while we prepare your workspace...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

