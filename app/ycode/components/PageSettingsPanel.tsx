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
import { getPageIcon, isHomepage } from '@/lib/page-utils';

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
  const [isIndex, setIsIndex] = useState(false);
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
      setIsIndex(page.is_index);
    } else {
      setName('');
      setSlug('');
      setPageFolderId(null);
      setIsIndex(false);
    }
    setError(null);
  }, [page]);

  // Auto-generate slug from name for new pages (only if not index)
  useEffect(() => {
    if (!page && name && !isIndex) {
      const autoSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(autoSlug);
    }
  }, [name, page, isIndex]);

  // When isIndex changes, update slug accordingly
  useEffect(() => {
    if (isIndex) {
      setSlug(''); // Index pages must have empty slug
    } else if (page && !isIndex && !slug) {
      // If switching from index to non-index and slug is empty, generate one
      const autoSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setSlug(autoSlug);
    }
  }, [isIndex, page, name, slug]);

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

  // Check if this is the last index page in root folder
  // If so, disable the switch to prevent removing it
  const isLastRootIndexPage = useMemo(() => {
    if (!page?.is_index || pageFolderId !== null) {
      return false;
    }

    // Count other index pages in root folder
    const otherRootIndexPages = pages.filter(
      (p) =>
        p.id !== page?.id &&
        p.is_index &&
        p.page_folder_id === null
    );

    return otherRootIndexPages.length === 0;
  }, [page, pageFolderId, pages]);

  const isOnRootFolder = useMemo(() => page?.page_folder_id === null, [page]);

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError('Page name is required');
      return;
    }

    // Index page rules
    if (isIndex) {
      // Index pages must have empty slug
      if (slug.trim()) {
        setError('Index pages must have an empty slug');
        return;
      }

      // Note: We don't check for existing index pages anymore
      // The backend will automatically transfer the index status
    } else {
      // Non-index pages must have a non-empty slug
      if (!slug.trim()) {
        setError('Slug is required for non-index pages');
        return;
      }

      // Check if this is the only index page in root folder (pageFolderId === null)
      // Root folder must always have an index page
      if (page?.is_index && pageFolderId === null) {
        const otherRootIndexPages = pages.filter(
          (p) =>
            p.id !== page?.id &&
            p.is_index &&
            p.page_folder_id === null
        );

        if (otherRootIndexPages.length === 0) {
          setError('The root folder must have an index page. Please set another page as index first.');
          return;
        }
      }

      // Check for duplicate slug within the same folder and published state
      // The database has a unique constraint on (slug, is_published, page_folder_id)
      const trimmedSlug = slug.trim();
      const duplicateSlug = pages.find(
        (p) =>
          p.id !== page?.id && // Exclude current page
          p.slug === trimmedSlug &&
          p.is_published === (page?.is_published || false) && // Same published state
          p.page_folder_id === pageFolderId // Same folder (including null for root)
      );

      if (duplicateSlug) {
        setError('This slug is already used by another page in this folder');
        return;
      }
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        slug: slug.trim(),
        page_folder_id: pageFolderId,
        is_index: isIndex,
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
                        disabled={isIndex}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder={isIndex ? 'Index pages do not have any slug' : 'Add a slug (you will see it in the URL)'}
                      />
                    </Field>

                    <Field>
                      <div className="flex items-center gap-2">
                        <FieldLabel>Parent folder</FieldLabel>
                        {page && isHomepage(page) && (
                          <FieldDescription className="text-xs text-muted-foreground">
                            (Homepage must remain in the root folder)
                          </FieldDescription>
                        )}
                      </div>

                      <Select
                        value={pageFolderId || 'root'}
                        onValueChange={(value) => setPageFolderId(value === 'root' ? null : value)}
                        disabled={page ? isHomepage(page) : false}
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
                        <FieldLabel htmlFor="passwordProtected">
                          Password protected
                          <span className="ml-2 text-xs text-muted-foreground font-normal">(Coming soon)</span>
                        </FieldLabel>
                        <FieldDescription>
                          Restrict access to this page. Setting a password will override any password set on a parent folder. Passwords are case-sensitive.
                        </FieldDescription>
                      </FieldContent>
                      <Switch id="passwordProtected" disabled />
                    </Field>

                    <Field orientation="horizontal" className="flex !flex-row-reverse">
                      <FieldContent>
                        <FieldLabel htmlFor="homepage">
                          {isOnRootFolder ? 'Homepage' : 'Index page'}
                        </FieldLabel>
                        <FieldDescription>
                          {
                            isLastRootIndexPage
                              ? 'The root folder must have an homepage. Please open the settings of another page at this level and set it as homepage to change this.'
                              : `Set this page as the ${isOnRootFolder ? 'homepage of the website' : 'index (default) page for its parent folder'}. If another ${isOnRootFolder ? 'homepage' : 'index page'} exists, it will automatically be converted to a regular page with a slug.`
                          }
                        </FieldDescription>
                      </FieldContent>

                      <Switch
                        id="homepage"
                        checked={isIndex}
                        disabled={isLastRootIndexPage}
                        onCheckedChange={setIsIndex}
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


