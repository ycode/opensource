'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { selectVariants } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import Icon from '@/components/ui/icon';
import { useFontsStore } from '@/stores/useFontsStore';
import { BUILT_IN_FONTS, ALLOWED_FONT_EXTENSIONS, getFontFamilyValue } from '@/lib/font-utils';
import { loadGoogleFontPreview, resetGoogleFontPreview } from '@/lib/google-font-preview';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';
import type { Font } from '@/types';

const PAGE_SIZE = 50;

interface FontPickerProps {
  value: string; // Current fontFamily value (e.g., 'sans', 'Open Sans')
  onChange: (value: string) => void;
}

export default function FontPicker({ value, onChange }: FontPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'installed' | 'google'>('installed');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [fontToDelete, setFontToDelete] = useState<Font | null>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const googleListRef = useRef<HTMLDivElement>(null);

  const {
    fonts,
    isLoaded,
    loadFonts,
    googleSearchResults,
    isCatalogLoaded,
    loadGoogleFontsCatalog,
    searchGoogleFonts,
    addGoogleFont,
    uploadCustomFonts,
    deleteFont,
  } = useFontsStore();

  // Load installed fonts + Google catalog on mount (not waiting for popover)
  useEffect(() => {
    if (!isLoaded) loadFonts();
    loadGoogleFontsCatalog();
  }, [isLoaded, loadFonts, loadGoogleFontsCatalog]);

  // Populate search results as soon as catalog is ready (enables preloading)
  useEffect(() => {
    if (isCatalogLoaded) {
      searchGoogleFonts('');
    }
  }, [isCatalogLoaded, searchGoogleFonts]);

  // Re-filter when search query changes on Google tab
  useEffect(() => {
    if (activeTab === 'google' && isCatalogLoaded) {
      searchGoogleFonts(debouncedSearch);
      setVisibleCount(PAGE_SIZE);
      googleListRef.current?.scrollTo(0, 0);
    }
  }, [activeTab, debouncedSearch, isCatalogLoaded, searchGoogleFonts]);

  // Preload first 50 Google Font faces once results are populated
  useEffect(() => {
    if (googleSearchResults.length > 0) {
      loadGoogleFontPreview(googleSearchResults.slice(0, 50).map(f => f.family));
    }
  }, [googleSearchResults]);

  // Reset pagination when popover closes; clean up font CSS on unmount
  useEffect(() => {
    if (!isOpen) {
      setVisibleCount(PAGE_SIZE);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => resetGoogleFontPreview();
  }, []);

  // Paginated Google results
  const paginatedGoogleResults = useMemo(
    () => googleSearchResults.slice(0, visibleCount),
    [googleSearchResults, visibleCount]
  );
  const hasMore = visibleCount < googleSearchResults.length;

  // Infinite scroll via scroll event on the Google list container
  const handleGoogleScroll = useCallback(() => {
    const el = googleListRef.current;
    if (!el || !hasMore) return;

    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      setVisibleCount(prev => prev + PAGE_SIZE);
    }
  }, [hasMore]);

  // Load Google Font CSS for currently visible fonts
  useEffect(() => {
    if (paginatedGoogleResults.length > 0) {
      loadGoogleFontPreview(paginatedGoogleResults.map(f => f.family));
    }
  }, [paginatedGoogleResults]);

  // Get display label for current value
  const getDisplayLabel = useCallback(() => {
    if (!value || value === 'inherit') return 'Inherit';

    // Check built-in fonts
    const builtIn = BUILT_IN_FONTS.find(f => f.name === value);
    if (builtIn) return builtIn.family;

    // Check installed fonts
    const installed = fonts.find(f =>
      getFontFamilyValue(f) === value || f.family === value || f.name === value
    );
    if (installed) return installed.family;

    // Format slug (e.g. "open-sans" or "open_sans") into readable name
    return value
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }, [value, fonts]);

  // Filter and group installed fonts by type
  const filterBySearch = (font: Font) =>
    !searchQuery || font.family.toLowerCase().includes(searchQuery.toLowerCase());

  const defaultFonts = BUILT_IN_FONTS.filter(filterBySearch);
  const customFonts = fonts.filter(f => f.type === 'custom' && filterBySearch(f));
  const googleFonts = fonts.filter(f => f.type === 'google' && filterBySearch(f));
  const hasFilteredResults = defaultFonts.length > 0 || customFonts.length > 0 || googleFonts.length > 0;

  // Handle selecting a font
  const handleSelectFont = (font: Font) => {
    const familyValue = getFontFamilyValue(font);
    onChange(familyValue);
  };

  // Handle selecting "Inherit" (remove font)
  const handleSelectInherit = () => {
    onChange('inherit');
  };

  // Handle adding a Google Font
  const handleAddGoogleFont = async (googleFont: { family: string; variants: string[]; category: string }) => {
    try {
      const font = await addGoogleFont(googleFont as any);
      if (font) {
        const familyValue = getFontFamilyValue(font);
        onChange(familyValue);
      }
    } catch (error) {
      console.error('Failed to add Google Font:', error);
    }
  };

  // Handle custom font upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    try {
      const uploaded = await uploadCustomFonts(files);
      if (uploaded.length > 0) {
        const familyValue = getFontFamilyValue(uploaded[0]);
        onChange(familyValue);
      }
    } catch (error) {
      console.error('Failed to upload fonts:', error);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle deleting a font
  const handleDeleteFont = (e: React.MouseEvent, fontId: string) => {
    e.stopPropagation();
    const font = fonts.find(f => f.id === fontId);
    if (font) setFontToDelete(font);
  };

  const confirmDeleteFont = async () => {
    if (!fontToDelete) return;
    try {
      const wasSelected = isSelected(fontToDelete);
      await deleteFont(fontToDelete.id);
      if (wasSelected) onChange('inherit');
    } catch (error) {
      console.error('Failed to delete font:', error);
    }
  };

  // Check if a font is currently selected
  const isSelected = (font: Font) => {
    const familyValue = getFontFamilyValue(font);
    return value === familyValue || value === font.name || value === font.family;
  };

  /** Shared class for font option items (matches ShadCN SelectItem styling) */
  const optionClass = `group flex w-full items-center rounded-sm cursor-pointer select-none text-xs hover:bg-accent hover:text-accent-foreground`;

  /** Render a grouped section of fonts with a label */
  const renderFontSection = (label: string, sectionFonts: Font[], options?: { deletable?: boolean; prepend?: React.ReactNode }) => (
    <React.Fragment key={label}>
      <div className="flex items-center gap-2 px-2 pt-2.5 pb-1">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400 shrink-0">
          {label}
        </span>
        <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
      </div>
      {options?.prepend}
      {sectionFonts.map((font) => {
        const active = isSelected(font);
        return (
          <div
            key={font.id}
            className={optionClass}
          >
            <button
              className="flex-1 text-left px-2 py-1.5 text-xs truncate cursor-pointer"
              style={{ fontFamily: getFontPreviewFamily(font) }}
              title={font.family}
              onClick={() => handleSelectFont(font)}
            >
              {font.family}
            </button>

            {active && !options?.deletable && (
              <Icon name="check" className="size-3 opacity-50 shrink-0 mr-2" />
            )}

            {options?.deletable && (
              active ? (
                <Icon name="check" className="size-3 opacity-50 shrink-0 mr-2 group-hover:hidden" />
              ) : null
            )}
            {options?.deletable && (
              <Button
                variant="ghost"
                size="xs"
                className={`shrink-0 mr-1 ${active ? 'hidden group-hover:flex opacity-0 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                onClick={(e) => handleDeleteFont(e, font.id)}
              >
                <Icon name="x" className="size-3" />
              </Button>
            )}
          </div>
        );
      })}
    </React.Fragment>
  );

  /** CSS font-family for an installed font (default fonts use system stacks) */
  const getFontPreviewFamily = (font: Font): string => {
    if (font.type === 'default') {
      switch (font.name) {
        case 'sans': return 'ui-sans-serif, system-ui, sans-serif';
        case 'serif': return 'ui-serif, Georgia, serif';
        case 'mono': return 'ui-monospace, monospace';
        default: return 'sans-serif';
      }
    }
    const fallback = font.category === 'serif' ? 'serif'
      : font.category === 'monospace' ? 'monospace' : 'sans-serif';
    return `'${font.family}', ${fallback}`;
  };

  /** CSS fallback stack per Google Font category */
  const categoryFallback = (category: string) => {
    switch (category) {
      case 'serif': return ', serif';
      case 'monospace': return ', monospace';
      case 'handwriting': return ', cursive';
      case 'display': return ', system-ui';
      default: return ', sans-serif';
    }
  };

  return (
    <>
      <Popover
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) setSearchQuery('');
        }}
        modal
      >
        <PopoverTrigger asChild>
          <button
            className={cn(
              selectVariants({ variant: 'default', size: 'sm' }),
              'w-full justify-between'
            )}
          >
            <span className="truncate">{getDisplayLabel()}</span>
            <Icon name="chevronCombo" className="size-2.5 opacity-50" />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-56 p-0" align="end">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'installed' | 'google')}
          >
            <div className="px-2 pt-2">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="installed">Installed</TabsTrigger>
                <TabsTrigger value="google">Google</TabsTrigger>
              </TabsList>
            </div>

            <div className="relative px-2">
              <Input
                placeholder={activeTab === 'google' ? 'Filter Google fonts...' : 'Filter installed fonts...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pr-8"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="absolute right-4 top-1/2 -translate-y-1/2 size-6 p-0"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <Icon name="x" className="size-3" />
                </Button>
              )}
            </div>

            {/* Installed Fonts Tab */}
            <TabsContent value="installed" className="mt-0">
              <div className="max-h-80 overflow-y-auto px-1 pb-1">
                {customFonts.length > 0 && renderFontSection('Custom', customFonts, { deletable: true })}
                {googleFonts.length > 0 && renderFontSection('Google', googleFonts, { deletable: true })}
                {defaultFonts.length > 0 && renderFontSection('Default', defaultFonts, {
                  prepend: (
                    <div className={optionClass}>
                      <button
                        className="flex-1 text-left px-2 py-1.5 text-xs cursor-pointer"
                        onClick={handleSelectInherit}
                      >
                        Inherit
                      </button>
                      {(!value || value === 'inherit') && (
                        <Icon name="check" className="size-3 opacity-50 shrink-0 mr-2" />
                      )}
                    </div>
                  ),
                })}

                {!hasFilteredResults && searchQuery && (
                  <div className="px-2 py-5 text-center text-xs">
                    No fonts match &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>

              {/* Upload custom font */}
              <div className="p-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept={ALLOWED_FONT_EXTENSIONS.map(ext => `.${ext}`).join(',')}
                  multiple
                  onChange={handleFileUpload}
                />
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload font
                </Button>
              </div>
            </TabsContent>

            {/* Google Fonts Tab */}
            <TabsContent value="google" className="mt-0">
              <div
                ref={googleListRef}
                className="max-h-80 overflow-y-auto px-1 pb-1"
                onScroll={handleGoogleScroll}
              >
                {!isCatalogLoaded && (
                  <div className="flex items-center justify-center py-6">
                    <Spinner />
                  </div>
                )}

                {isCatalogLoaded && googleSearchResults.length === 0 && (
                  <div className="px-2 py-4 text-center text-xs text-zinc-500">
                    {searchQuery ? 'No fonts found' : 'No Google Fonts available'}
                  </div>
                )}

                {isCatalogLoaded && paginatedGoogleResults.map((gFont) => {
                  const installedFont = fonts.find(f =>
                    f.family === gFont.family && f.type === 'google'
                  );

                  const handleClick = () => {
                    if (installedFont) {
                      onChange(getFontFamilyValue(installedFont));
                    } else {
                      handleAddGoogleFont(gFont);
                    }
                  };

                  return (
                    <div
                      key={gFont.family}
                      className="flex w-full items-center rounded-sm select-none text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground"
                    >
                      <button
                        className="flex-1 text-left px-2 py-1.5 text-xs truncate min-w-0 cursor-pointer"
                        style={{ fontFamily: `'${gFont.family}'${categoryFallback(gFont.category)}` }}
                        title={gFont.family}
                        onClick={handleClick}
                      >
                        {gFont.family}
                        {installedFont && (
                          <span className="ml-1.5 text-[10px] opacity-50 font-sans">
                            Installed
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}

                {/* Spacer to trigger scroll near bottom */}
                {hasMore && <div className="h-1" />}
              </div>
            </TabsContent>
          </Tabs>
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={!!fontToDelete}
        onOpenChange={(open) => { if (!open) setFontToDelete(null); }}
        title="Delete font"
        description={`Are you sure you want to remove the font "${fontToDelete?.family}"? All text elements using this font will no longer be able to display it.`}
        confirmLabel="Delete"
        onConfirm={confirmDeleteFont}
      />
    </>
  );
}
