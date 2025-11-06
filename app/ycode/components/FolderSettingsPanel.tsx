'use client';

/**
 * Folder Settings Panel
 *
 * Slide-out panel for creating and editing folders
 */

import React, { useState, useEffect } from 'react';
import type { PageFolder } from '@/types';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  SelectTrigger
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';

interface FolderSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  folder?: PageFolder | null;
  onSave: (folderData: FolderFormData) => Promise<void>;
}

export interface FolderFormData {
  name: string;
  slug: string;
  is_published?: boolean;
  order?: number;
  depth?: number;
  is_index?: boolean;
  is_dynamic?: boolean;
  is_locked?: boolean;
  error_page?: number | null;
  settings?: Record<string, any>;
}

export default function FolderSettingsPanel({
  isOpen,
  onClose,
  folder,
  onSave,
}: FolderSettingsPanelProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const folders = usePagesStore((state) => state.folders);

  // Initialize form when folder changes
  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setSlug(folder.slug);
    } else {
      setName('');
      setSlug('');
    }
    setError(null);
  }, [folder]);

  // Auto-generate slug from name for new folders
  useEffect(() => {
    if (!folder && name) {
      const autoSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(autoSlug);
    }
  }, [name, folder]);

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
        f.id !== folder?.id && // Exclude current folder
        f.slug === trimmedSlug &&
        f.page_folder_id === folder?.page_folder_id // Same parent folder
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
        is_published: false,
      });
      onClose();
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
            <Label>{folder ? folder.name : 'New Folder'}</Label>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={onClose} size="sm"
              variant="secondary"
            >Close</Button>
            <Button
              onClick={handleSave} disabled={isSaving}
              size="sm"
            >Save</Button>
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
                    <FieldLabel>Folder</FieldLabel>
                    <Select>
                      <SelectTrigger>
                        Coming soon
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="1">Coming soon</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field orientation="horizontal" className="flex !flex-row-reverse">
                    <FieldContent>
                      <FieldLabel htmlFor="passwordProtected">Password protected</FieldLabel>
                      <FieldDescription>
                        Restrict access to this folder. Setting a password will override any password set on a parent folder. Passwords are case-sensitive.
                      </FieldDescription>
                    </FieldContent>
                    <Switch id="passwordProtected" />
                  </Field>

                  <Field orientation="horizontal" className="flex !flex-row-reverse">
                    <FieldContent>
                      <FieldLabel htmlFor="homepage">Homepage</FieldLabel>
                      <FieldDescription>
                        Set this folder to a homepage.
                      </FieldDescription>
                    </FieldContent>
                    <Switch id="homepage" />
                  </Field>
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </div>
      </div>
    </>
  );
}


