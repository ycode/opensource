/* eslint-disable @next/next/no-img-element */
'use client';

/**
 * Collection Item Sheet
 *
 * Reusable sheet for creating/editing collection items.
 * Can be used from CMS page or triggered from builder canvas.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetActions,
} from '@/components/ui/sheet';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import RichTextEditor from './RichTextEditor';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useCollectionLayerStore } from '@/stores/useCollectionLayerStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useAssetsStore } from '@/stores/useAssetsStore';
import { useLiveCollectionUpdates } from '@/hooks/use-live-collection-updates';
import { useResourceLock } from '@/hooks/use-resource-lock';
import { slugify, normalizeBooleanValue } from '@/lib/collection-utils';
import { validateFieldValue, isAssetFieldType, isMultipleAssetField, getFieldIcon } from '@/lib/collection-field-utils';
import { ASSET_CATEGORIES, getOptimizedImageUrl, isAssetOfType, formatFileSize, getFileExtension } from '@/lib/asset-utils';
import { formatDateInTimezone, localDatetimeToUTC } from '@/lib/date-format-utils';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { toast } from 'sonner';
import ReferenceFieldCombobox from './ReferenceFieldCombobox';
import CollectionLinkFieldInput from './CollectionLinkFieldInput';
import type { Asset, CollectionFieldType, CollectionItemWithValues } from '@/types';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

// Asset field configuration maps
const ASSET_CATEGORY_MAP = {
  image: ASSET_CATEGORIES.IMAGES,
  audio: ASSET_CATEGORIES.AUDIO,
  video: ASSET_CATEGORIES.VIDEOS,
  document: ASSET_CATEGORIES.DOCUMENTS,
} as const;

const FIELD_LABEL_MAP = { image: 'image', audio: 'audio', video: 'video', document: 'document' } as const;
const ADD_BUTTON_LABEL_MAP = { image: 'an image', audio: 'an audio', video: 'a video', document: 'a document' } as const;

/** Get asset category filter for a field type */
function getAssetCategoryForField(fieldType: CollectionFieldType) {
  return ASSET_CATEGORY_MAP[fieldType as keyof typeof ASSET_CATEGORY_MAP] ?? ASSET_CATEGORIES.DOCUMENTS;
}

/** Get label for a field type */
function getFieldLabel(fieldType: CollectionFieldType) {
  return FIELD_LABEL_MAP[fieldType as keyof typeof FIELD_LABEL_MAP] ?? 'file';
}

/** Validate asset type for a field */
function isValidAssetType(asset: Asset, fieldType: CollectionFieldType): boolean {
  if (fieldType === 'image') {
    return !!(asset.mime_type && (isAssetOfType(asset.mime_type, ASSET_CATEGORIES.IMAGES) || isAssetOfType(asset.mime_type, ASSET_CATEGORIES.ICONS)));
  }
  const category = getAssetCategoryForField(fieldType);
  return !!(asset.mime_type && isAssetOfType(asset.mime_type, category));
}

/** Get file manager category filter for a field type */
function getFileManagerCategory(fieldType: CollectionFieldType) {
  return fieldType === 'image' ? [ASSET_CATEGORIES.IMAGES, ASSET_CATEGORIES.ICONS] : getAssetCategoryForField(fieldType);
}

interface AssetFieldCardProps {
  asset: Asset | null;
  fieldType: CollectionFieldType;
  onChangeFile: () => void;
  onRemove: () => void;
}

/** Reusable card component for displaying an asset in a CMS field */
function AssetFieldCard({ asset, fieldType, onChangeFile, onRemove }: AssetFieldCardProps) {
  const isImageField = fieldType === 'image' && asset;
  const isSvgIcon = isImageField && (!!asset!.content || (asset!.mime_type && isAssetOfType(asset!.mime_type, ASSET_CATEGORIES.ICONS)));
  const imageUrl = isImageField && asset!.public_url ? asset!.public_url : null;
  const showCheckerboard = isImageField && (isSvgIcon || !!imageUrl);

  return (
    <div className="bg-input p-2 rounded-lg flex items-center gap-4">
      <div className="relative group bg-secondary/30 rounded-md w-full aspect-square overflow-hidden max-w-24 shrink-0">
        {showCheckerboard && (
          <div className="absolute inset-0 opacity-10 bg-checkerboard" />
        )}
        {isImageField ? (
          isSvgIcon && asset!.content ? (
            <div
              data-icon
              className="relative w-full h-full flex items-center justify-center p-2 pointer-events-none text-foreground z-10"
              dangerouslySetInnerHTML={{ __html: asset!.content }}
            />
          ) : imageUrl ? (
            <img
              src={getOptimizedImageUrl(imageUrl)}
              className="relative w-full h-full object-contain pointer-events-none z-10"
              alt="Image preview"
              loading="lazy"
            />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center z-10 text-muted-foreground">
              <Icon name="image" className="size-6" />
            </div>
          )
        ) : (
          <div className="relative w-full h-full flex items-center justify-center z-10 text-muted-foreground">
            {asset && <Icon name={getFieldIcon(fieldType)} className="size-6" />}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {asset && (
          <div className="flex flex-col gap-1">
            <Label className="truncate">{asset.filename}</Label>
            <span className="text-xs text-current/60 inline-flex gap-2 items-center flex-wrap">
              {getFileExtension(asset.mime_type)}
              <div className="size-0.5 bg-current/50 rounded-full inline-flex" />
              {formatFileSize(asset.file_size)}
              {asset.width && asset.height && (
                <>
                  <div className="size-0.5 bg-current/50 rounded-full inline-flex" />
                  {asset.width}×{asset.height}
                </>
              )}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onChangeFile(); }}
          >
            {asset ? 'Change file' : 'Choose file'}
          </Button>
          {asset && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface CollectionItemSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string;
  itemId?: string | null; // null = create new, string = edit existing
  onSuccess?: () => void;
}

export default function CollectionItemSheet({
  open,
  onOpenChange,
  collectionId,
  itemId,
  onSuccess,
}: CollectionItemSheetProps) {
  const { collections, fields, items, updateItem, createItem } = useCollectionsStore();
  const { updateItemInLayerData, refetchLayersForCollection } = useCollectionLayerStore();
  const { updatePageCollectionItem, refetchPageCollectionItem, pages } = usePagesStore();
  const { currentPageId, openFileManager } = useEditorStore();
  const getAsset = useAssetsStore((state) => state.getAsset);
  const timezone = useSettingsStore((state) => state.settingsByKey.timezone as string | null) ?? 'UTC';

  // Collection collaboration sync
  const liveCollectionUpdates = useLiveCollectionUpdates();

  // Item locking for collaboration
  const itemLock = useResourceLock({
    resourceType: 'collection_item',
    channelName: collectionId ? `collection:${collectionId}:item_locks` : '',
  });

  // Stable ref for lock functions to avoid dependency issues in effects
  const itemLockRef = useRef(itemLock);
  useEffect(() => {
    itemLockRef.current = itemLock;
  }, [itemLock]);

  const lockedItemIdRef = useRef<string | null>(null);

  const [editingItem, setEditingItem] = useState<CollectionItemWithValues | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const collection = collections.find(c => c.id === collectionId);
  const collectionFields = useMemo(
    () => (collectionId ? (fields[collectionId] || []) : []),
    [collectionId, fields]
  );
  const collectionItems = useMemo(
    () => (collectionId ? (items[collectionId] || []) : []),
    [collectionId, items]
  );

  // Check if the current page is a dynamic page using this collection
  const currentPage = currentPageId ? pages.find(p => p.id === currentPageId) : null;
  const isPageLevelItem = currentPage?.is_dynamic && currentPage?.settings?.cms?.collection_id === collectionId;

  // Find name and slug fields for validation
  const nameField = useMemo(
    () => collectionFields.find(f => f.key === 'name'),
    [collectionFields]
  );

  const slugField = useMemo(
    () => collectionFields.find(f => f.key === 'slug'),
    [collectionFields]
  );

  // Validate slug uniqueness
  const validateSlugUniqueness = useCallback(
    (value: string, fieldId: string) => {
      if (!value) return true; // Allow empty (other validation can handle required)
      // Check if slug exists in other items (exclude current item when editing)
      const existingItem = collectionItems.find(
        item => item.values[fieldId] === value && item.id !== editingItem?.id
      );
      return !existingItem;
    },
    [collectionItems, editingItem?.id]
  );

  const form = useForm();

  // Helper to detect temporary IDs (from optimistic creates)
  const isTempId = (id: string | null | undefined): boolean => {
    return !!id && (id.startsWith('temp-') || id.startsWith('temp-dup-'));
  };

  // Load item data when sheet opens with an itemId
  useEffect(() => {
    // Only load item data when sheet is open and we have an itemId
    if (!open) return;

    if (itemId && collectionItems.length > 0) {
      const item = collectionItems.find(i => i.id === itemId);
      // If itemId is a temp ID, also try to find by matching the temp pattern
      // (the item might have been replaced with the real ID)
      if (!item && isTempId(itemId)) {
        // Item with temp ID not found - it may have been replaced with real ID
        // Keep the current editingItem if it exists
        return;
      }
      setEditingItem(item || null);
    } else if (!itemId) {
      setEditingItem(null);
    }
  }, [itemId, open, collectionItems]);

  // Acquire/release item lock when sheet opens/closes
  useEffect(() => {
    const acquireItemLock = async () => {
      if (open && itemId && itemId !== 'new') {
        const acquired = await itemLockRef.current.acquireLock(itemId);
        if (acquired) {
          lockedItemIdRef.current = itemId;
        }
      }
    };

    const releaseItemLock = async () => {
      if (lockedItemIdRef.current) {
        await itemLockRef.current.releaseLock(lockedItemIdRef.current);
        lockedItemIdRef.current = null;
      }
    };

    if (open && itemId && itemId !== 'new') {
      acquireItemLock();
    } else {
      releaseItemLock();
    }

    return () => {
      releaseItemLock();
    };
  }, [open, itemId]);

  // Reset form when editing item changes
  useEffect(() => {
    if (editingItem) {
      // Ensure all values are defined (not undefined)
      const values: Record<string, any> = {};
      collectionFields.forEach(field => {
        let value = editingItem.values[field.id] ?? '';
        // Normalize boolean values to strings
        if (field.type === 'boolean') {
          value = normalizeBooleanValue(value);
        }
        values[field.id] = value;
      });
      form.reset(values);
    } else {
      // Reset with default values for new items
      const defaultValues: Record<string, any> = {};
      collectionFields.forEach(field => {
        let value = field.default || '';
        // Normalize boolean values to strings
        if (field.type === 'boolean') {
          value = normalizeBooleanValue(value);
        }
        defaultValues[field.id] = value;
      });
      form.reset(defaultValues);
    }
  }, [editingItem, collectionFields, form]);

  // Handle auto-focus on sheet open
  const handleOpenAutoFocus = useCallback((e: Event) => {
    // Only focus name field when creating a new item
    if (!itemId && nameInputRef.current) {
      e.preventDefault(); // Prevent default focus behavior
      nameInputRef.current.focus();
    }
  }, [itemId]);

  // Auto-fill slug field based on name field (debounced to avoid race conditions)
  useEffect(() => {
    if (!editingItem) {
      const nameField = collectionFields.find(f => f.key === 'name');
      const localSlugField = collectionFields.find(f => f.key === 'slug');

      if (nameField && localSlugField) {
        let timeoutId: NodeJS.Timeout | null = null;

        const subscription = form.watch((value, { name }) => {
          if (name === nameField.id) {
            // Clear any pending timeout
            if (timeoutId) {
              clearTimeout(timeoutId);
            }

            // Debounce the slug update to ensure we have the latest value
            timeoutId = setTimeout(() => {
              const nameValue = form.getValues(nameField.id);
              if (nameValue && typeof nameValue === 'string') {
                const slugValue = slugify(nameValue);
                form.setValue(localSlugField.id, slugValue);
              }
            }, 50);
          }
        });

        return () => {
          subscription.unsubscribe();
          if (timeoutId) {
            clearTimeout(timeoutId);
          }
        };
      }
    }
  }, [form, editingItem, collectionFields]);

  const handleSubmit = (values: Record<string, any>) => {
    if (!collectionId) return;

    // Normalize boolean values to strings before submitting
    collectionFields.forEach(field => {
      if (field.type === 'boolean' && field.id in values) {
        values[field.id] = normalizeBooleanValue(values[field.id]);
      }
    });

    let hasErrors = false;

    // Validate required fields
    if (nameField) {
      const nameValue = values[nameField.id]?.trim();
      if (!nameValue) {
        form.setError(nameField.id, {
          type: 'manual',
          message: 'Name is required',
        });
        hasErrors = true;
      }
    }

    if (slugField) {
      const slugValue = values[slugField.id]?.trim();
      if (!slugValue) {
        form.setError(slugField.id, {
          type: 'manual',
          message: 'Slug is required',
        });
        hasErrors = true;
      } else if (!validateSlugUniqueness(slugValue, slugField.id)) {
        // Validate slug uniqueness
        form.setError(slugField.id, {
          type: 'manual',
          message: 'This slug already exists in this collection',
        });
        hasErrors = true;
      }
    }

    if (hasErrors) return;

    // Store editingItem reference before closing (needed for API call below)
    const itemToUpdate = editingItem;

    // Close sheet immediately (optimistic UI) - only use onSuccess to avoid double-close race condition
    setEditingItem(null);
    form.reset();
    if (onSuccess) {
      onSuccess();
    } else {
      onOpenChange(false);
    }

    if (itemToUpdate) {
      // Update existing item

      // 1. Optimistically update in collection layer store (for collection layers)
      updateItemInLayerData(itemToUpdate.id, values);

      // 2. Optimistically update in pages store (for dynamic pages)
      if (isPageLevelItem && currentPageId) {
        updatePageCollectionItem(currentPageId, {
          ...itemToUpdate,
          values,
          updated_at: new Date().toISOString(),
        });
      }

      // 3. Update in main collections store (fire and forget - store handles optimistic update & rollback)
      const itemId = itemToUpdate.id;
      updateItem(collectionId, itemId, values)
        .then(() => {
          // Broadcast item update to other collaborators
          if (liveCollectionUpdates) {
            liveCollectionUpdates.broadcastItemUpdate(collectionId, itemId, { values } as any);
          }
        })
        .catch((error) => {
          console.error('Failed to update item:', error);
          toast.error('Failed to save item', {
            description: 'Changes have been reverted.',
          });
        });

      // 4. Background refetch for collection layers
      setTimeout(() => {
        refetchLayersForCollection(collectionId);
      }, 100);

      // 5. Background refetch for page-level data (if dynamic page)
      if (isPageLevelItem && currentPageId) {
        setTimeout(() => {
          refetchPageCollectionItem(currentPageId);
        }, 100);
      }
    } else {
      // Create new item (store handles optimistic update & rollback)
      createItem(collectionId, values)
        .then((newItem) => {
          // Broadcast item creation to other collaborators
          if (liveCollectionUpdates && newItem) {
            liveCollectionUpdates.broadcastItemCreate(collectionId, newItem);
          }

          // Refetch to sync collection layers
          setTimeout(() => {
            refetchLayersForCollection(collectionId);

            // Also refetch page data if on dynamic page
            if (isPageLevelItem && currentPageId) {
              refetchPageCollectionItem(currentPageId);
            }
          }, 100);
        })
        .catch((error) => {
          console.error('Failed to create item:', error);
          toast.error('Failed to create item', {
            description: 'Please try again.',
          });
        });
    }
  };

  // Handle sheet close - reset form errors
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      // Reset form errors when closing
      form.clearErrors();
    }
    onOpenChange(isOpen);
  }, [onOpenChange, form]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent onOpenAutoFocus={handleOpenAutoFocus} aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>
            {editingItem ? 'Edit' : 'Create'} {collection?.name} Item
          </SheetTitle>
          <SheetActions>
            <Button
              size="sm"
              type="submit"
              form="collection-item-form"
              disabled={isTempId(editingItem?.id)}
            >
              {editingItem ? (isTempId(editingItem.id) ? 'Saving...' : 'Save') : 'Create'}
            </Button>
          </SheetActions>
        </SheetHeader>

        <Form {...form}>
          <form
            id="collection-item-form"
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-4 flex-1"
          >
            <div className="flex-1 flex flex-col gap-6">
              {collectionFields
                .filter(f => f.fillable && !f.hidden)
                .map((field) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={field.id}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>{field.name}</FormLabel>
                        <FormControl>
                          {field.type === 'rich_text' ? (
                            <RichTextEditor
                              value={formField.value || ''}
                              onChange={formField.onChange}
                              placeholder={field.default || `Enter ${field.name.toLowerCase()}...`}
                              variant="full"
                              withFormatting={true}
                              excludedLinkTypes={['asset', 'field']}
                            />
                          ) : field.type === 'reference' && field.reference_collection_id ? (
                            <ReferenceFieldCombobox
                              collectionId={field.reference_collection_id}
                              value={formField.value || ''}
                              onChange={formField.onChange}
                              isMulti={false}
                              placeholder={`Select ${field.name.toLowerCase()}...`}
                            />
                          ) : field.type === 'multi_reference' && field.reference_collection_id ? (
                            <ReferenceFieldCombobox
                              collectionId={field.reference_collection_id}
                              value={formField.value || '[]'}
                              onChange={formField.onChange}
                              isMulti={true}
                              placeholder={`Select ${field.name.toLowerCase()}...`}
                            />
                          ) : field.type === 'link' ? (
                            <CollectionLinkFieldInput
                              value={formField.value || ''}
                              onChange={formField.onChange}
                            />
                          ) : field.type === 'email' ? (
                            <Input
                              type="email"
                              placeholder={field.default || `Enter ${field.name.toLowerCase()}...`}
                              {...formField}
                            />
                          ) : field.type === 'phone' ? (
                            <Input
                              type="tel"
                              placeholder={field.default || `Enter ${field.name.toLowerCase()}...`}
                              {...formField}
                            />
                          ) : field.type === 'date' ? (
                            <Input
                              type="datetime-local"
                              value={formatDateInTimezone(formField.value, timezone, 'datetime-local')}
                              onChange={(e) => {
                                const utcValue = localDatetimeToUTC(e.target.value, timezone);
                                formField.onChange(utcValue);
                              }}
                            />
                          ) : isMultipleAssetField(field) ? (
                            /* Multiple Asset Field */
                            (() => {
                              // Handle both array (from castValue) and JSON string formats
                              let assetIds: string[] = [];
                              const rawValue = formField.value;
                              if (Array.isArray(rawValue)) {
                                assetIds = rawValue;
                              } else if (typeof rawValue === 'string' && rawValue) {
                                try {
                                  const parsed = JSON.parse(rawValue);
                                  assetIds = Array.isArray(parsed) ? parsed : [];
                                } catch {
                                  assetIds = [];
                                }
                              }

                              const fieldLabel = getFieldLabel(field.type);
                              const addButtonLabel = ADD_BUTTON_LABEL_MAP[field.type as keyof typeof ADD_BUTTON_LABEL_MAP] ?? 'a file';

                              const showInvalidTypeError = () => {
                                const article = fieldLabel === 'audio' ? 'an' : 'a';
                                toast.error('Invalid asset type', {
                                  description: `Please select ${article} ${fieldLabel} file.`,
                                });
                              };

                              const handleAddAsset = () => {
                                openFileManager(
                                  (asset) => {
                                    if (!isValidAssetType(asset, field.type)) {
                                      showInvalidTypeError();
                                      return false;
                                    }
                                    if (!assetIds.includes(asset.id)) {
                                      formField.onChange(JSON.stringify([...assetIds, asset.id]));
                                    }
                                  },
                                  undefined,
                                  getFileManagerCategory(field.type)
                                );
                              };

                              const handleReplaceAsset = (oldAssetId: string) => {
                                openFileManager(
                                  (asset) => {
                                    if (!isValidAssetType(asset, field.type)) {
                                      showInvalidTypeError();
                                      return false;
                                    }
                                    formField.onChange(JSON.stringify(assetIds.map(id => id === oldAssetId ? asset.id : id)));
                                  },
                                  oldAssetId,
                                  getFileManagerCategory(field.type)
                                );
                              };

                              const handleRemoveAsset = (assetId: string) => {
                                formField.onChange(JSON.stringify(assetIds.filter(id => id !== assetId)));
                              };

                              return (
                                <div className="space-y-2">
                                  {assetIds.length > 0 && (
                                    <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))]">
                                      {assetIds.map((assetId) => (
                                        <AssetFieldCard
                                          key={assetId}
                                          asset={getAsset(assetId)}
                                          fieldType={field.type}
                                          onChangeFile={() => handleReplaceAsset(assetId)}
                                          onRemove={() => handleRemoveAsset(assetId)}
                                        />
                                      ))}
                                    </div>
                                  )}
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handleAddAsset(); }}
                                  >
                                    <Icon name="plus" className="size-3" />
                                    Add {addButtonLabel}
                                  </Button>
                                </div>
                              );
                            })()
                          ) : isAssetFieldType(field.type) ? (
                            /* Single Asset Field */
                            (() => {
                              const currentAssetId = formField.value || null;
                              const currentAsset = currentAssetId ? getAsset(currentAssetId) : null;
                              const fieldLabel = getFieldLabel(field.type);
                              const addButtonLabel = ADD_BUTTON_LABEL_MAP[field.type as keyof typeof ADD_BUTTON_LABEL_MAP] ?? 'a file';

                              const handleOpenFileManager = () => {
                                openFileManager(
                                  (asset) => {
                                    if (!isValidAssetType(asset, field.type)) {
                                      const article = fieldLabel === 'audio' ? 'an' : 'a';
                                      toast.error('Invalid asset type', {
                                        description: `Please select ${article} ${fieldLabel} file.`,
                                      });
                                      return false;
                                    }
                                    formField.onChange(asset.id);
                                  },
                                  currentAssetId,
                                  getFileManagerCategory(field.type)
                                );
                              };

                              if (!currentAsset) {
                                return (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="w-fit"
                                    onClick={(e) => { e.stopPropagation(); handleOpenFileManager(); }}
                                  >
                                    <Icon name="plus" className="size-3" />
                                    Add {addButtonLabel}
                                  </Button>
                                );
                              }

                              return (
                                <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(min(100%,320px),1fr))]">
                                  <AssetFieldCard
                                    asset={currentAsset}
                                    fieldType={field.type}
                                    onChangeFile={handleOpenFileManager}
                                    onRemove={() => formField.onChange('')}
                                  />
                                </div>
                              );
                            })()
                          ) : field.type === 'boolean' ? (
                            <div className="flex items-center gap-2">
                              <Switch
                                id={`${field.id}-boolean`}
                                checked={formField.value === 'true'}
                                onCheckedChange={(checked) => formField.onChange(checked ? 'true' : 'false')}
                              />
                              <Label
                                htmlFor={`${field.id}-boolean`}
                                className="text-xs text-muted-foreground font-normal cursor-pointer gap-1"
                              >
                                Value is set to <span className="text-foreground">{formField.value === 'true' ? 'YES' : 'NO'}</span>
                              </Label>
                            </div>
                          ) : field.key === 'name' ? (
                            <Input
                              ref={nameInputRef}
                              placeholder={field.default || `Enter ${field.name.toLowerCase()}...`}
                              name={formField.name}
                              value={formField.value}
                              onChange={formField.onChange}
                              onBlur={formField.onBlur}
                            />
                          ) : (
                            <Input
                              placeholder={field.default || `Enter ${field.name.toLowerCase()}...`}
                              {...formField}
                            />
                          )}
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
