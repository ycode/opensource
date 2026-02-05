'use client';

/**
 * TemplateExportDialog Component
 *
 * Dialog for exporting the current site as a template.
 * Collects template metadata and uploads to the template service.
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { generateId } from '@/lib/utils';
import { Empty, EmptyMedia, EmptyDescription, EmptyTitle } from '../ui/empty';
import Icon from '../ui/icon';
import { useAuthStore } from '@/stores/useAuthStore';

interface TemplateExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function TemplateExportDialog({
  open,
  onOpenChange,
  onSuccess,
}: TemplateExportDialogProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');

  const resetForm = () => {
    setTemplateName('');
    setDescription('');
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    if (loading) return;
    resetForm();
    onOpenChange(false);
  };

  const handleExport = async () => {
    // Validate
    if (!templateName.trim()) {
      setError('Template name is required');
      return;
    }

    setLoading(true);
    setError(null);

    // Generate unique template ID
    const templateId = generateId('tpl');

    try {
      const response = await fetch('/api/templates/export-and-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          templateName: templateName.trim(),
          description: description.trim(),
          email: user?.email || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to export template');
      }

      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      console.error('[TemplateExportDialog] Error:', err);
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={loading ? undefined : handleClose}>
      <DialogContent showCloseButton={!loading} className="sm:max-w-md">

        {success ? (
          <div className="py-8 text-center">
            <Empty>
              <EmptyMedia variant="icon">
                <Icon name="check" className="size-4" />
              </EmptyMedia>
              <EmptyTitle>Template submitted successfully!</EmptyTitle>
              <EmptyDescription>
                Thansk for submitting your template. We will review it and get back to you soon.
              </EmptyDescription>
            </Empty>
          </div>
        ) : (
          <>
          <DialogHeader>
          <DialogTitle>Submit template</DialogTitle>
          <DialogDescription>
            Submit your template to the template gallery of your current site.
          </DialogDescription>
        </DialogHeader>
            <div className="flex flex-col gap-6">
              {/* Template Name */}
              <div className="space-y-2">
                <Label htmlFor="template-name">Name</Label>
                <Input
                  id="template-name"
                  placeholder="Landing page Template"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="template-description">Description</Label>
                <Textarea
                  id="template-description"
                  placeholder="A brief description of what this template includes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={loading}
                  rows={3}
                />
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
                variant="secondary"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={loading || !templateName}
              >
                {loading && <Spinner />}
                {loading ? '' : 'Submit template'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default TemplateExportDialog;
