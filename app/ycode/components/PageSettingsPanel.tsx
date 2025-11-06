'use client';

/**
 * Page Settings Panel
 *
 * Slide-out panel for creating and editing pages
 */

import React, { useState, useEffect } from 'react';
import type { Page } from '@/types';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
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

interface PageSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  page?: Page | null;
  onSave: (pageData: PageFormData) => Promise<void>;
}

export interface PageFormData {
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

export default function PageSettingsPanel({
  isOpen,
  onClose,
  page,
  onSave,
}: PageSettingsPanelProps) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when page changes
  useEffect(() => {
    if (page) {
      setName(page.name);
      setSlug(page.slug);
    } else {
      setName('');
      setSlug('');
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

    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        slug: slug.trim(),
        is_published: false,
      });
      onClose();
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

          <Label>{page ? page.name : 'New Page'}</Label>

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
        <Tabs defaultValue="general" className="flex-1 flex flex-col px-4 py-3.5">
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
                      <Switch id="homepage" />
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


