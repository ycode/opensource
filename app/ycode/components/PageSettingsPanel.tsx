'use client';

/**
 * Page Settings Panel
 *
 * Slide-out panel for creating and editing pages
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { Page, PageFolder } from '@/types';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
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
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { getPageIcon } from '@/lib/page-utils';

interface PageSettingsPanelProps {
  isOpen: boolean;
  page?: Page | null;
  onClose: () => void;
  onSave: (pageData: PageFormData) => Promise<void>;
}

export interface PageFormData {
  name: string;
  slug: string;
  page_folder_id?: string | null;
  is_published?: boolean;
  order?: number;
  depth?: number;
  is_index?: boolean;
  is_dynamic?: boolean;
  is_locked?: boolean;
  error_page?: number | null;
  settings?: Record<string, any>;
}

export default function PageSettingsPanel({
  isOpen,
  onClose,
  page,
  onSave,
}: PageSettingsPanelProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [pageFolderId, setPageFolderId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pages = usePagesStore((state) => state.pages);
  const folders = usePagesStore((state) => state.folders);

  // Initialize form when page changes
  useEffect(() => {
    if (page) {
      setName(page.name);
      setSlug(page.slug);
      setPageFolderId(page.page_folder_id);
    } else {
      setName('');
      setSlug('');
      setPageFolderId(null);
    }
    setError(null);
  }, [page]);

  // Auto-generate slug from name for new pages
  useEffect(() => {
    if (!page && name) {
      const autoSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(autoSlug);
    }
  }, [name, page]);

  // Build hierarchical folder list for select dropdown
  const folderOptions = useMemo(() => {
    const buildFolderPath = (folder: PageFolder, allFolders: PageFolder[]): string => {
      if (!folder.page_folder_id) {
        return folder.name;
      }
      const parent = allFolders.find(f => f.id === folder.page_folder_id);
      if (!parent) {
        return folder.name;
      }
      return `${buildFolderPath(parent, allFolders)} / ${folder.name}`;
    };

    return folders
      .map(folder => ({
        id: folder.id,
        name: folder.name,
        path: buildFolderPath(folder, folders),
        depth: folder.depth,
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [folders]);

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError('Page name is required');
      return;
    }

    if (!page?.is_locked && !slug.trim()) {
      setError('Slug is required');
      return;
    }

    // Check for duplicate slug (globally unique per published state)
    // The database has a unique constraint on (slug, is_published)
    const trimmedSlug = slug.trim();
    const duplicateSlug = pages.find(
      (p) =>
        p.id !== page?.id && // Exclude current page
        p.slug === trimmedSlug &&
        p.is_published === (page?.is_published || false) // Same published state
    );

    if (duplicateSlug) {
      setError('This slug is already used by another page');
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save page');
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
            <Icon name={page ? getPageIcon(page) : 'page'} className="size-3" />
            <Label>{page ? page.name : 'New Page'}</Label>
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

        {/* Tabs */}
        <Tabs defaultValue="general" className="flex-1 flex flex-col px-5 py-3.5">
          <TabsList className="w-full">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
            <TabsTrigger value="code">Custom code</TabsTrigger>
          </TabsList>

          <hr className="my-2" />

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            <TabsContent value="general">
              <FieldGroup>
                <FieldSet>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Page name</FieldLabel>
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
                        disabled={page?.is_index}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder={page?.is_index ? 'Index pages do not have a slug.' : undefined}
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
                            {folderOptions.map((folder) => (
                              <SelectItem key={folder.id} value={folder.id}>
                                <div className="flex items-center gap-2">
                                  <Icon name="folder" className="size-3" />
                                  <span>{folder.path}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field orientation="horizontal" className="flex !flex-row-reverse">
                      <FieldContent>
                        <FieldLabel htmlFor="passwordProtected">Password protected</FieldLabel>
                        <FieldDescription>
                          Restrict access to this page. Setting a password will override any password set on a parent folder. Passwords are case-sensitive.
                        </FieldDescription>
                      </FieldContent>
                      <Switch id="passwordProtected" />
                    </Field>

                    <Field orientation="horizontal" className="flex !flex-row-reverse">
                      <FieldContent>
                        <FieldLabel htmlFor="homepage">Homepage</FieldLabel>
                        <FieldDescription>
                          Set this page to a homepage.
                        </FieldDescription>
                      </FieldContent>

                      <Switch
                        id="homepage"
                        checked={page?.is_index}
                        disabled={page?.is_index}
                      />
                    </Field>
                  </FieldGroup>
                </FieldSet>
              </FieldGroup>
            </TabsContent>

            <TabsContent value="seo">
              <Empty>
                <EmptyTitle>Coming soon</EmptyTitle>
                <EmptyDescription>Configure meta tags, descriptions, and more</EmptyDescription>
              </Empty>
            </TabsContent>

            <TabsContent value="code">
              <Empty>
                <EmptyTitle>Coming soon</EmptyTitle>
                <EmptyDescription>Add custom HTML, CSS, and JavaScript</EmptyDescription>
              </Empty>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </>
  );
}


