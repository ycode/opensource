'use client';

/**
 * Asset Folder Dialog
 *
 * Modal dialog for creating or renaming asset folders
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import type { AssetFolder } from '@/types';

interface AssetFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (folderName: string, parentFolderId: string | null) => void;
  mode?: 'create' | 'rename';
  initialName?: string;
  initialParentFolderId?: string | null;
  folders?: AssetFolder[];
  currentFolderId?: string | null;
}

export default function AssetFolderDialog({
  open,
  onOpenChange,
  onConfirm,
  mode = 'create',
  initialName = '',
  initialParentFolderId = null,
  folders = [],
  currentFolderId = null,
}: AssetFolderDialogProps) {
  const [folderName, setFolderName] = useState(initialName);
  const [parentFolderId, setParentFolderId] = useState<string | null>(initialParentFolderId);
  const [isProcessing, setIsProcessing] = useState(false);
  const prevOpenRef = useRef(false);

  // Only sync form state when dialog opens (not when it closes)
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    const isOpening = open && !wasOpen;

    if (isOpening) {
      setFolderName(initialName);
      setParentFolderId(initialParentFolderId);
    }

    prevOpenRef.current = open;
  }, [open, initialName, initialParentFolderId]);

  // Check if a folder is a descendant of another folder
  const isDescendant = (folderId: string, ancestorId: string): boolean => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return false;
    if (folder.asset_folder_id === ancestorId) return true;
    if (folder.asset_folder_id) {
      return isDescendant(folder.asset_folder_id, ancestorId);
    }
    return false;
  };

  // Filter out the current folder and its descendants to prevent circular references
  const availableFolders = folders.filter((folder) => {
    if (!currentFolderId) return true;
    if (folder.id === currentFolderId) return false;
    return !isDescendant(folder.id, currentFolderId);
  });

  // Build full path for a folder (for select dropdown)
  const buildFolderPath = (folderId: string | null): string => {
    if (!folderId) return 'All files';

    const pathParts: string[] = [];
    let currentId: string | null = folderId;

    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (!folder) break;
      pathParts.unshift(folder.name);
      currentId = folder.asset_folder_id;
    }

    return `All files / ${pathParts.join(' / ')}`;
  };

  const handleConfirm = async () => {
    if (!folderName.trim()) return;

    setIsProcessing(true);
    await onConfirm(folderName.trim(), parentFolderId);
    setIsProcessing(false);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && folderName.trim()) {
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
          <DialogTitle>
            {mode === 'create' ? 'New folder' : 'Edit folder'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4.5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              placeholder="Folder name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              disabled={isProcessing}
              autoComplete="off"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="parent-folder">Parent folder</Label>
            <Select
              value={parentFolderId || 'root'}
              onValueChange={(value) => setParentFolderId(value === 'root' ? null : value)}
              disabled={isProcessing}
            >
              <SelectTrigger id="parent-folder">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">All files</SelectItem>
                {availableFolders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {buildFolderPath(folder.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="grid grid-cols-2 mt-1">
            <Button
              variant="secondary"
              onClick={handleCancel}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!folderName.trim() || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Spinner />
                  {mode === 'create' ? 'Creating...' : 'Saving...'}
                </>
              ) : (
                mode === 'create' ? 'Create' : 'Save'
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
