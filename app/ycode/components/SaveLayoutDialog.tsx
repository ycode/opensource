'use client';

/**
 * Save Layout Dialog
 *
 * Dialog for saving a layer as a layout template
 * Prompts user for layout name and category
 */

import React, { useState, useEffect } from 'react';
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
import Icon from '@/components/ui/icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Image from 'next/image';

interface SaveLayoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (layoutName: string, category: string, imageFile: File | null, oldLayoutKey?: string) => Promise<void>;
  defaultName?: string;
  defaultCategory?: string;
  mode?: 'create' | 'edit';
  layoutKey?: string; // For edit mode
}

const LAYOUT_CATEGORIES = [
  'Navigation',
  'Hero',
  'Features',
  'Stats',
  'Blog header',
  'Blog posts',
  'CTA',
  'Team',
  'Testimonials',
  'Pricing',
  'FAQ',
  'Footer',
  'Header',
  'Custom',
];

export default function SaveLayoutDialog({
  open,
  onOpenChange,
  onConfirm,
  defaultName,
  defaultCategory,
  mode = 'create',
  layoutKey,
}: SaveLayoutDialogProps) {
  const [layoutName, setLayoutName] = useState(defaultName || '');
  const [category, setCategory] = useState(defaultCategory || 'Custom');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Update name and category when defaults change
  useEffect(() => {
    if (open) {
      if (defaultName) {
        setLayoutName(defaultName);
      }
      if (defaultCategory) {
        setCategory(defaultCategory);
      }
    } else {
      // Reset image when dialog closes
      setImageFile(null);
      setImagePreview(null);
    }
  }, [open, defaultName, defaultCategory]);

  const handleConfirm = async () => {
    if (!layoutName.trim()) return;

    setIsSaving(true);
    try {
      await onConfirm(layoutName.trim(), category, imageFile, layoutKey);
      setLayoutName('');
      setCategory('Custom');
      setImageFile(null);
      setImagePreview(null);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to save layout:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setLayoutName('');
    setCategory('Custom');
    setImageFile(null);
    setImagePreview(null);
    onOpenChange(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }

      setImageFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && layoutName.trim()) {
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        width="360px"
        className="gap-0"
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit Layout' : 'Save as Layout'}</DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Update the layout name and category'
              : 'Save this layer structure as a reusable layout template'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4.5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="layout-name">Layout Name</Label>
            <Input
              id="layout-name"
              placeholder="e.g., Hero with CTA"
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="layout-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="layout-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LAYOUT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === 'create' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="layout-image">Preview Image</Label>
              {imagePreview ? (
                <div className="relative w-full aspect-[640/262] bg-zinc-800 rounded-lg overflow-hidden">
                  <Image
                    src={imagePreview}
                    alt="Layout preview"
                    fill
                    className="object-cover"
                  />
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2"
                  >
                    <Icon name="x" className="size-3" />
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="layout-image"
                  className="flex flex-col items-center justify-center w-full aspect-[640/262] border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-600 transition-colors bg-zinc-800/50"
                >
                  <div className="flex flex-col items-center gap-2 text-zinc-400">
                    <Icon name="upload" className="size-5" />
                    <span className="text-xs">Click to upload preview image</span>
                    <span className="text-[10px] text-zinc-500">Max 5MB</span>
                  </div>
                  <input
                    id="layout-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}

          <DialogFooter className="grid grid-cols-2 mt-1">
            <Button
              variant="secondary"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!layoutName.trim() || isSaving}
            >
              {isSaving
                ? (mode === 'edit' ? 'Updating...' : 'Saving...')
                : (mode === 'edit' ? 'Update Layout' : 'Save Layout')
              }
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
