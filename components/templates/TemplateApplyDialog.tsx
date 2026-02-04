'use client';

/**
 * TemplateApplyDialog Component
 *
 * Confirmation dialog for applying a template.
 * Shows warnings about data being replaced and handles the apply process.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import Icon from '@/components/ui/icon';

interface Template {
  id: string;
  name: string;
  description: string;
}

interface TemplateApplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  onSuccess?: () => void;
}

export function TemplateApplyDialog({
  open,
  onOpenChange,
  template,
  onSuccess,
}: TemplateApplyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    if (!template) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/templates/${template.id}/apply`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply template');
      }

      // Success - close dialog and trigger callback
      onOpenChange(false);
      onSuccess?.();

      // Navigate to /ycode to refresh the whole app with new content
      window.location.href = '/ycode';
    } catch (err) {
      console.error('[TemplateApplyDialog] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to apply template');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (loading) return;
    setError(null);
    onOpenChange(false);
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <DialogContent
        showCloseButton={!loading}
        className="sm:max-w-md"
      >
        <DialogHeader className="bg-destructive/10">
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Icon name="info" className="h-4 w-4" />
            Apply Template
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <DialogDescription className="text-sm leading-relaxed">
            You are about to apply the <strong>&ldquo;{template.name}&rdquo;</strong>{' '}
            template to your project.
          </DialogDescription>

          {/* Warning Box */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <h4 className="mb-2 text-sm font-semibold text-destructive">
              This action will:
            </h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                Replace all your pages, collections, and components
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">•</span>
                Remove any existing template assets
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">•</span>
                Keep your uploaded assets and settings
              </li>
            </ul>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleApply}
            disabled={loading}
          >
            {loading && <Spinner />}
            {loading ? 'Applying...' : 'Apply Template'}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TemplateApplyDialog;
