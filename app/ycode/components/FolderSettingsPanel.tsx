'use client';

/**
 * Folder Settings Panel
 *
 * Slide-out panel for creating and editing folders
 */

import React, { useState, useEffect, useMemo, useRef, useImperativeHandle } from 'react';
import type { PageFolder } from '@/types';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { usePagesStore } from '@/stores/usePagesStore';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet
} from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import Icon from '@/components/ui/icon';
import { buildFolderPath, isDescendantFolder, generateUniqueFolderSlug } from '@/lib/page-utils';

export interface FolderSettingsPanelHandle {
  checkUnsavedChanges: () => Promise<boolean>;
}

interface FolderSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  folder?: PageFolder | null;
  onSave: (folderData: FolderFormData) => Promise<void>;
}

export interface FolderFormData {
  name: string;
  slug: string;
  page_folder_id?: string | null;
  is_published?: boolean;
  order?: number;
  depth?: number;
  is_index?: boolean;
  is_dynamic?: boolean;
  error_page?: number | null;
  settings?: Record<string, any>;
}

const FolderSettingsPanel = React.forwardRef<FolderSettingsPanelHandle, FolderSettingsPanelProps>(({
  isOpen,
  onClose,
  folder,
  onSave,
}, ref) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [pageFolderId, setPageFolderId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Force recalculation of hasUnsavedChanges after save
  const [saveCounter, setSaveCounter] = useState(0);

  // Track unsaved changes
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'close' | 'navigate' | 'external' | null>(null);
  const [currentFolder, setCurrentFolder] = useState<PageFolder | null | undefined>(folder);
  const [pendingFolderChange, setPendingFolderChange] = useState<PageFolder | null | undefined>(null);
  const rejectedFolderRef = useRef<PageFolder | null | undefined>(null);
  const confirmationResolverRef = useRef<((value: boolean) => void) | null>(null);
  const skipNextInitializationRef = useRef(false);
  const initialValuesRef = useRef<{
    name: string;
    slug: string;
    pageFolderId: string | null;
  } | null>(null);

  const folders = usePagesStore((state) => state.folders);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!initialValuesRef.current) return false;

    const initial = initialValuesRef.current;

    const hasChanges = (
      name !== initial.name ||
      slug !== initial.slug ||
      pageFolderId !== initial.pageFolderId
    );

    // Clear rejected folder when user makes changes (allows them to try navigating again)
    if (hasChanges && rejectedFolderRef.current !== null) {
      rejectedFolderRef.current = null;
    }

    return hasChanges;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, slug, pageFolderId, saveCounter]);

  // Expose method to check for unsaved changes externally
  useImperativeHandle(ref, () => ({
    checkUnsavedChanges: async () => {
      // If currently saving, allow the change (save is in progress)
      if (isSaving) {
        return true;
      }

      // If no unsaved changes, allow immediately
      if (!hasUnsavedChanges) {
        return true;
      }

      // Show dialog and wait for user decision
      return new Promise<boolean>((resolve) => {
        confirmationResolverRef.current = resolve;
        setPendingAction('external');
        setShowUnsavedDialog(true);
      });
    }
  }), [hasUnsavedChanges, isSaving]);

  // Intercept incoming folder prop changes
  useEffect(() => {
    // If the incoming folder is the same object reference as current, nothing to do
    if (folder === currentFolder) {
      return;
    }

    // Don't intercept while saving (the folder prop might update with fresh data from the server)
    if (isSaving) {
      return;
    }

    // If this folder change was already rejected, ignore it
    if (folder === rejectedFolderRef.current) {
      return;
    }

    // If we just saved, skip unsaved changes check (state updates are async)
    if (skipNextInitializationRef.current) {
      setCurrentFolder(folder);
      rejectedFolderRef.current = null;
      return;
    }

    // If we have unsaved changes, show confirmation dialog BEFORE changing
    if (hasUnsavedChanges && initialValuesRef.current !== null) {
      setPendingFolderChange(folder);
      setPendingAction('navigate');
      setShowUnsavedDialog(true);
      return;
    }

    // No unsaved changes, safe to change
    setCurrentFolder(folder);
    rejectedFolderRef.current = null; // Clear rejected folder since we're accepting a change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, currentFolder, isSaving]);

  // Initialize form when currentFolder changes (after confirmation or when no unsaved changes)
  useEffect(() => {
    // Skip initialization if we just saved (to prevent overwriting with stale data from parent)
    if (skipNextInitializationRef.current) {
      skipNextInitializationRef.current = false;
      return;
    }

    if (currentFolder) {
      const initialName = currentFolder.name;
      const initialSlug = currentFolder.slug;
      const initialFolderId = currentFolder.page_folder_id;

      setName(initialName);
      setSlug(initialSlug);
      setPageFolderId(initialFolderId);

      // Save initial values for comparison
      initialValuesRef.current = {
        name: initialName,
        slug: initialSlug,
        pageFolderId: initialFolderId,
      };
    } else {
      setName('');
      setSlug('');
      setPageFolderId(null);

      // Reset initial values for new folder
      initialValuesRef.current = {
        name: '',
        slug: '',
        pageFolderId: null,
      };
    }
    setError(null);
  }, [currentFolder]);

  // Auto-generate slug from name for new folders
  useEffect(() => {
    if (!currentFolder && name) {
      const uniqueSlug = generateUniqueFolderSlug(name, folders, pageFolderId);
      setSlug(uniqueSlug);
    }
  }, [name, currentFolder, folders, pageFolderId]);

  // When parent folder changes for new folders, regenerate slug to avoid duplicates in new location
  useEffect(() => {
    if (!currentFolder && name && slug) {
      const uniqueSlug = generateUniqueFolderSlug(name, folders, pageFolderId);
      // Only update if it would be different (to avoid unnecessary re-renders)
      if (uniqueSlug !== slug) {
        setSlug(uniqueSlug);
      }
    }
  }, [pageFolderId, folders, name, slug, currentFolder]);

  // Build hierarchical folder list for select dropdown (exclude current folder and its descendants)
  const folderOptions = useMemo(() => {
    return folders
      .filter(f => {
        // Exclude current folder and its descendants (can't move a folder into itself or its children)
        if (currentFolder && (f.id === currentFolder.id || isDescendantFolder(f.id, currentFolder.id, folders))) {
          return false;
        }
        return true;
      })
      .map(f => ({
        id: f.id,
        name: f.name,
        path: buildFolderPath(f, folders),
        depth: f.depth,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [folders, currentFolder]);

  // Handle close with unsaved changes check
  const handleClose = () => {
    if (hasUnsavedChanges) {
      setPendingAction('close');
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  };

  // Handle confirming discard changes
  const handleConfirmDiscard = () => {
    setShowUnsavedDialog(false);

    if (pendingAction === 'close') {
      // Reset to initial values before closing to ensure clean state on reopen
      if (initialValuesRef.current) {
        setName(initialValuesRef.current.name);
        setSlug(initialValuesRef.current.slug);
        setPageFolderId(initialValuesRef.current.pageFolderId);
      }

      rejectedFolderRef.current = null;
      onClose();
    } else if (pendingAction === 'navigate' && pendingFolderChange !== undefined) {
      // Discard changes and proceed to load the new folder
      setCurrentFolder(pendingFolderChange);
      setPendingFolderChange(null);
      rejectedFolderRef.current = null; // Clear rejected since we're accepting the change
    } else if (pendingAction === 'external' && confirmationResolverRef.current) {
      // External check - user confirmed to discard
      // Reset to initial values to clear unsaved changes flag
      if (initialValuesRef.current) {
        setName(initialValuesRef.current.name);
        setSlug(initialValuesRef.current.slug);
        setPageFolderId(initialValuesRef.current.pageFolderId);
      }

      rejectedFolderRef.current = null;
      confirmationResolverRef.current(true);
      confirmationResolverRef.current = null;
    }

    setPendingAction(null);
  };

  // Handle canceling discard - stay on current folder with unsaved changes
  const handleCancelDiscard = () => {
    setShowUnsavedDialog(false);

    if (pendingAction === 'navigate') {
      // Mark this folder change as rejected so we don't show the dialog again
      rejectedFolderRef.current = pendingFolderChange;
      setPendingFolderChange(null);
    } else if (pendingAction === 'external' && confirmationResolverRef.current) {
      // External check - user canceled
      confirmationResolverRef.current(false);
      confirmationResolverRef.current = null;
    }

    setPendingAction(null);
    // Don't change currentFolder - stay on the current folder with unsaved changes
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError('Folder name is required');
      return;
    }

    if (!slug.trim()) {
      setError('Slug is required');
      return;
    }

    // Check for duplicate slug in the same parent folder
    const trimmedSlug = slug.trim();
    const duplicateSlug = folders.find(
      (f) =>
        f.id !== currentFolder?.id && // Exclude current folder
        f.slug === trimmedSlug &&
        f.page_folder_id === pageFolderId // Check against the selected parent folder
    );

    if (duplicateSlug) {
      setError('This slug is already used by another folder in the same location');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        slug: trimmedSlug,
        page_folder_id: pageFolderId,
        is_published: false,
      });

      // Trim form state to match what was saved
      const trimmedName = name.trim();

      setName(trimmedName);
      setSlug(trimmedSlug);

      // Update initial values to reflect saved state
      initialValuesRef.current = {
        name: trimmedName,
        slug: trimmedSlug,
        pageFolderId,
      };

      // Clear rejected folder after successful save (allows navigation)
      rejectedFolderRef.current = null;

      // Skip next form initialization to prevent stale data from parent overwriting saved values
      skipNextInitializationRef.current = true;

      // Force recalculation of hasUnsavedChanges (since initialValuesRef doesn't trigger re-render)
      setSaveCounter(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save folder');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 left-64 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-14 left-64 bottom-0 w-[500px] bg-background border-r z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center justify-center gap-1.5">
            <Icon name="folder" className="size-3" />
            <Label>{currentFolder ? currentFolder.name : 'New Folder'}</Label>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleClose} size="sm"
              variant="secondary"
            >Close</Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              size="sm"
            >
              {isSaving && <Spinner />}
              Save
            </Button>
          </div>
        </div>

        <hr className="mx-5" />
          {/* Content */}
          <div className="px-5 py-6 flex-1 overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            <FieldGroup>
              <FieldSet>
                <FieldGroup>
                  <Field>
                    <FieldLabel>Folder name</FieldLabel>
                    <Input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Homepage"
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Slug</FieldLabel>
                    <Input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="index"
                    />
                  </Field>

                  <Field>
                    <FieldLabel>Parent folder</FieldLabel>
                    <Select
                      value={pageFolderId || 'root'}
                      onValueChange={(value) => setPageFolderId(value === 'root' ? null : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="root">
                            <div className="flex items-center gap-2">
                              <Icon name="folder" className="size-3" />
                              None
                            </div>
                          </SelectItem>
                          {folderOptions.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              <div className="flex items-center gap-2">
                                <Icon name="folder" className="size-3" />
                                <span>{f.path}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field orientation="horizontal" className="flex !flex-row-reverse">
                    <FieldContent>
                      <FieldLabel htmlFor="passwordProtected">
                        Password protected
                        <span className="ml-2 text-xs text-muted-foreground font-normal">(Coming soon)</span>
                      </FieldLabel>
                      <FieldDescription>
                        Restrict access to this folder. Setting a password will override any password set on a parent folder. Passwords are case-sensitive.
                      </FieldDescription>
                    </FieldContent>
                    <Switch id="passwordProtected" disabled />
                  </Field>
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </div>
      </div>

      {/* Unsaved changes confirmation dialog */}
      <ConfirmDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to discard them?"
        confirmLabel="Discard changes"
        cancelLabel="Stay on settings"
        confirmVariant="destructive"
        onConfirm={handleConfirmDiscard}
        onCancel={handleCancelDiscard}
      />
    </>
  );
});

FolderSettingsPanel.displayName = 'FolderSettingsPanel';

export default FolderSettingsPanel;
