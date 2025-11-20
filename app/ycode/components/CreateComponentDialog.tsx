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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Component</DialogTitle>
          <DialogDescription>
            Create a reusable component from this layer. Components can be used across pages and sync when updated.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="component-name">Component Name</Label>
            <Input
              id="component-name"
              placeholder="Enter component name..."
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
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
            {isCreating ? 'Creating...' : 'Create Component'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
