'use client';

/**
 * Collection Item Sheet
 *
 * Reusable sheet for creating/editing collection items.
 * Can be used from CMS page or triggered from builder canvas.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { isAssetFieldType, isMultipleAssetField, getFileManagerCategory, getAssetFieldLabel, getAssetFieldTypeLabel, isValidAssetForField, findStatusFieldId } from '@/lib/collection-field-utils';
import type { StatusAction } from '@/lib/collection-field-utils';
import { CollectionStatusPill, parseStatusValue } from './CollectionStatusPill';
import { formatDateInTimezone, localDatetimeToUTC } from '@/lib/date-format-utils';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { toast } from 'sonner';
import ReferenceFieldCombobox from './ReferenceFieldCombobox';
import CollectionLinkFieldInput from './CollectionLinkFieldInput';
import ColorFieldInput from './ColorFieldInput';
import AssetFieldCard from './AssetFieldCard';
import type { Asset, CollectionItemWithValues } from '@/types';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

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
  const { collections, fields, items, updateItem, createItem, setItemStatus } = useCollectionsStore();
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
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const pendingStatusActionRef = useRef<StatusAction | null>(null);

  const collection = collections.find(c => c.id === collectionId);
  const collectionFields = useMemo(
    () => (collectionId ? (fields[collectionId] || []) : []),
    [collectionId, fields]
  );
  const collectionItems = useMemo(
    () => (collectionId ? (items[collectionId] || []) : []),
    [collectionId, items]
  );
  const statusFieldId = useMemo(
    () => findStatusFieldId(collectionFields),
    [collectionFields]
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
  // Subscribe to isDirty at render level so react-hook-form tracks it
  const { isDirty } = form.formState;

  // Helper to detect temporary IDs (from optimistic creates)
  const isTempId = (id: string | null | undefined): boolean => {
    return !!id && (id.startsWith('temp-') || id.startsWith('temp-dup-'));
  };

  // Compute status for the current item from the status field value
  const isNewItem = !editingItem || isTempId(editingItem.id);
  const statusValue = (editingItem && statusFieldId) ? parseStatusValue(editingItem.values[statusFieldId]) : null;
  const isPublishable = statusValue?.is_publishable ?? editingItem?.is_publishable ?? true;
  const hasPublishedVersion = statusValue?.is_published ?? false;

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
      const statusAction = pendingStatusActionRef.current;
      pendingStatusActionRef.current = null;
      updateItem(collectionId, itemId, values)
        .then(() => {
          // Apply status action after save completes
          if (statusAction) {
            setItemStatus(collectionId, itemId, statusAction);
          }
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
      const statusAction = pendingStatusActionRef.current;
      pendingStatusActionRef.current = null;
      createItem(collectionId, values, statusAction ?? undefined)
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

  // Handle sheet close - check for unsaved changes
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen && isDirty) {
      // Show unsaved changes dialog instead of closing
      setShowUnsavedDialog(true);
      return;
    }
    if (!isOpen) {
      form.clearErrors();
    }
    onOpenChange(isOpen);
  }, [onOpenChange, form, isDirty]);

  // Discard unsaved changes and close sheet
  const handleConfirmDiscard = useCallback(() => {
    setShowUnsavedDialog(false);
    form.clearErrors();
    form.reset();
    setEditingItem(null);
    onOpenChange(false);
  }, [form, onOpenChange]);

  // Cancel discard - keep sheet open
  const handleCancelDiscard = useCallback(() => {
    setShowUnsavedDialog(false);
  }, []);

  // Keep a stable ref to handleSubmit to avoid re-creating handleSaveFromDialog on every render
  const handleSubmitRef = useRef(handleSubmit);
  handleSubmitRef.current = handleSubmit;

  // Save changes from dialog, then close
  const handleSaveFromDialog = useCallback(async () => {
    setShowUnsavedDialog(false);
    // Trigger form submission programmatically
    form.handleSubmit(handleSubmitRef.current)();
  }, [form]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent onOpenAutoFocus={handleOpenAutoFocus} aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            {editingItem ? 'Edit' : 'Create'} {collection?.name} Item
            {!isNewItem && statusValue && (
              <CollectionStatusPill statusValue={statusValue} />
            )}
          </SheetTitle>
          <SheetActions>
            {/* More options dropdown */}
            {editingItem && !isTempId(editingItem.id) && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="secondary">
                    <Icon name="dotsHorizontal" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      onOpenChange(false);
                      toast.info('Use the context menu in the CMS table to delete items');
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Save button with dropdown for alternate actions */}
            <div className="flex">
              <Button
                size="sm"
                type="submit"
                form="collection-item-form"
                disabled={isTempId(editingItem?.id)}
                className="rounded-r-none"
              >
                {editingItem ? (isTempId(editingItem.id) ? 'Saving...' : 'Save') : 'Create'}
              </Button>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="default"
                    className="rounded-l-none border-l border-primary-foreground/20 px-1.5"
                    disabled={isTempId(editingItem?.id)}
                  >
                    <Icon name="triangle-down" className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!isNewItem && (
                    <DropdownMenuItem
                      onClick={() => {
                        pendingStatusActionRef.current = 'stage';
                        form.handleSubmit(handleSubmit)();
                      }}
                    >
                      Save as staged for publish
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      pendingStatusActionRef.current = 'draft';
                      form.handleSubmit(handleSubmit)();
                    }}
                  >
                    {isNewItem ? 'Create' : 'Save'} as draft
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!collection?.has_published_version}
                    onClick={() => {
                      pendingStatusActionRef.current = 'publish';
                      form.handleSubmit(handleSubmit)();
                    }}
                  >
                    {isNewItem ? 'Create' : 'Save'} and publish
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
                          ) : field.type === 'color' ? (
                            <ColorFieldInput
                              value={formField.value || ''}
                              onChange={formField.onChange}
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

                              const fieldTypeLabel = getAssetFieldTypeLabel(field.type);
                              const addButtonLabel = getAssetFieldLabel(field.type);

                              const showInvalidTypeError = () => {
                                const article = fieldTypeLabel === 'audio' ? 'an' : 'a';
                                toast.error('Invalid asset type', {
                                  description: `Please select ${article} ${fieldTypeLabel} file.`,
                                });
                              };

                              const handleAddAsset = () => {
                                openFileManager(
                                  (asset) => {
                                    if (!isValidAssetForField(asset, field.type)) {
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
                                    if (!isValidAssetForField(asset, field.type)) {
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
                              const fieldTypeLabel = getAssetFieldTypeLabel(field.type);
                              const addButtonLabel = getAssetFieldLabel(field.type);

                              const handleOpenFileManager = () => {
                                openFileManager(
                                  (asset) => {
                                    if (!isValidAssetForField(asset, field.type)) {
                                      const article = fieldTypeLabel === 'audio' ? 'an' : 'a';
                                      toast.error('Invalid asset type', {
                                        description: `Please select ${article} ${fieldTypeLabel} file.`,
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

      <ConfirmDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to discard them?"
        confirmLabel="Discard changes"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onConfirm={handleConfirmDiscard}
        onCancel={handleCancelDiscard}
        saveLabel="Save changes"
        onSave={handleSaveFromDialog}
      />
    </Sheet>
  );
}
