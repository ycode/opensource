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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [templateId, setTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');

  const resetForm = () => {
    setTemplateId('');
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
    if (!templateId.trim()) {
      setError('Template ID is required');
      return;
    }

    if (!templateName.trim()) {
      setError('Template name is required');
      return;
    }

    // Validate template ID format
    if (!/^[a-z0-9-]+$/.test(templateId)) {
      setError('Template ID must be lowercase letters, numbers, and hyphens only');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/templates/export-and-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: templateId.trim(),
          templateName: templateName.trim(),
          description: description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to export template');
      }

      setSuccess(true);
      onSuccess?.();

      // Close after showing success briefly
      setTimeout(() => {
        handleClose();
      }, 2000);
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
        <DialogHeader className="bg-border/60">
          <DialogTitle>Export as Template</DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="py-8 text-center">
            <div className="mb-4 text-green-500">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-sm font-medium">Template exported successfully!</p>
            <p className="text-xs text-muted-foreground mt-1">
              Your template is now available in the template gallery.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <DialogDescription className="text-sm">
                Export your current site as a reusable template. This will save
                all pages, collections, and components.
              </DialogDescription>

              {/* Template ID */}
              <div className="space-y-2">
                <Label htmlFor="template-id">Template ID</Label>
                <Input
                  id="template-id"
                  placeholder="my-template"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value.toLowerCase())}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and hyphens only. This will be used
                  in the URL.
                </p>
              </div>

              {/* Template Name */}
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name</Label>
                <Input
                  id="template-name"
                  placeholder="My Awesome Template"
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
                onClick={handleExport}
                disabled={loading || !templateId || !templateName}
              >
                {loading && <Spinner />}
                {loading ? 'Exporting...' : 'Export Template'}
              </Button>
              <Button
                variant="secondary"
                onClick={handleClose}
                disabled={loading}
              >
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default TemplateExportDialog;
