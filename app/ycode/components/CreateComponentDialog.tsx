'use client';

/**
 * Create Component Dialog
 *
 * Dialog for creating a component from a layer
 * Prompts user for component name
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
import { Label } from '@/components/ui/label';

interface CreateComponentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (componentName: string) => void;
  layerName?: string;
}

export default function CreateComponentDialog({
  open,
  onOpenChange,
  onConfirm,
  layerName,
}: CreateComponentDialogProps) {
  const [componentName, setComponentName] = useState(layerName || '');
  const [isCreating, setIsCreating] = useState(false);

  const handleConfirm = async () => {
    if (!componentName.trim()) return;

    setIsCreating(true);
    await onConfirm(componentName.trim());
    setIsCreating(false);
    setComponentName('');
    onOpenChange(false);
  };

  const handleCancel = () => {
    setComponentName('');
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && componentName.trim()) {
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        width="320px"
        className="gap-0"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>Create component</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4.5">
          <div className="flex flex-col gap-2">
            <Input
              id="component-name"
              placeholder="Name"
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          <DialogFooter className="grid grid-cols-2 mt-1">
            <Button
              variant="secondary"
              onClick={handleCancel}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!componentName.trim() || isCreating}
            >
              Create
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
