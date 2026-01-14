'use client';

/**
 * Collection Item Sheet
 *
 * Reusable sheet for creating/editing collection items.
 * Can be used from CMS page or triggered from builder canvas.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
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
import { TiptapEditor } from '@/components/ui/tiptap-editor';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useCollectionLayerStore } from '@/stores/useCollectionLayerStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useLiveCollectionUpdates } from '@/hooks/use-live-collection-updates';
import { useResourceLock } from '@/hooks/use-resource-lock';
import { slugify } from '@/lib/collection-utils';
import ReferenceFieldCombobox from './ReferenceFieldCombobox';
import type { CollectionItemWithValues } from '@/types';

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
  const { currentPageId } = useEditorStore();

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

  const form = useForm();

  // Load item data if editing
  useEffect(() => {
    if (itemId && collectionItems.length > 0) {
      const item = collectionItems.find(i => i.id === itemId);
      setEditingItem(item || null);
    } else {
      setEditingItem(null);
    }
  }, [itemId, collectionItems]);

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

  // Auto-fill slug field based on name field
  useEffect(() => {
    if (!editingItem) {
      const nameField = collectionFields.find(f => f.key === 'name');
      const slugField = collectionFields.find(f => f.key === 'slug');

      if (nameField && slugField) {
        const subscription = form.watch((value, { name }) => {
          if (name === nameField.id) {
            const nameValue = value[nameField.id];
            if (nameValue && typeof nameValue === 'string') {
              const slugValue = slugify(nameValue);
              form.setValue(slugField.id, slugValue);
            }
          }
        });
        return () => subscription.unsubscribe();
      }
    }
  }, [form, editingItem, collectionFields]);

  const handleSubmit = async (values: Record<string, any>) => {
    if (!collectionId) return;

    // Close sheet immediately for instant feedback
    onOpenChange(false);
    setEditingItem(null);
    form.reset();

    // Call success callback immediately
    if (onSuccess) {
      onSuccess();
    }

    try {
      if (editingItem) {
        // Update existing item

        // 1. Optimistically update in collection layer store (for collection layers)
        updateItemInLayerData(editingItem.id, values);

        // 2. Optimistically update in pages store (for dynamic pages)
        if (isPageLevelItem && currentPageId) {
          updatePageCollectionItem(currentPageId, {
            ...editingItem,
            values,
            updated_at: new Date().toISOString(),
          });
        }

        // 3. Update in main collections store (API call with optimistic update)
        await updateItem(collectionId, editingItem.id, values);

        // Broadcast item update to other collaborators
        if (liveCollectionUpdates) {
          liveCollectionUpdates.broadcastItemUpdate(collectionId, editingItem.id, { values } as any);
        }

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
        // Create new item (store adds to local state optimistically)
        const newItem = await createItem(collectionId, values);

        // Broadcast item creation to other collaborators
        if (liveCollectionUpdates && newItem) {
          liveCollectionUpdates.broadcastItemCreate(collectionId, newItem);
        }

        // Refetch to show the new item
        setTimeout(() => {
          refetchLayersForCollection(collectionId);

          // Also refetch page data if on dynamic page
          if (isPageLevelItem && currentPageId) {
            refetchPageCollectionItem(currentPageId);
          }
        }, 100);
      }
    } catch (error) {
      console.error('Failed to save item:', error);
      alert('Failed to save item. Please try again.');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetHeader>
          <SheetTitle>
            {editingItem ? 'Edit' : 'Create'} {collection?.name} Item
          </SheetTitle>
          <SheetActions>
            <Button
              size="sm"
              type="submit"
              form="collection-item-form"
            >
              {editingItem ? 'Save' : 'Create'}
            </Button>
          </SheetActions>
        </SheetHeader>

        <Form {...form}>
          <form
            id="collection-item-form"
            onSubmit={form.handleSubmit(handleSubmit)}
            className="flex flex-col gap-4 flex-1 mt-6"
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
                            <TiptapEditor
                              value={formField.value || ''}
                              onChange={formField.onChange}
                              placeholder={field.default || `Enter ${field.name.toLowerCase()}...`}
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
