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
import { slugify } from '@/lib/collection-utils';
import { validateFieldValue, isAssetFieldType, getFieldIcon } from '@/lib/collection-field-utils';
import { ASSET_CATEGORIES, isAssetOfType } from '@/lib/asset-utils';
import { toast } from 'sonner';
import ReferenceFieldCombobox from './ReferenceFieldCombobox';
import CollectionLinkFieldInput from './CollectionLinkFieldInput';
import type { CollectionItemWithValues } from '@/types';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

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
        values[field.id] = editingItem.values[field.id] ?? '';
      });
      form.reset(values);
    } else {
      // Reset with default values for new items
      const defaultValues: Record<string, any> = {};
      collectionFields.forEach(field => {
        defaultValues[field.id] = field.default || '';
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
      <SheetContent onOpenAutoFocus={handleOpenAutoFocus}>
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
                          ) : isAssetFieldType(field.type) ? (
                            /* Asset Field - File Manager UI (Image, Audio, Video, Document) */
                            (() => {
                              const currentAssetId = formField.value || null;
                              const currentAsset = currentAssetId ? getAsset(currentAssetId) : null;
                              const assetFilename = currentAsset?.filename || null;

                              // Determine asset category and labels based on field type
                              const assetCategoryMap = {
                                image: ASSET_CATEGORIES.IMAGES,
                                audio: ASSET_CATEGORIES.AUDIO,
                                video: ASSET_CATEGORIES.VIDEOS,
                                document: ASSET_CATEGORIES.DOCUMENTS,
                              } as const;
                              const assetCategory = assetCategoryMap[field.type as keyof typeof assetCategoryMap] ?? ASSET_CATEGORIES.DOCUMENTS;
                              const fieldLabelMap = { image: 'image', audio: 'audio', video: 'video', document: 'document' } as const;
                              const fieldLabel = fieldLabelMap[field.type as keyof typeof fieldLabelMap] ?? 'file';

                              const handleOpenFileManager = () => {
                                openFileManager(
                                  (asset) => {
                                    // Validate asset type
                                    if (!asset.mime_type || !isAssetOfType(asset.mime_type, assetCategory)) {
                                      const article = fieldLabel === 'audio' ? 'an' : 'a';
                                      toast.error('Invalid asset type', {
                                        description: `Please select ${article} ${fieldLabel} file.`,
                                      });
                                      return false; // Don't close file manager
                                    }

                                    // Set the asset ID as the field value
                                    formField.onChange(asset.id);
                                    // Return void to close file manager
                                  },
                                  currentAssetId,
                                  assetCategory
                                );
                              };

                              // Helper to format file size
                              const formatFileSize = (bytes: number): string => {
                                if (bytes < 1024) return `${bytes} B`;
                                if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
                                return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
                              };

                              // Helper to get file extension from mime type
                              const getFileExtension = (mimeType: string): string => {
                                const parts = mimeType.split('/');
                                return parts[1]?.toUpperCase() || 'FILE';
                              };

                              // Get preview URL for images only
                              const imageUrl = field.type === 'image' ? currentAsset?.public_url || null : null;

                              return (
                                <div className="bg-input p-2 rounded-lg flex items-center gap-4">
                                  <div className="relative group bg-secondary/30 rounded-md w-full aspect-square overflow-hidden max-w-24">
                                    {/* Checkerboard pattern for transparency (images only) */}
                                    {field.type === 'image' && (
                                      <div className="absolute inset-0 opacity-5 bg-checkerboard" />
                                    )}

                                    {imageUrl ? (
                                      <img
                                        src={imageUrl}
                                        className="relative w-full h-full object-contain z-10"
                                        alt="Image preview"
                                      />
                                    ) : (
                                      <div className="relative w-full h-full flex items-center justify-center z-10 text-muted-foreground">
                                        {/* Show icon for audio/video/document fields */}
                                        {field.type !== 'image' && currentAsset && (
                                          <Icon name={getFieldIcon(field.type)} className="size-6" />
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                    {currentAsset && (
                                      <div className="flex flex-col gap-1">
                                        <Label className="truncate">{assetFilename}</Label>
                                        <span className="text-xs text-current/60 inline-flex gap-2 items-center">
                                          {getFileExtension(currentAsset.mime_type)}
                                          <div className="size-0.5 bg-current/50 rounded-full inline-flex" />
                                          {formatFileSize(currentAsset.file_size)}
                                          {currentAsset.width && currentAsset.height && (
                                            <>
                                              <div className="size-0.5 bg-current/50 rounded-full inline-flex" />
                                              {currentAsset.width}×{currentAsset.height}
                                            </>
                                          )}
                                        </span>
                                      </div>
                                    )}

                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button" variant="secondary"
                                        size="sm" onClick={(e) => {e.stopPropagation();handleOpenFileManager();}}
                                      >
                                        {assetFilename ? 'Change file' : 'Choose file'}
                                      </Button>

                                      {currentAssetId && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            formField.onChange('');
                                          }}
                                        >
                                          Remove
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                </div>
                              );
                            })()
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
