'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import InputWithInlineVariables from '@/app/ycode/components/InputWithInlineVariables';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { InputAutocomplete } from '@/components/ui/input-autocomplete';
import { LOCALES, type Locale as LocaleOption, extractPageTranslatableItems } from '@/lib/localisation-utils';
import { useLocalisationStore } from '@/stores/useLocalisationStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { buildFolderPath, getPageIcon } from '@/lib/page-utils';
import type { Locale } from '@/types';
import { Separator } from '@/components/ui/separator';

interface LocalizationContentProps {
  children: React.ReactNode;
}

interface ModalState {
  isOpen: boolean;
  isEditMode: boolean;
  editingLocaleId: string | null;
  selectedLanguage: LocaleOption | null;
  customLocaleName: string;
  isDefaultLocale: boolean;
  localeSearch: string;
}

const initialModalState: ModalState = {
  isOpen: false,
  isEditMode: false,
  editingLocaleId: null,
  selectedLanguage: null,
  customLocaleName: '',
  isDefaultLocale: false,
  localeSearch: '',
};

export default function LocalizationContent({ children }: LocalizationContentProps) {
  // Store (locales are already sorted)
  const locales = useLocalisationStore((state) => state.locales);
  const selectedLocaleId = useLocalisationStore((state) => state.selectedLocaleId);
  const setSelectedLocaleId = useLocalisationStore((state) => state.setSelectedLocaleId);
  const createLocale = useLocalisationStore((state) => state.createLocale);
  const updateLocale = useLocalisationStore((state) => state.updateLocale);
  const deleteLocale = useLocalisationStore((state) => state.deleteLocale);
  const isLoading = useLocalisationStore((state) => state.isLoading);
  const error = useLocalisationStore((state) => state.error);
  const clearError = useLocalisationStore((state) => state.clearError);

  // Translation store functions
  const loadTranslations = useLocalisationStore((state) => state.loadTranslations);
  const getTranslationByKey = useLocalisationStore((state) => state.getTranslationByKey);
  const createTranslation = useLocalisationStore((state) => state.createTranslation);
  const updateTranslation = useLocalisationStore((state) => state.updateTranslation);
  const deleteTranslation = useLocalisationStore((state) => state.deleteTranslation);

  // Pages store
  const storePages = usePagesStore((state) => state.pages);
  const storeFolders = usePagesStore((state) => state.folders);
  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);

  // Collections store (for field names and variables)
  const allFields = useCollectionsStore((state) => state.fields);
  const collections = useCollectionsStore((state) => state.collections);

  // Local state
  const [modalState, setModalState] = useState<ModalState>(initialModalState);
  const [selectedContentType, setSelectedContentType] = useState<string>('pages');
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  // Local input values for immediate UI feedback (keyed by item.key)
  const [localInputValues, setLocalInputValues] = useState<Record<string, string>>({});

  const selectedLocale = locales.find(l => l.id === selectedLocaleId);

  // Load translations when locale changes
  useEffect(() => {
    if (selectedLocaleId) {
      loadTranslations(selectedLocaleId);
      // Clear local input values when switching locales
      setLocalInputValues({});
    }
  }, [selectedLocaleId, loadTranslations]);

  // Sort pages: by folder hierarchy order, then page order, error pages at the bottom
  const sortedPages = useMemo(() => {
    // Get ancestor folder at a specific depth
    const getAncestorAtDepth = (page: typeof storePages[0], targetDepth: number): { id: string | null; order: number; isFolder: boolean } => {
      if (page.depth === targetDepth) {
        return { id: page.page_folder_id, order: page.order ?? 0, isFolder: false };
      }

      // Page is deeper, find its ancestor folder at targetDepth
      let currentFolderId = page.page_folder_id;
      while (currentFolderId) {
        const folder = storeFolders.find(f => f.id === currentFolderId);
        if (!folder) break;

        if (folder.depth === targetDepth) {
          return { id: currentFolderId, order: folder.order ?? 0, isFolder: true };
        }

        currentFolderId = folder.page_folder_id;
      }

      return { id: null, order: page.order ?? 0, isFolder: false };
    };

    return [...storePages].sort((a, b) => {
      // Error pages at the bottom
      const aIsError = a.error_page !== null;
      const bIsError = b.error_page !== null;
      if (aIsError && !bIsError) return 1;
      if (!aIsError && bIsError) return -1;

      // Find the shallower depth to compare at
      const compareDepth = Math.min(a.depth, b.depth);

      // Get ancestors at the comparison depth
      const aAncestor = getAncestorAtDepth(a, compareDepth);
      const bAncestor = getAncestorAtDepth(b, compareDepth);

      // Compare orders at the same depth level
      const orderDiff = aAncestor.order - bAncestor.order;
      if (orderDiff !== 0) return orderDiff;

      // If same order at comparison depth, shallower items come first
      if (a.depth !== b.depth) {
        return a.depth - b.depth;
      }

      // Same depth and order, compare by page order
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }, [storePages, storeFolders]);

  // Initialize expanded pages when pages change
  useEffect(() => {
    if (sortedPages.length > 0 && expandedPages.size === 0) {
      setExpandedPages(new Set(sortedPages.map(p => p.id)));
    }
  }, [sortedPages, expandedPages.size]);

  // Build full page path segments for display
  const getPagePathSegments = (page: typeof sortedPages[0]): string[] => {
    const folder = page.page_folder_id ? storeFolders.find(f => f.id === page.page_folder_id) : null;
    const folderSegments = folder ? (buildFolderPath(folder, storeFolders, true) as string[]) : [];
    return [...folderSegments, page.name];
  };

  const togglePageExpansion = (pageId: string) => {
    setExpandedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  // Filter out locales that already exist
  const existingLocaleCodes = new Set(locales.map(l => l.code));
  const availableLocales = LOCALES.filter(l => !existingLocaleCodes.has(l.code));

  const handleAddLocale = async () => {
    if (!modalState.selectedLanguage || !modalState.customLocaleName.trim()) {
      return;
    }

    try {
      const newLocale = await createLocale({
        code: modalState.selectedLanguage.code,
        label: modalState.customLocaleName.trim(),
        is_default: modalState.isDefaultLocale,
      });

      if (newLocale) {
        setSelectedLocaleId(newLocale.id);
        setModalState(prev => ({ ...prev, isOpen: false }));
      }
    } catch (error) {
      console.error('Failed to create locale:', error);
    }
  };

  const handleUpdateLocale = async () => {
    if (!modalState.editingLocaleId || !modalState.customLocaleName.trim()) {
      return;
    }

    try {
      await updateLocale(modalState.editingLocaleId, {
        label: modalState.customLocaleName.trim(),
        is_default: modalState.isDefaultLocale,
      });

      setModalState(prev => ({ ...prev, isOpen: false }));
    } catch (error) {
      console.error('Failed to update locale:', error);
    }
  };

  const handleDeleteLocale = async () => {
    if (!modalState.editingLocaleId) {
      return;
    }

    try {
      await deleteLocale(modalState.editingLocaleId);
      setModalState(initialModalState);
    } catch (error) {
      console.error('Failed to delete locale:', error);
    }
  };

  const handleOpenEditDialog = (locale: Locale) => {
    clearError();

    // Set the selected language to show in the disabled selector
    const localeOption = LOCALES.find(l => l.code === locale.code);

    setModalState({
      isOpen: true,
      isEditMode: true,
      editingLocaleId: locale.id,
      customLocaleName: locale.label,
      isDefaultLocale: locale.is_default,
      selectedLanguage: localeOption || null,
      localeSearch: localeOption?.label || '',
    });
  };

  const handleCloseDialog = () => {
    setModalState(prev => ({ ...prev, isOpen: false }));
    clearError();
  };

  const handleSelectLanguage = (locale: LocaleOption | null) => {
    clearError();

    if (!locale) {
      setModalState(prev => ({
        ...prev,
        selectedLanguage: null,
        localeSearch: '',
        customLocaleName: '',
      }));
      return;
    }

    setModalState(prev => ({
      ...prev,
      localeSearch: locale.label,
      selectedLanguage: locale,
      customLocaleName: locale.label,
    }));
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Sidebar */}
      <div className="w-60 border-r flex flex-col px-4">
        <header className="py-5 flex justify-between items-center">
          <span className="font-medium">Localization</span>
          <Button
            size="xs"
            variant="secondary"
            onClick={() => {
              clearError();
              setModalState({
                ...initialModalState,
                isOpen: true,
              });
            }}
          >
            <Icon name="plus" className="size-3" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-0">
            {locales.map((locale) => {
              const isActive = selectedLocaleId === locale.id;

              return (
                <div
                  key={locale.id}
                  className={cn(
                    'group relative flex items-center h-8 rounded-lg w-full px-2 gap-1.5',
                    'hover:bg-secondary/50 cursor-pointer',
                    isActive && 'bg-primary text-primary-foreground hover:bg-primary',
                    !isActive && 'text-secondary-foreground/80 dark:text-muted-foreground'
                  )}
                  onClick={() => setSelectedLocaleId(locale.id)}
                >
                  <div className="flex items-center flex-1 outline-none focus:outline-none select-none text-left text-xs gap-1.5 min-w-0">
                    <span className="bg-secondary text-[10px] font-semibold py-0.5 px-1.5 rounded-[6px] uppercase shrink-0">{locale.code}</span>
                    <Label className="cursor-[inherit] min-w-0 flex-1">
                      <div className="truncate">{locale.label}</div>
                    </Label>
                    {locale.is_default && <Badge variant="secondary" className="shrink-0 ml-auto text-[10px]">Default</Badge>}
                  </div>

                  <Button
                    size="xs"
                    variant="ghost"
                    className="hidden group-hover:flex"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditDialog(locale);
                    }}
                  >
                    <Icon name="more" className="size-3" />
                  </Button>
                </div>
              );
            })}
            {locales.length === 0 && (
              <div className="px-2 py-4 text-xs text-muted-foreground">
                {isLoading.load ? 'Loading locales...' : 'No locales added yet'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedLocale ? (
          <div>
            <div className="sticky top-0 z-10 h-16 bg-background p-4 flex items-center gap-2 border-b">
              <div>
                <Select value={selectedContentType} onValueChange={setSelectedContentType}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pages"><Icon name="page" className="size-3" /> Pages</SelectItem>
                    <SelectItem value="folders"><Icon name="folder" className="size-3" /> Folders</SelectItem>
                    <SelectItem value="cms"><Icon name="database" className="size-3" /> CMS</SelectItem>
                    <SelectItem value="components"><Icon name="component" className="size-3" /> Components</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full max-w-72">
                <InputGroup>
                  <InputGroupInput
                    placeholder="Search..."
                  />
                  <InputGroupAddon>
                    <Icon name="search" className="size-3" />
                  </InputGroupAddon>
                </InputGroup>
              </div>

              <div className="ml-auto">
                <Button size="sm" variant="secondary">Auto-translate</Button>
              </div>
            </div>

            {selectedContentType === 'pages' && (
              <div>
                {sortedPages.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    No pages found
                  </div>
                ) : (
                  sortedPages.map((page) => {
                    const isExpanded = expandedPages.has(page.id);

                    return (
                      <div key={page.id}>
                        <header
                          className="sticky top-16 z-[5] border-b cursor-pointer bg-background"
                          onClick={() => togglePageExpansion(page.id)}
                        >
                          <div className="p-4 flex items-center gap-1.5 bg-secondary/10 hover:bg-secondary/35 transition-colors">
                            <Icon
                              name="chevronRight"
                              className={cn(
                                'size-3 transition-transform',
                                isExpanded && 'rotate-90'
                              )}
                            />
                            <div className="size-5.5 flex items-center justify-center rounded-[6px] bg-secondary/50">
                              <Icon name={getPageIcon(page)} className="size-3 opacity-60" />
                            </div>
                            <Label className="flex items-center gap-1">
                              {getPagePathSegments(page).map((segment, index, array) => (
                                <React.Fragment key={index}>
                                  <span>{segment}</span>
                                  {index < array.length - 1 && (
                                    <Icon name="chevronRight" className="size-3 opacity-60" />
                                  )}
                                </React.Fragment>
                              ))}
                            </Label>
                          </div>
                        </header>

                        {isExpanded && (() => {
                          const draft = draftsByPageId[page.id];
                          const layers = draft?.layers || [];
                          const translatableItems = extractPageTranslatableItems(page, layers);

                          if (translatableItems.length === 0) {
                            return (
                              <div className="py-8 text-center text-muted-foreground text-xs border-b">
                                No translatable text elements found
                              </div>
                            );
                          }

                          return (
                            <ul className="border-b px-4 py-5 flex flex-col gap-5">
                              {translatableItems.map((item) => (
                                <li key={item.key} className="flex flex-col gap-1.5">
                                  {/* Item header */}
                                  <div className="flex items-center gap-1.75">
                                    <div className="size-5 flex items-center justify-center rounded-[6px] bg-secondary/50">
                                      <Icon name={item.info.icon} className="shrink-0 size-2.5 opacity-50" />
                                    </div>

                                    <span className="text-xs font-medium opacity-60">{item.info.label}</span>

                                    {item.info.description && (
                                      <>
                                        <Separator className="w-3! bg-foreground/8" />
                                        <div className="text-[11px] text-muted-foreground/70">{item.info.description}</div>
                                      </>
                                    )}

                                    <Separator className="min-w-0 flex-1 bg-foreground/8" />
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <div className="w-full grid grid-cols-2 gap-2">
                                      {/* Left side (default locale value, read-only) */}
                                      <div className="text-sm opacity-50">
                                        {(() => {
                                          // Get fields for this page's collection (if dynamic)
                                          const pageCollectionId = page.settings?.cms?.collection_id;
                                          const pageFields = pageCollectionId ? (allFields[pageCollectionId] || []) : [];
                                          const collection = pageCollectionId ? collections.find(c => c.id === pageCollectionId) : null;

                                          return (
                                            <InputWithInlineVariables
                                              value={item.content_value}
                                              onChange={() => {}} // Read-only on left side
                                              placeholder=""
                                              fields={pageFields}
                                              fieldSourceLabel={collection?.name}
                                              allFields={allFields}
                                              collections={collections}
                                              disabled={true}
                                            />
                                          );
                                        })()}
                                      </div>

                                      {/* Right side (translation value, editable) */}
                                      <div className="flex flex-col h-full *:flex-1">
                                        {(() => {
                                          // Get fields for this page's collection (if dynamic)
                                          const pageCollectionId = page.settings?.cms?.collection_id;
                                          const pageFields = pageCollectionId ? (allFields[pageCollectionId] || []) : [];
                                          const collection = pageCollectionId ? collections.find(c => c.id === pageCollectionId) : null;

                                          // Get translation from store
                                          const translation = selectedLocaleId
                                            ? getTranslationByKey(selectedLocaleId, item.key)
                                            : null;
                                          const storeValue = translation?.content_value || '';

                                          // Use local value if available, otherwise use store value
                                          const translationValue = localInputValues[item.key] !== undefined
                                            ? localInputValues[item.key]
                                            : storeValue;

                                          // Update local state on change (immediate UI feedback)
                                          const handleTranslationChange = (value: string) => {
                                            setLocalInputValues(prev => ({
                                              ...prev,
                                              [item.key]: value,
                                            }));
                                          };

                                          // Save to store/API on blur (optimistic update + API call)
                                          const handleTranslationBlur = (value: string) => {
                                            if (!selectedLocaleId) return;

                                            // Clear local value (will use store value after save)
                                            setLocalInputValues(prev => {
                                              const next = { ...prev };
                                              delete next[item.key];
                                              return next;
                                            });

                                            const translationData = {
                                              locale_id: selectedLocaleId,
                                              source_type: item.source_type,
                                              source_id: item.source_id,
                                              content_key: item.content_key,
                                              content_type: item.content_type,
                                              content_value: value,
                                            };

                                            if (translation) {
                                              // Update existing translation (optimistic + API call)
                                              updateTranslation(translation, { content_value: value });
                                            } else {
                                              // Create new translation (optimistic + API call)
                                              createTranslation(translationData);
                                            }
                                          };

                                          return (
                                            <InputWithInlineVariables
                                              value={translationValue}
                                              onChange={handleTranslationChange}
                                              onBlur={handleTranslationBlur}
                                              placeholder="Enter translation..."
                                              className="min-h-[28px] [&_.ProseMirror]:py-1 [&_.ProseMirror]:px-2.5 [&_.ProseMirror]:!bg-transparent"
                                              fields={pageFields}
                                              fieldSourceLabel={collection?.name}
                                              allFields={allFields}
                                              collections={collections}
                                            />
                                          );
                                        })()}
                                      </div>
                                    </div>

                                    {/* Dropdown menu */}
                                    <div className="">
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button size="sm" variant="ghost">
                                            <Icon name="more" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem>Done</DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={async () => {
                                              if (!selectedLocaleId) return;
                                              const translation = getTranslationByKey(selectedLocaleId, item.key);
                                              if (translation) {
                                                await deleteTranslation(translation);
                                              }
                                            }}
                                          >
                                            Reset
                                          </DropdownMenuItem>
                                          <DropdownMenuItem>Auto-translate</DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          );
                        })()}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        ) : (
          children
        )}
      </div>

      {/* Add/Edit Locale Dialog */}
      <Dialog open={modalState.isOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{modalState.isEditMode ? 'Edit locale' : 'Add locale'}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {error && (
              <div className="px-3 py-2 text-xs text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="language">Locale</Label>

              <InputAutocomplete
                id="language"
                search={modalState.localeSearch}
                onSearchChange={(value) => setModalState(prev => ({ ...prev, localeSearch: value }))}
                options={availableLocales}
                selected={modalState.selectedLanguage}
                onSelect={handleSelectLanguage}
                placeholder="Search for a locale"
                searchableKeys={['label', 'native_label', 'code']}
                disabled={modalState.isEditMode}
                renderItem={(locale) => (
                  <div className="flex items-center justify-between px-1.5 py-1.25 text-xs">
                    <div className="flex items-center gap-2">
                      <span>{locale.label}</span>
                      <span className="text-muted-foreground">{locale.native_label}</span>
                    </div>
                    <Badge variant="secondary" className="uppercase text-[10px]">
                      {locale.code}
                    </Badge>
                  </div>
                )}
                renderEmpty={() => (
                  <div className="px-3 py-6 text-center text-muted-foreground text-xs">
                    No locales found
                  </div>
                )}
              />
            </div>

            <div className="flex gap-3">
              <div className="flex flex-col gap-2 flex-1">
                <Label htmlFor="name">Custom name</Label>
                <Input
                  id="name"
                  value={modalState.customLocaleName}
                  onChange={(e) => setModalState(prev => ({ ...prev, customLocaleName: e.target.value }))}
                  placeholder="Custom name"
                />
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <Label htmlFor="code">Locale code</Label>
                <Input
                  id="code"
                  value={modalState.selectedLanguage?.code || ''}
                  disabled
                  placeholder="Code"
                  className={modalState.selectedLanguage?.code ? 'uppercase' : ''}
                />
              </div>
            </div>

            {(() => {
              const editingLocale = modalState.isEditMode
                ? locales.find(l => l.id === modalState.editingLocaleId)
                : null;
              const isCurrentlyDefault = editingLocale?.is_default ?? false;
              const shouldDisable = modalState.isEditMode && isCurrentlyDefault;

              return (
                <div className="mt-1 flex items-start gap-2">
                  <Switch
                    id="is-default"
                    checked={modalState.isDefaultLocale}
                    onCheckedChange={(checked) => setModalState(prev => ({ ...prev, isDefaultLocale: checked }))}
                    disabled={shouldDisable}
                  />

                  <Label
                    htmlFor="is-default"
                    className={cn('cursor-pointer flex-col items-start gap-0.5', shouldDisable && 'cursor-not-allowed opacity-50')}
                  >
                    <span>Set as default locale</span>
                    <span className="text-muted-foreground/75">All your pages and CMS contents should be written in this locale.</span>
                  </Label>
                </div>
              );
            })()}
          </div>

          <DialogFooter className="justify-between">
            {modalState.isEditMode && (() => {
              const editingLocale = locales.find(l => l.id === modalState.editingLocaleId);
              const isCurrentlyDefault = editingLocale?.is_default ?? false;
              const isOnlyLocale = locales.length === 1;
              const isDisabled = isLoading.delete || isOnlyLocale || isCurrentlyDefault;

              let tooltipMessage = '';
              if (isCurrentlyDefault) {
                tooltipMessage = 'Cannot delete the default locale';
              } else if (isOnlyLocale) {
                tooltipMessage = 'Cannot delete the only locale';
              }

              const button = (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteLocale}
                  size="sm"
                  disabled={isDisabled}
                >
                  <Icon name="trash" className="size-3" />
                  Delete
                </Button>
              );

              if (isDisabled && tooltipMessage && !isLoading.delete) {
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {button}
                    </TooltipTrigger>
                    <TooltipContent>
                      {tooltipMessage}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return button;
            })()}

            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCloseDialog}
                size="sm"
                disabled={isLoading.create || isLoading.update || isLoading.delete}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={modalState.isEditMode ? handleUpdateLocale : handleAddLocale}
                disabled={
                  modalState.isEditMode
                    ? !modalState.customLocaleName.trim() || isLoading.update
                    : !modalState.selectedLanguage || !modalState.customLocaleName.trim() || isLoading.create
                }
                size="sm"
              >
                {modalState.isEditMode ? 'Update' : 'Add'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
