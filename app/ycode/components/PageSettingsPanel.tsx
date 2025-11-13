'use client';

/**
 * Page Settings Panel
 *
 * Slide-out panel for creating and editing pages
 */

import React, { useState, useEffect, useMemo, useRef, useImperativeHandle } from 'react';
import Image from 'next/image';
import type { Page, PageSettings, Asset } from '@/types';
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
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import Icon from '@/components/ui/icon';
import { getPageIcon, isHomepage, buildSlugPath, buildFolderPath, folderHasIndexPage, generateUniqueSlug } from '@/lib/page-utils';
import { isAssetOfType, ASSET_CATEGORIES } from '@/lib/asset-utils';
import { Textarea } from '@/components/ui/textarea';
import { uploadFileApi, deleteAssetApi } from '@/lib/api';
import { useAsset } from '@/hooks/use-asset';
import { useAssetsStore } from '@/stores/useAssetsStore';

export interface PageSettingsPanelHandle {
  checkUnsavedChanges: () => Promise<boolean>;
}

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
  settings?: PageSettings;
}

const PageSettingsPanel = React.forwardRef<PageSettingsPanelHandle, PageSettingsPanelProps>(({
  isOpen,
  onClose,
  page,
  onSave,
}, ref) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [pageFolderId, setPageFolderId] = useState<string | null>(null);
  const [isIndex, setIsIndex] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoImageId, setSeoImageId] = useState<string | null>(null);
  const [seoNoindex, setSeoNoindex] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadedAssetCache, setUploadedAssetCache] = useState<Asset | null>(null);
  const seoImageAsset = useAsset(seoImageId);
  const { addAsset, removeAsset } = useAssetsStore();
  const displayAsset = uploadedAssetCache || seoImageAsset;

  useEffect(() => {
    if (uploadedAssetCache && seoImageAsset && uploadedAssetCache.id === seoImageAsset.id) {
      setUploadedAssetCache(null);
    }
  }, [uploadedAssetCache, seoImageAsset]);

  const [saveCounter, setSaveCounter] = useState(0);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'close' | 'navigate' | 'external' | null>(null);
  const [currentPage, setCurrentPage] = useState<Page | null | undefined>(page);
  const [pendingPageChange, setPendingPageChange] = useState<Page | null | undefined>(null);
  const rejectedPageRef = useRef<Page | null | undefined>(null);
  const confirmationResolverRef = useRef<((value: boolean) => void) | null>(null);
  const skipNextInitializationRef = useRef(false);
  const initialValuesRef = useRef<{
    name: string;
    slug: string;
    pageFolderId: string | null;
    isIndex: boolean;
    seoTitle: string;
    seoDescription: string;
    seoImageId: string | null;
    seoNoindex: boolean;
  } | null>(null);

  const pages = usePagesStore((state) => state.pages);
  const folders = usePagesStore((state) => state.folders);

  const isErrorPage = useMemo(() => currentPage?.error_page !== null, [currentPage]);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialValuesRef.current) return false;

    const initial = initialValuesRef.current;

    const hasChanges = (
      name !== initial.name ||
      slug !== initial.slug ||
      pageFolderId !== initial.pageFolderId ||
      isIndex !== initial.isIndex ||
      seoTitle !== initial.seoTitle ||
      seoDescription !== initial.seoDescription ||
      seoImageId !== initial.seoImageId ||
      seoNoindex !== initial.seoNoindex ||
      pendingImageFile !== null
    );

    // Clear rejected page when user makes changes (allows them to try navigating again)
    if (hasChanges && rejectedPageRef.current !== null) {
      rejectedPageRef.current = null;
    }

    return hasChanges;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, slug, pageFolderId, isIndex, seoTitle, seoDescription, seoImageId, seoNoindex, pendingImageFile, saveCounter]);

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

  // Intercept incoming page prop changes
  useEffect(() => {
    // If the incoming page is the same object reference as current, nothing to do
    if (page === currentPage) {
      return;
    }

    // Don't intercept while saving (the page prop might update with fresh data from the server)
    if (isSaving) {
      return;
    }

    // If this page change was already rejected, ignore it
    if (page === rejectedPageRef.current) {
      return;
    }

    // If we just saved, skip unsaved changes check (state updates are async)
    if (skipNextInitializationRef.current) {
      setCurrentPage(page);
      rejectedPageRef.current = null;
      return;
    }

    // If we have unsaved changes, show confirmation dialog BEFORE changing
    if (hasUnsavedChanges && initialValuesRef.current !== null) {
      setPendingPageChange(page);
      setPendingAction('navigate');
      setShowUnsavedDialog(true);
      return;
    }

    // No unsaved changes, safe to change
    setCurrentPage(page);
    rejectedPageRef.current = null; // Clear rejected page since we're accepting a change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, currentPage, isSaving]);

  // Initialize form when currentPage changes (after confirmation or when no unsaved changes)
  useEffect(() => {
    // Skip initialization if we just saved (to prevent overwriting with stale data from parent)
    if (skipNextInitializationRef.current) {
      skipNextInitializationRef.current = false;
      return;
    }

    if (currentPage) {
      const settings = currentPage.settings as PageSettings | undefined;
      const initialName = currentPage.name;
      const initialIsIndex = currentPage.is_index;
      const initialSlug = isErrorPage || initialIsIndex ? '' : currentPage.slug;
      const initialFolderId = currentPage.page_folder_id;
      const initialSeoTitle = settings?.seo?.title || '';
      const initialSeoDescription = settings?.seo?.description || '';
      const initialSeoImageId = settings?.seo?.image || null; // Asset ID
      // Normalize seoNoindex: always true for error pages (consistent with save logic)
      const initialSeoNoindex = isErrorPage ? true : (settings?.seo?.noindex || false);

      setName(initialName);
      setSlug(initialSlug);
      setPageFolderId(initialFolderId);
      setIsIndex(initialIsIndex);
      setSeoTitle(initialSeoTitle);
      setSeoDescription(initialSeoDescription);
      setSeoImageId(initialSeoImageId);
      setSeoNoindex(initialSeoNoindex);
      setPendingImageFile(null);
      setUploadedAssetCache(null); // Clear cache when switching pages

      // Clean up preview URL
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
        setImagePreviewUrl(null);
      }

      // Save initial values for comparison
      initialValuesRef.current = {
        name: initialName,
        slug: initialSlug,
        pageFolderId: initialFolderId,
        isIndex: initialIsIndex,
        seoTitle: initialSeoTitle,
        seoDescription: initialSeoDescription,
        seoImageId: initialSeoImageId,
        seoNoindex: initialSeoNoindex,
      };
    } else {
      setName('');
      setSlug('');
      setPageFolderId(null);
      setIsIndex(false);
      setSeoTitle('');
      setSeoDescription('');
      setSeoImageId(null);
      setSeoNoindex(false);
      setPendingImageFile(null);
      setUploadedAssetCache(null); // Clear cache for new page

      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
        setImagePreviewUrl(null);
      }

      // Reset initial values for new page
      initialValuesRef.current = {
        name: '',
        slug: '',
        pageFolderId: null,
        isIndex: false,
        seoTitle: '',
        seoDescription: '',
        seoImageId: null,
        seoNoindex: false,
      };
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, isErrorPage]);

  // Cleanup preview URL when component unmounts or when preview changes
  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  // Auto-generate slug from name for new pages (only if not index or error page)
  useEffect(() => {
    if (!currentPage && name && !isIndex && !isErrorPage) {
      const uniqueSlug = generateUniqueSlug(name, pages, pageFolderId, false);
      setSlug(uniqueSlug);
    }
  }, [name, currentPage, isIndex, isErrorPage, pageFolderId, pages]);

  // When isIndex or isErrorPage changes, update slug accordingly
  useEffect(() => {
    if (isIndex || isErrorPage) {
      setSlug(''); // Index pages and error pages must have empty slug
    } else if (currentPage && !slug && name) {
      // If switching to non-index/non-error and slug is empty, generate one
      const uniqueSlug = generateUniqueSlug(name, pages, pageFolderId, currentPage.is_published, currentPage.id);
      setSlug(uniqueSlug);
    }
  }, [isIndex, isErrorPage, currentPage, name, slug, pageFolderId, pages]);

  // When folder changes for new pages, regenerate slug to avoid duplicates in new folder
  useEffect(() => {
    if (!currentPage && name && slug && !isIndex && !isErrorPage) {
      const uniqueSlug = generateUniqueSlug(name, pages, pageFolderId, false);
      // Only update if it would be different (to avoid unnecessary re-renders)
      if (uniqueSlug !== slug) {
        setSlug(uniqueSlug);
      }
    }
  }, [pageFolderId, pages, name, slug, isIndex, isErrorPage, currentPage]);

  // Build hierarchical folder list for select dropdown
  const folderOptions = useMemo(() => {
    return folders
      .map(folder => ({
        id: folder.id,
        name: folder.name,
        path: buildFolderPath(folder, folders),
        depth: folder.depth,
        disabled: isIndex && folderHasIndexPage(folder.id, pages, currentPage?.id), // Disable if this page is index and folder already has an index
      }))
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [folders, pages, currentPage, isIndex]);

  // Check if this is the last index page in root folder
  // If so, disable the switch to prevent removing it
  const isLastRootIndexPage = useMemo(() => {
    if (!currentPage?.is_index || pageFolderId !== null) {
      return false;
    }

    // Count other index pages in root folder
    const otherRootIndexPages = pages.filter(
      (p) =>
        p.id !== currentPage?.id &&
        p.is_index &&
        p.page_folder_id === null
    );

    return otherRootIndexPages.length === 0;
  }, [currentPage, pageFolderId, pages]);

  const isOnRootFolder = useMemo(() => currentPage?.page_folder_id === null, [currentPage]);

  // Build the slug path preview based on current form values
  const slugPathPreview = useMemo(() => {
    // Error pages don't have a path
    if (isErrorPage) {
      return '';
    }

    // Create a temporary page object with current form values
    const tempPage: Partial<Page> = {
      slug: slug,
      page_folder_id: pageFolderId,
      is_index: isIndex,
    };

    return buildSlugPath(tempPage as Page, folders, 'page');
  }, [pageFolderId, slug, isIndex, folders, isErrorPage]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isAssetOfType(file.type, ASSET_CATEGORIES.IMAGES)) {
      setError('Only image files are allowed');
      return;
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be less than 10MB');
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);
    setPendingImageFile(file);
    setError(null);
  };

  const handleRemoveImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }

    setPendingImageFile(null);
    setSeoImageId(null);
    setUploadedAssetCache(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setPendingAction('close');
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowUnsavedDialog(false);

    if (pendingAction === 'close') {
      onClose();
    } else if (pendingAction === 'navigate' && pendingPageChange !== undefined) {
      // Discard changes and proceed to load the new page
      setCurrentPage(pendingPageChange);
      setPendingPageChange(null);
      rejectedPageRef.current = null; // Clear rejected since we're accepting the change
    } else if (pendingAction === 'external' && confirmationResolverRef.current) {
      // External check - user confirmed to discard
      // Reset to initial values to clear unsaved changes flag
      if (initialValuesRef.current) {
        setName(initialValuesRef.current.name);
        setSlug(initialValuesRef.current.slug);
        setPageFolderId(initialValuesRef.current.pageFolderId);
        setIsIndex(initialValuesRef.current.isIndex);
        setSeoTitle(initialValuesRef.current.seoTitle);
        setSeoDescription(initialValuesRef.current.seoDescription);
        setSeoImageId(initialValuesRef.current.seoImageId);
        setSeoNoindex(initialValuesRef.current.seoNoindex);
        setPendingImageFile(null);

        // Clean up preview URL
        if (imagePreviewUrl) {
          URL.revokeObjectURL(imagePreviewUrl);
          setImagePreviewUrl(null);
        }
      }

      rejectedPageRef.current = null;
      confirmationResolverRef.current(true);
      confirmationResolverRef.current = null;
    }

    setPendingAction(null);
  };

  // Handle canceling discard - stay on current page with unsaved changes
  const handleCancelDiscard = () => {
    setShowUnsavedDialog(false);

    if (pendingAction === 'navigate') {
      // Mark this page change as rejected so we don't show the dialog again
      rejectedPageRef.current = pendingPageChange;
      setPendingPageChange(null);
    } else if (pendingAction === 'external' && confirmationResolverRef.current) {
      // External check - user canceled
      confirmationResolverRef.current(false);
      confirmationResolverRef.current = null;
    }

    setPendingAction(null);
    // Don't change currentPage - stay on the current page with unsaved changes
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError('Page name is required');
      return;
    }

    // Error pages have different rules
    if (isErrorPage) {
      // Error pages must have empty slug and no parent folder
      // These are enforced by the UI, but we validate here too
      if (slug.trim()) {
        setError('Error pages must have an empty slug');
        return;
      }
      // Note: We allow saving even if parent folder is set, backend should handle this
    } else if (isIndex) {
      // Index page rules
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
      if (currentPage?.is_index && pageFolderId === null) {
        const otherRootIndexPages = pages.filter(
          (p) =>
            p.id !== currentPage?.id &&
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
          p.id !== currentPage?.id && // Exclude current page
          p.slug === trimmedSlug &&
          p.is_published === (currentPage?.is_published || false) && // Same published state
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
      let finalSeoImageId: string | null = seoImageId;

      if (pendingImageFile) {
        const uploadedAsset = await uploadFileApi(pendingImageFile, 'page-settings', 'images');

        if (!uploadedAsset) {
          throw new Error('Failed to upload image');
        }

        finalSeoImageId = uploadedAsset.id;
        setUploadedAssetCache(uploadedAsset);
        addAsset(uploadedAsset);

        if (seoImageId && seoImageId !== uploadedAsset.id) {
          await deleteAssetApi(seoImageId);
          removeAsset(seoImageId);
        }
      } else if (!seoImageId && currentPage?.settings?.seo?.image) {
        const existingImageId = currentPage.settings.seo.image;
        if (existingImageId) {
          await deleteAssetApi(existingImageId);
          removeAsset(existingImageId);
        }
      }

      const existingSettings = currentPage?.settings as PageSettings | undefined;

      const settings: PageSettings = {
        ...existingSettings,
        seo: {
          title: seoTitle.trim(),
          description: seoDescription.trim(),
          image: isErrorPage ? null : finalSeoImageId,
          noindex: isErrorPage ? true : seoNoindex,
        },
      };

      await onSave({
        name: name.trim(),
        slug: isErrorPage || isIndex ? '' : slug.trim(),
        page_folder_id: pageFolderId,
        is_index: isIndex,
        is_published: false,
        settings,
      });

      setPendingImageFile(null);
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
        setImagePreviewUrl(null);
      }

      const trimmedName = name.trim();
      const trimmedSlug = isErrorPage || isIndex ? '' : slug.trim();
      const trimmedSeoTitle = seoTitle.trim();
      const trimmedSeoDescription = seoDescription.trim();
      const normalizedSeoNoindex = isErrorPage ? true : seoNoindex;

      setName(trimmedName);
      setSlug(trimmedSlug);
      setSeoTitle(trimmedSeoTitle);
      setSeoDescription(trimmedSeoDescription);
      setSeoNoindex(normalizedSeoNoindex);
      setSeoImageId(finalSeoImageId);

      initialValuesRef.current = {
        name: trimmedName,
        slug: trimmedSlug,
        pageFolderId,
        isIndex,
        seoTitle: trimmedSeoTitle,
        seoDescription: trimmedSeoDescription,
        seoImageId: finalSeoImageId,
        seoNoindex: normalizedSeoNoindex,
      };

      rejectedPageRef.current = null;
      skipNextInitializationRef.current = true;
      setSaveCounter(prev => prev + 1);
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
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="fixed top-14 left-64 bottom-0 w-[500px] bg-background border-r z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center justify-center gap-1.5">
            <Icon name={currentPage ? getPageIcon(currentPage) : 'page'} className="size-3" />
            <Label>{currentPage ? currentPage.name : 'New Page'}</Label>
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
                      <div className="flex items-center gap-3">
                        <FieldLabel>Slug</FieldLabel>
                      </div>
                      <Input
                        type="text"
                        value={slug}
                        disabled={isIndex || isErrorPage}
                        onChange={(e) => {
                          // Prevent slug changes for error pages and index pages
                          if (!isErrorPage && !isIndex) {
                            setSlug(e.target.value);
                          }
                        }}
                        placeholder={
                          isErrorPage
                            ? 'Error pages do not have a slug'
                            : isIndex
                              ? 'Index pages do not have a slug'
                              : 'Add a slug (displayed in the URL)'
                        }
                      />
                      <FieldDescription>
                          {slugPathPreview}
                      </FieldDescription>
                    </Field>

                    <Field>
                      <div className="flex items-center gap-3">
                        <FieldLabel>Parent folder</FieldLabel>
                        {currentPage && isHomepage(currentPage) && !isErrorPage && (
                          <FieldDescription className="text-xs text-muted-foreground">
                            Homepage cannot be moved
                          </FieldDescription>
                        )}
                        {isErrorPage && (
                          <FieldDescription className="text-xs text-muted-foreground">
                            Error pages cannot be moved
                          </FieldDescription>
                        )}
                      </div>

                      <Select
                        value={pageFolderId || 'root'}
                        onValueChange={(value) => setPageFolderId(value === 'root' ? null : value)}
                        disabled={currentPage ? (isHomepage(currentPage) || isErrorPage) : false}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>

                        <SelectContent>
                          <SelectGroup>
                            <SelectItem
                              value="root"
                              disabled={isIndex && folderHasIndexPage(null, pages, currentPage?.id)}
                            >
                              <div className="flex items-center gap-2">
                                <Icon name="folder" className="size-3" />
                                None
                                {isIndex && folderHasIndexPage(null, pages, currentPage?.id) && (
                                  <span>(has a homepage)</span>
                                )}
                              </div>
                            </SelectItem>

                            {folderOptions.map((folder) => (
                              <SelectItem
                                key={folder.id} value={folder.id}
                                disabled={folder.disabled}
                              >
                                <div className="flex items-center gap-2">
                                  <Icon name="folder" className="size-3" />
                                  <span>{folder.path}</span>
                                  {folder.disabled && (
                                    <span>(has a index page)</span>
                                  )}
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
                      <Switch id="passwordProtected" disabled={isErrorPage || true} />
                    </Field>

                    <Field orientation="horizontal" className="flex !flex-row-reverse">
                      <FieldContent>
                        <FieldLabel htmlFor="homepage">
                          {isOnRootFolder ? 'Homepage' : 'Index page'}
                        </FieldLabel>
                        <FieldDescription>
                          {
                            isErrorPage
                              ? 'Error pages cannot be set as index page.'
                              : isLastRootIndexPage
                                ? 'The root folder must have an homepage. Please open the settings of another page at this level and set it as homepage to change this.'
                                : `Set this page as the ${isOnRootFolder ? 'homepage of the website' : 'index (default) page for its parent folder'}. If another ${isOnRootFolder ? 'homepage' : 'index page'} exists, it will converted to a regular page with a slug.`
                          }
                        </FieldDescription>
                      </FieldContent>

                      <Switch
                        id="homepage"
                        checked={isIndex}
                        disabled={isLastRootIndexPage || isErrorPage}
                        onCheckedChange={setIsIndex}
                      />
                    </Field>
                  </FieldGroup>
                </FieldSet>
              </FieldGroup>
            </TabsContent>

            <TabsContent value="seo">
              <FieldGroup>
                <FieldSet>
                  <FieldGroup>
                    <Field>
                      <FieldLabel>Page title</FieldLabel>
                      <FieldDescription>
                        Appears in search results and browser tabs. Page name is used when empty.
                      </FieldDescription>
                      <Input
                        type="text"
                        value={seoTitle}
                        onChange={(e) => setSeoTitle(e.target.value)}
                        placeholder={name || 'Page title'}
                      />
                    </Field>

                    <Field>
                      <FieldLabel>Meta description</FieldLabel>
                      <FieldDescription>
                        Brief description for search engines (generally 150 to 160 characters).
                      </FieldDescription>
                      <Textarea
                        value={seoDescription}
                        onChange={(e) => setSeoDescription(e.target.value)}
                        placeholder={
                          isErrorPage
                            ? 'Describe in more detail what error occurred on this page and why.'
                            : 'What makes this page unique? Describe your business and the content of this page.'
                        }
                      />
                    </Field>

                    {!isErrorPage && (
                      <>
                        <Field>
                          <FieldLabel>Social Preview</FieldLabel>
                          <FieldDescription>Recommended image size is at least 1,200 x 630 pixels.</FieldDescription>
                          <div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleFileSelect}
                            />
                            <div className="bg-input rounded-lg w-full aspect-[1.91/1] flex items-center justify-center overflow-hidden relative">
                              {(imagePreviewUrl || displayAsset) && (
                                <Image
                                  className="object-cover"
                                  src={imagePreviewUrl || displayAsset?.public_url || ''}
                                  alt="Social preview"
                                  fill
                                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                />
                              )}

                              {!(imagePreviewUrl || displayAsset) ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => fileInputRef.current?.click()}
                                >
                                  Upload
                                </Button>
                              ) : (
                                <div className="flex gap-2 relative z-10">
                                  <Button
                                    variant="overlay"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                  >
                                    <Icon name="refresh" />
                                    Replace
                                  </Button>
                                  <Button
                                    variant="overlay"
                                    size="sm"
                                    onClick={handleRemoveImage}
                                  >
                                    <Icon name="trash" />
                                    Delete
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </Field>

                        <Field orientation="horizontal" className="flex !flex-row-reverse">
                          <FieldContent>
                            <FieldLabel htmlFor="noindex" className="cursor-pointer">
                              Exclude this page from search engine results
                            </FieldLabel>
                            <FieldDescription>
                              Prevent search engines like Google from indexing this page.
                            </FieldDescription>
                          </FieldContent>

                          <Switch
                            id="noindex"
                            checked={seoNoindex}
                            onCheckedChange={setSeoNoindex}
                          />
                        </Field>
                      </>
                    )}
                  </FieldGroup>
                </FieldSet>
              </FieldGroup>
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

PageSettingsPanel.displayName = 'PageSettingsPanel';

export default PageSettingsPanel;


