'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useEditorUrl } from '@/hooks/use-editor-url';
import { findHomepage } from '@/lib/page-utils';
import { getTranslationValue } from '@/lib/localisation-utils';
import { formatRelativeTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import PublishDialog from './PublishDialog';

// 4. Stores
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useLocalisationStore } from '@/stores/useLocalisationStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { pagesApi, collectionsApi, componentsApi, layerStylesApi, publishApi } from '@/lib/api';
import { buildSlugPath, buildDynamicPageUrl, buildLocalizedSlugPath, buildLocalizedDynamicPageUrl } from '@/lib/page-utils';

// 5. Types
import type { Page } from '@/types';
import type { User } from '@supabase/supabase-js';
import ActiveUsersInHeader from './ActiveUsersInHeader';
import InviteUserButton from './InviteUserButton';
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
  const { currentPageCollectionItemId, currentPageId: storeCurrentPageId, isPreviewMode, setPreviewMode, openFileManager, setKeyboardShortcutsOpen } = useEditorStore();
  const { folders, pages: storePages } = usePagesStore();
  const { items, fields } = useCollectionsStore();
  const { locales, selectedLocaleId, setSelectedLocaleId, translations } = useLocalisationStore();
  const { getSettingByKey, updateSetting } = useSettingsStore();
  const { navigateToLayers, updateQueryParams } = useEditorUrl();
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showPublishPopover, setShowPublishPopover] = useState(false);
  const [changesCount, setChangesCount] = useState(0);
  const [isLoadingCount, setIsLoadingCount] = useState(false);
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme') as 'system' | 'light' | 'dark' | null;
      return savedTheme || 'dark';
    }
    return 'dark';
  });
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [hasUpdate, setHasUpdate] = useState(false);

  // Get published_at from settings store (loaded on builder init)
  const publishedAt = getSettingByKey('published_at');

  // Get current host after mount
  useEffect(() => {
    setBaseUrl(window.location.protocol + '//' + window.location.host);
  }, []);

  // Check for updates on mount
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const response = await fetch('/api/updates/check');
        if (response.ok) {
          const data = await response.json();
          setHasUpdate(data.available === true);
        }
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    };
    checkForUpdates();
  }, []);

  // Get selected locale (computed from subscribed store values)
  const selectedLocale = useMemo(() => {
    if (!selectedLocaleId) return null;
    return locales.find(l => l.id === selectedLocaleId) || null;
  }, [selectedLocaleId, locales]);

  // Get translations for the selected locale
  const localeTranslations = useMemo(() => {
    return selectedLocaleId ? translations[selectedLocaleId] : undefined;
  }, [selectedLocaleId, translations]);

  // Build full page path including folders (memoized for performance)
  const fullPagePath = useMemo(() => {
    if (!currentPage) return '/';
    return buildSlugPath(currentPage, folders, 'page');
  }, [currentPage, folders]);

  // Build localized page path with translated slugs
  const localizedPagePath = useMemo(() => {
    // If no current page, use homepage for localization route
    const pageToUse = currentPage || (isSettingsRoute ? findHomepage(storePages) : null);

    if (!pageToUse) return '/';

    return buildLocalizedSlugPath(
      pageToUse,
      folders,
      'page',
      selectedLocale,
      localeTranslations
    );
  }, [currentPage, isSettingsRoute, storePages, folders, selectedLocale, localeTranslations]);

  // Get collection item slug value for dynamic pages (with translation support)
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
    let slugValue = selectedItem.values[slugFieldId];

    // If locale is selected, check for translated slug
    if (localeTranslations && slugValue) {
      const collectionFields = fields[collectionId] || [];
      const slugField = collectionFields.find((f: { id: string; key: string | null }) => f.id === slugFieldId);

      if (slugField) {
        // Build translation key: field:key:{key} or field:id:{id}
        const contentKey = slugField.key
          ? `field:key:${slugField.key}`
          : `field:id:${slugField.id}`;
        const translationKey = `cms:${currentPageCollectionItemId}:${contentKey}`;
        const translation = localeTranslations[translationKey];

        const translatedSlug = getTranslationValue(translation);
        if (translatedSlug) {
          slugValue = translatedSlug;
        }
      }
    }

    return slugValue || null;
  }, [currentPage, currentPageCollectionItemId, items, fields, localeTranslations]);

  // Build preview URL (special handling for error pages and dynamic pages)
  const previewUrl = useMemo(() => {
    if (!currentPage) return '';

    // Error pages use special preview route
    if (currentPage.error_page !== null) {
      return `/ycode/preview/error-pages/${currentPage.error_page}`;
    }

    // For dynamic pages, use localized dynamic URL builder
    const path = currentPage.is_dynamic
      ? buildLocalizedDynamicPageUrl(currentPage, folders, collectionItemSlug, selectedLocale, localeTranslations)
      : localizedPagePath;

    return `/ycode/preview${path === '/' ? '' : path}`;
  }, [currentPage, folders, localizedPagePath, collectionItemSlug, selectedLocale, localeTranslations]);

  // Build published URL (for the link in the center)
  const publishedUrl = useMemo(() => {
    // If no current page, use homepage for localization route
    const pageToUse = currentPage || (isSettingsRoute ? findHomepage(storePages) : null);
    if (!pageToUse) return '';

    // For dynamic pages, use localized dynamic URL builder
    const path = pageToUse.is_dynamic
      ? buildLocalizedDynamicPageUrl(pageToUse, folders, collectionItemSlug, selectedLocale, localeTranslations)
      : localizedPagePath;

    return path === '/' ? '' : path;
  }, [currentPage, isSettingsRoute, storePages, folders, localizedPagePath, collectionItemSlug, selectedLocale, localeTranslations]);

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

      // Use global publish API to publish all unpublished items
      const result = await publishApi.publish({ publishAll: true });

      if (result.error) {
        throw new Error(result.error);
      }

      // Sync published timestamp to store from response
      if (result.data?.published_at_setting?.value) {
        updateSetting('published_at', result.data.published_at_setting.value);
      }

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
            <DropdownMenuItem
              onClick={() => router.push('/ycode/settings/general')}
            >
              Settings
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => openFileManager()}
            >
              File manager
            </DropdownMenuItem>

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

            <DropdownMenuItem
              onClick={() => setKeyboardShortcutsOpen(true)}
            >
              Keyboard shortcuts
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={() => router.push('/ycode/profile')}
            >
              My profile
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={async () => {
                await signOut();
              }}
            >
              Sign out
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
            Go back
          </Button>
        )}
      </div>

      <div className="flex gap-1.5 items-center justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="xs" variant="ghost">
              <Icon name="globe" />
              {selectedLocale ? selectedLocale.code.toUpperCase() : 'EN'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={selectedLocaleId || ''}
              onValueChange={(value) => setSelectedLocaleId(value)}
            >
              {locales.map((locale) => (
                <DropdownMenuRadioItem key={locale.id} value={locale.id}>
                  <span className="flex items-center gap-3">
                    {locale.label}
                    {locale.is_default && (
                      <Badge variant="secondary" className="text-[10px] mr-5">
                        Default
                      </Badge>
                    )}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {!pathname?.startsWith('/ycode/localization') && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push('/ycode/localization')}
                >
                  Manage locales
                </DropdownMenuItem>
              </>
            )}
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

        {hasUpdate && (
          <>
            <div className="h-5">
              <Separator orientation="vertical" />
            </div>

            <Button
              size="xs"
              variant="ghost"
              className="text-green-500 hover:text-green-400"
              onClick={() => router.push('/ycode/settings/updates')}
            >
              Update available
            </Button>
          </>
        )}
      </div>

      {/* Right: User & Actions */}
      <div className="flex items-center justify-end gap-2">
        {/* Active Users */}
        <ActiveUsersInHeader />

        {/* Invite User */}
        <InviteUserButton />

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
            if (isPreviewMode) {
              // Exit preview mode
              setPreviewMode(false);
              updateQueryParams({ preview: undefined });
            } else {
              // Enter preview mode
              setPreviewMode(true);
              updateQueryParams({ preview: 'true' });
            }
          }}
          disabled={!currentPage || isSaving}
          className={isPreviewMode ? 'bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90' : ''}
        >
          <Icon name="preview" />
        </Button>

        <Popover open={showPublishPopover} onOpenChange={setShowPublishPopover}>
          <PopoverTrigger asChild>
            <Button size="sm" disabled={isSettingsRoute}>Publish</Button>
          </PopoverTrigger>

          <PopoverContent className="mr-4 mt-0.5">
            <div>
              <Label>{baseUrl}</Label>
              <span className="text-popover-foreground text-[10px]">{publishedAt ? `Published ${formatRelativeTime(publishedAt, false)}` : 'Never published'}</span>
            </div>

            <hr className="my-3" />

            <div className="flex items-center justify-between">

              {/* Publish Dialog */}
              <PublishDialog
                isOpen={showPublishDialog}
                onClose={() => setShowPublishDialog(false)}
                onSuccess={(publishedAtValue) => {
                  setShowPublishDialog(false);
                  setShowPublishPopover(false);

                  // Sync published timestamp to store from response
                  if (publishedAtValue) {
                    updateSetting('published_at', publishedAtValue);
                  }

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
    </>
  );
}
