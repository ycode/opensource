'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useEditorUrl } from '@/hooks/use-editor-url';
import { findHomepage } from '@/lib/page-utils';
import { ArrowLeft, LogOut, Monitor, Moon, Sun, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PublishDialog from './PublishDialog';
import { FileManagerDialog } from './FileManagerDialog';

// 4. Stores
import { useEditorStore } from '@/stores/useEditorStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { publishApi, pagesApi, collectionsApi, componentsApi, layerStylesApi, cacheApi } from '@/lib/api';
import { buildSlugPath, buildDynamicPageUrl } from '@/lib/page-utils';

// 5. Types
import type { Page } from '@/types';
import type { User } from '@supabase/supabase-js';
import { Empty, EmptyContent, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';

interface HeaderBarProps {
  user: User | null;
  signOut: () => Promise<void>;
  showPageDropdown: boolean;
  setShowPageDropdown: (show: boolean) => void;
  currentPage: Page | undefined;
  currentPageId: string | null;
  pages: Page[];
  setCurrentPageId: (id: string) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  isPublishing: boolean;
  setIsPublishing: (isPublishing: boolean) => void;
  saveImmediately: (pageId: string) => Promise<void>;
  activeTab: 'pages' | 'layers' | 'cms';
  onExitComponentEditMode?: () => void;
  publishCount: number;
  onPublishSuccess: () => void;
  isSettingsRoute?: boolean;
}

export default function HeaderBar({
  user,
  signOut,
  showPageDropdown,
  setShowPageDropdown,
  currentPage,
  currentPageId,
  pages,
  setCurrentPageId,
  zoom,
  setZoom,
  isSaving,
  hasUnsavedChanges,
  lastSaved,
  isPublishing,
  setIsPublishing,
  saveImmediately,
  activeTab,
  onExitComponentEditMode,
  publishCount,
  onPublishSuccess,
  isSettingsRoute = false,
}: HeaderBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const pageDropdownRef = useRef<HTMLDivElement>(null);
  const { editingComponentId, returnToPageId, currentPageCollectionItemId, currentPageId: storeCurrentPageId } = useEditorStore();
  const { getComponentById } = useComponentsStore();
  const { folders, pages: storePages } = usePagesStore();
  const { items } = useCollectionsStore();
  const { navigateToLayers } = useEditorUrl();
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showPublishPopover, setShowPublishPopover] = useState(false);
  const [changesCount, setChangesCount] = useState(0);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [showFileManagerDialog, setShowFileManagerDialog] = useState(false);
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as 'system' | 'light' | 'dark' | null;
      return savedTheme || 'dark';
    }
    return 'dark';
  });
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'fr'>(() => {
    if (typeof window !== 'undefined') {
      const savedLanguage = localStorage.getItem('language') as 'en' | 'fr' | null;
      return savedLanguage || 'en';
    }
    return 'en';
  });

  // Get current host after mount
  useEffect(() => {
    setBaseUrl(window.location.protocol + '//' + window.location.host);
  }, []);

  // Get component and return page info for edit mode
  const editingComponent = editingComponentId ? getComponentById(editingComponentId) : null;
  const returnToPage = returnToPageId ? pages.find(p => p.id === returnToPageId) : null;

  // Build full page path including folders (memoized for performance)
  const fullPagePath = useMemo(() => {
    if (!currentPage) return '/';
    return buildSlugPath(currentPage, folders, 'page');
  }, [currentPage, folders]);

  // Get collection item slug value for dynamic pages
  const collectionItemSlug = useMemo(() => {
    if (!currentPage?.is_dynamic || !currentPageCollectionItemId) {
      return null;
    }

    const collectionId = currentPage.settings?.cms?.collection_id;
    const slugFieldId = currentPage.settings?.cms?.slug_field_id;

    if (!collectionId || !slugFieldId) {
      return null;
    }

    // Find the item in the store
    const collectionItems = items[collectionId] || [];
    const selectedItem = collectionItems.find(item => item.id === currentPageCollectionItemId);

    if (!selectedItem || !selectedItem.values) {
      return null;
    }

    // Get the slug value from the item's values
    const slugValue = selectedItem.values[slugFieldId];
    return slugValue || null;
  }, [currentPage, currentPageCollectionItemId, items]);

  // Build preview URL (special handling for error pages and dynamic pages)
  const previewUrl = useMemo(() => {
    if (!currentPage) return '';

    // Error pages use special preview route
    if (currentPage.error_page !== null) {
      return `/ycode/preview/error-pages/${currentPage.error_page}`;
    }

    // For dynamic pages, use buildDynamicPageUrl to ensure slug value is always current
    const path = currentPage.is_dynamic
      ? buildDynamicPageUrl(currentPage, folders, collectionItemSlug)
      : fullPagePath;

    return `/ycode/preview${path === '/' ? '' : path}`;
  }, [currentPage, folders, fullPagePath, collectionItemSlug]);

  // Build published URL (for the link in the center)
  const publishedUrl = useMemo(() => {
    if (!currentPage) return '';

    // For dynamic pages, use buildDynamicPageUrl to ensure slug value is always current
    const path = currentPage.is_dynamic
      ? buildDynamicPageUrl(currentPage, folders, collectionItemSlug)
      : fullPagePath;

    return path === '/' ? '' : path;
  }, [currentPage, folders, fullPagePath, collectionItemSlug]);

  // Apply theme to HTML element
  useEffect(() => {
    const root = document.documentElement;

    if (theme === 'system') {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemPrefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } else if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    localStorage.setItem('theme', theme);
  }, [theme]);

  // Save language preference to localStorage
  useEffect(() => {
    localStorage.setItem('language', selectedLanguage);
  }, [selectedLanguage]);

  // Close page dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pageDropdownRef.current && !pageDropdownRef.current.contains(event.target as Node)) {
        setShowPageDropdown(false);
      }
    };

    if (showPageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPageDropdown, setShowPageDropdown]);

  // Load changes count when popover opens
  useEffect(() => {
    if (showPublishPopover) {
      loadChangesCount();
    }
  }, [showPublishPopover]);

  const loadChangesCount = async () => {
    setIsLoadingCount(true);
    try {
      const [pagesResponse, collectionsResponse, componentsResponse, stylesResponse] = await Promise.all([
        pagesApi.getUnpublished(),
        collectionsApi.getAll(),
        componentsApi.getUnpublished(),
        layerStylesApi.getUnpublished(),
      ]);

      let count = 0;

      // Count pages
      if (pagesResponse.data) {
        count += pagesResponse.data.length;
      }

      // Count collection items
      if (collectionsResponse.data) {
        for (const collection of collectionsResponse.data) {
          const itemsResponse = await collectionsApi.getUnpublishedItems(collection.id);
          if (itemsResponse.data) {
            count += itemsResponse.data.length;
          }
        }
      }

      // Count components
      if (componentsResponse.data) {
        count += componentsResponse.data.length;
      }

      // Count layer styles
      if (stylesResponse.data) {
        count += stylesResponse.data.length;
      }

      setChangesCount(count);
    } catch (error) {
      console.error('Failed to load changes count:', error);
      setChangesCount(0);
    } finally {
      setIsLoadingCount(false);
    }
  };

  // Publish all changes directly
  const handlePublishAll = async () => {
    try {
      setIsPublishing(true);

      // Get all unpublished items
      const [pagesResponse, collectionsResponse, componentsResponse, stylesResponse] = await Promise.all([
        pagesApi.getUnpublished(),
        collectionsApi.getAll(),
        componentsApi.getUnpublished(),
        layerStylesApi.getUnpublished(),
      ]);

      // Publish pages
      if (pagesResponse.data && pagesResponse.data.length > 0) {
        const pageIds = pagesResponse.data.map(p => p.id);
        await pagesApi.publishPages(pageIds);
      }

      // Publish collections with all their unpublished items
      if (collectionsResponse.data) {
        const collectionPublishes = [];

        for (const collection of collectionsResponse.data) {
          const itemsResponse = await collectionsApi.getUnpublishedItems(collection.id);
          if (itemsResponse.data && itemsResponse.data.length > 0) {
            collectionPublishes.push({
              collectionId: collection.id,
              itemIds: itemsResponse.data.map(item => item.id),
            });
          }
        }

        if (collectionPublishes.length > 0) {
          await collectionsApi.publishCollectionsWithItems(collectionPublishes);
        }
      }

      // Publish components
      if (componentsResponse.data && componentsResponse.data.length > 0) {
        const componentIds = componentsResponse.data.map(c => c.id);
        await componentsApi.publishComponents(componentIds);
      }

      // Publish layer styles
      if (stylesResponse.data && stylesResponse.data.length > 0) {
        const styleIds = stylesResponse.data.map(s => s.id);
        await layerStylesApi.publishLayerStyles(styleIds);
      }

      // Copy draft CSS to published CSS
      try {
        const draftCssResponse = await fetch('/api/settings/draft_css');
        if (draftCssResponse.ok) {
          const draftCssResult = await draftCssResponse.json();
          if (draftCssResult.data) {
            await fetch('/api/settings/published_css', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ value: draftCssResult.data }),
            });
          }
        }
      } catch (error) {
        console.error('Failed to publish CSS:', error);
      }

      // Clear cache
      await cacheApi.clearAll();

      // Success callback
      onPublishSuccess();

      // Close popover and refresh count
      setShowPublishPopover(false);
      await loadChangesCount();
    } catch (error) {
      console.error('Failed to publish all:', error);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <>
    <header className="h-14 bg-background border-b grid grid-cols-3 items-center px-4">
      {/* Left: Logo & Navigation */}
      <div className="flex items-center gap-2">

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary" size="sm"
              className="!size-8"
            >
              <div className="dark:text-white text-secondary-foreground">
                <svg
                  className="size-3.5 fill-current" viewBox="0 0 24 24"
                  version="1.1" xmlns="http://www.w3.org/2000/svg"
                >
                  <g
                    id="Symbols" stroke="none"
                    strokeWidth="1" fill="none"
                    fillRule="evenodd"
                  >
                    <g id="Sidebar" transform="translate(-30.000000, -30.000000)">
                      <g id="Ycode">
                        <g transform="translate(30.000000, 30.000000)">
                          <rect
                            id="Rectangle" x="0"
                            y="0" width="24"
                            height="24"
                          />
                          <path
                            id="CurrentFill" d="M11.4241533,0 L11.4241533,5.85877951 L6.024,8.978 L12.6155735,12.7868008 L10.951,13.749 L23.0465401,6.75101349 L23.0465401,12.6152717 L3.39516096,23.9856666 L3.3703726,24 L3.34318129,23.9827156 L0.96,22.4713365 L0.96,16.7616508 L3.36417551,18.1393242 L7.476,15.76 L0.96,11.9090099 L0.96,6.05375516 L11.4241533,0 Z"
                            className="fill-current"
                          />
                        </g>
                      </g>
                    </g>
                  </g>
                </svg>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Signed in as</DropdownMenuLabel>
            <DropdownMenuLabel className="font-normal text-muted-foreground">
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as 'system' | 'light' | 'dark')}>
                  <DropdownMenuRadioItem value="system">
                    System
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="light">
                    Light
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">
                    Dark
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowFileManagerDialog(true)}
            >
              File manager
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => router.push('/ycode/settings/general')}
            >
              Settings
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={async () => {
                await signOut();
              }}
            >
              <LogOut />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Back Button (Settings) */}
        {isSettingsRoute && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              // Use store's currentPageId (persists even on settings route) or fallback to homepage/first page
              const targetPageId = storeCurrentPageId || findHomepage(storePages)?.id || storePages[0]?.id;

              if (targetPageId) {
                navigateToLayers(targetPageId);
              } else {
                router.push('/ycode');
              }
            }}
          >
            <Icon name="arrowLeft" />
            Return back
          </Button>
        )}

      </div>

      <div className="flex gap-1.5 items-center justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="xs" variant="ghost">
              <Icon name="globe" />
              {selectedLanguage === 'en' ? 'EN' : 'FR'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={selectedLanguage}
              onValueChange={(value) => setSelectedLanguage(value as 'en' | 'fr')}
            >
              <DropdownMenuRadioItem value="en">
                English
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="fr">
                French
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push('/ycode/localization/languages')}
            >
              Language settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="h-5">
          <Separator orientation="vertical" />
        </div>
        <Button
          size="xs"
          variant="ghost"
          asChild
        >
          <a
            href={baseUrl + publishedUrl} target="_blank"
            rel="noopener noreferrer"
          >
            {baseUrl}
          </a>
        </Button>
        <div className="h-5">
          <Separator orientation="vertical" />
        </div>
        <Button size="xs" variant="ghost">
          Free
        </Button>
      </div>

      {/* Right: User & Actions */}
      <div className="flex items-center justify-end gap-2">
        {/* Save Status Indicator */}
        <div className="flex items-center justify-end w-[64px] text-xs text-white/50">
          {isSaving ? (
            <>
              <span>Saving</span>
            </>
          ) : hasUnsavedChanges ? (
            <>
              <span>Unsaved</span>
            </>
          ) : lastSaved ? (
            <>
              <span>Saved</span>
            </>
          ) : (
            <>
              <span>Ready</span>
            </>
          )}
        </div>

        {/* Preview button */}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            if (currentPage && previewUrl) {
              window.open(previewUrl, '_blank');
            }
          }}
          disabled={!currentPage || isSaving}
        >
          Preview
        </Button>

        <Popover open={showPublishPopover} onOpenChange={setShowPublishPopover}>
          <PopoverTrigger asChild>
            <Button size="sm" disabled={isSettingsRoute}>Publish</Button>
          </PopoverTrigger>
          <PopoverContent className="mr-4 mt-0.5">

            <div>
              <Label>{baseUrl}</Label>
              <span className="text-popover-foreground text-[10px]">Updated 5 minutes ago</span>
            </div>

            <hr className="my-3" />

            <div className="flex items-center justify-between">

              {/* Publish Dialog */}
              <PublishDialog
                isOpen={showPublishDialog}
                onClose={() => setShowPublishDialog(false)}
                onSuccess={() => {
                  setShowPublishDialog(false);
                  setShowPublishPopover(false);
                  onPublishSuccess();
                  loadChangesCount();
                }}
              />

              <Label className="text-popover-foreground">
                {isLoadingCount ? (
                  <>
                    <div className="flex items-center gap-1">
                      <Spinner className="size-3" />
                      Loading changes...
                    </div>
                  </>
                ) : (
                  <>
                    {changesCount} {changesCount === 1 ? 'change' : 'changes'}
                  </>
                )}
              </Label>

              <Button
                size="xs"
                variant="ghost"
                className="-my-1"
                onClick={() => setShowPublishDialog(true)}
              >
                See changes
              </Button>

            </div>

            <hr className="my-3" />

            <Button
              size="sm"
              className="w-full"
              onClick={handlePublishAll}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <>
                  <Spinner />
                </>
              ) : (
                'Publish'
              )}
            </Button>

          </PopoverContent>
        </Popover>

      </div>
    </header>

    {/* File Manager Dialog */}
    <FileManagerDialog
      open={showFileManagerDialog}
      onOpenChange={setShowFileManagerDialog}
    />
    </>
  );
}
