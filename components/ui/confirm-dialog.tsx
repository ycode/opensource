'use client';

/**
 * Confirm Dialog Component
 *
 * Reusable confirmation dialog for destructive or important actions
 * Provides consistent UX for confirmation flows
 * Automatically handles loading state for async callbacks
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

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'default' | 'destructive' | 'secondary';
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  showCloseButton?: boolean;
  saveLabel?: string;
  onSave?: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'destructive',
  onConfirm,
  onCancel,
  showCloseButton = false,
  saveLabel,
  onSave,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleCancel = () => {
    if (loading) return; // Prevent closing while loading
    onCancel?.();
    onOpenChange?.(false);
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = onConfirm();
      // Check if result is a Promise
      if (result instanceof Promise) {
        await result;
      }
      // Close dialog after successful completion
      onOpenChange?.(false);
    } catch (error) {
      console.error('Error in confirm action:', error);
      // Keep dialog open on error so user can see what happened
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!onSave) return;

    setLoading(true);
    try {
      const result = onSave();
      // Check if result is a Promise
      if (result instanceof Promise) {
        await result;
      }
      // Close dialog after successful completion
      onOpenChange?.(false);
    } catch (error) {
      console.error('Error in save action:', error);
      // Keep dialog open on error so user can see what happened
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (loading && !newOpen) return; // Prevent closing while loading
    onOpenChange?.(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={showCloseButton && !loading} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <DialogDescription className="leading-relaxed">{description}</DialogDescription>

        <DialogFooter className="sm:justify-between">
          <Button
            variant={confirmVariant}
            size="sm"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading && <Spinner />}
            {confirmLabel}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancel}
              disabled={loading}
            >
              {cancelLabel}
            </Button>
            {saveLabel && onSave && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={loading}
              >
                {saveLabel}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
