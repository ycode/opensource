'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export default function ResetDatabasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleInitialClick = () => {
    setShowConfirm(true);
    setError(null);
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  const handleConfirmReset = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/devtools/reset-db', {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to reset database');
      }

      // Success - redirect to /ycode
      router.push('/ycode');
    } catch (err) {
      console.error('Error resetting database:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset database');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="text-center space-y-4 p-8 max-w-md">
        <div className="space-y-2">
          <div className="text-3xl font-bold text-white">
            Reset database
          </div>
          <div className="text-zinc-400">
            This will delete all tables in the public schema
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 text-sm">
            {error}
          </div>
        )}

        {!showConfirm ? (
          <Button
            onClick={handleInitialClick}
            disabled={loading}
            variant="destructive"
            size="lg"
            className="cursor-pointer"
          >
            Reset database
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 space-y-2">
              <div className="text-red-400 font-semibold text-sm">
                Warning: This action cannot be undone
              </div>
              <div className="text-zinc-400">
                All tables in the public schema (along with their respective data) will be permanently deleted.
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <Button
                onClick={handleCancel}
                disabled={loading}
                variant="secondary"
                size="lg"
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmReset}
                disabled={loading}
                variant="destructive"
                size="lg"
                className="cursor-pointer"
              >
                {loading ? (
                  <>
                    <Spinner />
                    Resetting...
                  </>
                ) : (
                  'Confirm'
                )}
              </Button>
            </div>
          </div>
        )}

        {loading && (
          <p className="text-zinc-500 text-sm">
            Please wait, this may take a moment...
          </p>
        )}
      </div>
    </div>
  );
}

