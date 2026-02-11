import { create } from 'zustand';
import { collectionsApi } from '@/lib/api';
import { sortCollectionsByOrder } from '@/lib/collection-utils';
import { MULTI_ASSET_COLLECTION_ID } from '@/lib/collection-field-utils';
import type { Collection, CollectionField, CollectionItemWithValues, CreateCollectionData, UpdateCollectionData, CreateCollectionFieldData, UpdateCollectionFieldData } from '@/types';

/**
 * Collections Store
 *
 * Manages state for Collections (CMS) feature using EAV architecture.
 * Handles collections, fields, and items with their values.
 */

interface CollectionsState {
  collections: Collection[];
  fields: Record<string, CollectionField[]>; // keyed by collection_id (UUID)
  items: Record<string, CollectionItemWithValues[]>; // keyed by collection_id (UUID, current page only, UUID)
  itemsTotalCount: Record<string, number>; // keyed by collection_id (UUID) - total count for pagination
  selectedCollectionId: string | null; // UUID
  isLoading: boolean;
  error: string | null;
}

interface CollectionsActions {
  // Collections
  loadCollections: () => Promise<void>;
  preloadCollectionsAndItems: (collections: Collection[]) => Promise<void>;
  createCollection: (data: CreateCollectionData) => Promise<Collection>;
  updateCollection: (id: string, data: UpdateCollectionData) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  reorderCollections: (collectionIds: string[]) => Promise<void>;
  setSelectedCollectionId: (id: string | null) => void;

  // Fields
  loadFields: (collectionId: string | null, search?: string) => Promise<void>;
  createField: (collectionId: string, data: Omit<CreateCollectionFieldData, 'collection_id'>) => Promise<CollectionField>;
  updateField: (collectionId: string, fieldId: string, data: UpdateCollectionFieldData) => Promise<void>;
  deleteField: (collectionId: string, fieldId: string) => Promise<void>;

  // Items
  loadItems: (collectionId: string, page?: number, limit?: number, sortBy?: string, sortOrder?: string) => Promise<void>;
  loadPublishedItems: (collectionId: string) => Promise<void>;
  getDropdownItems: (collectionId: string) => Promise<Array<{ id: string; label: string }>>;
  createItem: (collectionId: string, values: Record<string, any>) => Promise<CollectionItemWithValues>;
  updateItem: (collectionId: string, itemId: string, values: Record<string, any>) => Promise<void>;
  deleteItem: (collectionId: string, itemId: string) => Promise<void>;
  duplicateItem: (collectionId: string, itemId: string) => Promise<CollectionItemWithValues | undefined>;
  searchItems: (collectionId: string, query: string, page?: number, limit?: number, sortBy?: string, sortOrder?: string) => Promise<void>;

  // Sorting
  updateCollectionSorting: (collectionId: string, sorting: { field: string; direction: 'asc' | 'desc' | 'manual' }) => Promise<void>;
  reorderItems: (collectionId: string, updates: Array<{ id: string; manual_order: number }>) => Promise<void>;

  // Utility
  clearError: () => void;
}

type CollectionsStore = CollectionsState & CollectionsActions;

export const useCollectionsStore = create<CollectionsStore>((set, get) => ({
  // Initial state
  collections: [],
  fields: {},
  items: {},
  itemsTotalCount: {},
  selectedCollectionId: null,
  isLoading: false,
  error: null,

  // Collections
  loadCollections: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.getAll();

      if (response.error) {
        throw new Error(response.error);
      }

      const collections = response.data || [];
      await get().preloadCollectionsAndItems(collections);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load collections';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  preloadCollectionsAndItems: async (collections: Collection[]) => {
    const sortedCollections = sortCollectionsByOrder(collections);
    set({ collections: sortedCollections, isLoading: false });

    // Preload all fields in a single query
    await get().loadFields(null);

    // Skip item preload if no collections
    if (collections.length === 0) {
      return;
    }

    // Preload 25 items per collection using optimized batch queries (2 queries total)
    const collectionIds = collections.map(c => c.id);
    const response = await collectionsApi.getTopItemsPerCollection(collectionIds, 25);

    if (response.error) {
      throw new Error(`Failed to preload items: ${response.error}`);
    }

    const result = response.data || {};
    const itemsMap: Record<string, CollectionItemWithValues[]> = {};
    const itemsTotalCountMap: Record<string, number> = {};

    // Use draft_items_count from collections for accurate totals (already fetched)
    // Sort preloaded items based on each collection's sorting settings
    collections.forEach(collection => {
      const batchResult = result[collection.id];
      let preloadedItems = batchResult?.items || [];

      // Apply collection sorting so items are in the correct order from the start
      const sorting = collection.sorting;
      if (sorting && sorting.direction !== 'manual') {
        preloadedItems = [...preloadedItems].sort((a, b) => {
          const aValue = a.values[sorting.field] || '';
          const bValue = b.values[sorting.field] || '';
          const aNum = parseFloat(String(aValue));
          const bNum = parseFloat(String(bValue));
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return sorting.direction === 'asc' ? aNum - bNum : bNum - aNum;
          }
          const cmp = String(aValue).localeCompare(String(bValue));
          return sorting.direction === 'asc' ? cmp : -cmp;
        });
      }

      itemsMap[collection.id] = preloadedItems;
      itemsTotalCountMap[collection.id] = collection.draft_items_count ?? 0;
    });

    set((state) => ({
      items: {
        ...state.items,
        ...itemsMap,
      },
      itemsTotalCount: {
        ...state.itemsTotalCount,
        ...itemsTotalCountMap,
      },
    }));
  },

  createCollection: async (data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.create(data);

      if (response.error) {
        throw new Error(response.error);
      }

      const newCollection = response.data!;

      // Automatically create built-in fields
      try {
        const builtInFields = [
          {
            name: 'ID',
            key: 'id',
            type: 'number' as const,
            order: 0,
            fillable: false,
            hidden: false,
          },
          {
            name: 'Name',
            key: 'name',
            type: 'text' as const,
            order: 1,
            fillable: true,
            hidden: false,
          },
          {
            name: 'Slug',
            key: 'slug',
            type: 'text' as const,
            order: 2,
            fillable: true,
            hidden: false,
          },
          {
            name: 'Created Date',
            key: 'created_at',
            type: 'date' as const,
            order: 3,
            fillable: false,
            hidden: false,
          },
          {
            name: 'Updated Date',
            key: 'updated_at',
            type: 'date' as const,
            order: 4,
            fillable: false,
            hidden: false,
          },
        ];

        // Create all built-in fields in parallel
        const fieldResponses = await Promise.all(
          builtInFields.map(field => collectionsApi.createField(newCollection.id, field))
        );
        const createdFields: CollectionField[] = fieldResponses
          .filter(r => !r.error && r.data)
          .map(r => r.data!);

        // Load created fields into store
        if (createdFields.length > 0) {
          set(state => ({
            fields: {
              ...state.fields,
              [newCollection.id]: createdFields,
            },
          }));
        }
      } catch (fieldError) {
        console.error('Failed to create built-in fields:', fieldError);
        // Continue anyway - collection was created successfully
      }

      set(state => {
        const updatedCollections = [...state.collections, newCollection];
        const sortedCollections = sortCollectionsByOrder(updatedCollections);
        return {
          collections: sortedCollections,
          isLoading: false,
        };
      });
      return newCollection;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create collection';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  updateCollection: async (id, data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.update(id, data);

      if (response.error) {
        throw new Error(response.error);
      }

      const updated = response.data!;

      set(state => {
        const updatedCollections = state.collections.map(c => c.id === id ? updated : c);
        const sortedCollections = sortCollectionsByOrder(updatedCollections);
        return {
          collections: sortedCollections,
          isLoading: false,
        };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update collection';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  deleteCollection: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.delete(id);

      if (response.error) {
        throw new Error(response.error);
      }

      set(state => {
        const remainingCollections = state.collections.filter(c => c.id !== id);
        const sortedCollections = sortCollectionsByOrder(remainingCollections);
        const wasSelected = state.selectedCollectionId === id;

        // If the deleted collection was selected, select the first remaining collection
        const newSelectedId = wasSelected && sortedCollections.length > 0
          ? sortedCollections[0].id
          : (state.selectedCollectionId === id ? null : state.selectedCollectionId);

        return {
          collections: sortedCollections,
          selectedCollectionId: newSelectedId,
          isLoading: false,
        };
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete collection';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  reorderCollections: async (collectionIds: string[]) => {
    // Optimistically reorder collections
    set(state => {
      const reorderedCollections = collectionIds
        .map((id, index) => {
          const collection = state.collections.find(c => c.id === id);
          return collection ? { ...collection, order: index } : null;
        })
        .filter((c): c is Collection => c !== null);

      return { collections: reorderedCollections };
    });

    try {
      const response = await collectionsApi.reorder(collectionIds);

      if (response.error) {
        throw new Error(response.error);
      }
    } catch (error) {
      // Reload collections to revert optimistic update
      await get().loadCollections();
      const errorMessage = error instanceof Error ? error.message : 'Failed to reorder collections';
      set({ error: errorMessage });
    }
  },

  setSelectedCollectionId: (id) => {
    set({ selectedCollectionId: id });
  },

  // Fields
  loadFields: async (collectionId: string | null, search?: string) => {
    // Skip virtual collections (multi-asset)
    if (collectionId === MULTI_ASSET_COLLECTION_ID) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      // If collectionId is null, load all fields for all collections in one query
      if (collectionId === null) {
        const response = await collectionsApi.getAllFields();

        if (response.error) {
          throw new Error(response.error);
        }

        // Group fields by collection_id
        const allFields = response.data || [];
        const fieldsMap: Record<string, CollectionField[]> = {};

        allFields.forEach(field => {
          if (!fieldsMap[field.collection_id]) {
            fieldsMap[field.collection_id] = [];
          }
          fieldsMap[field.collection_id].push(field);
        });

        set(state => ({
          fields: {
            ...state.fields,
            ...fieldsMap,
          },
          isLoading: false,
        }));
      } else {
        // Load fields for a specific collection
        const response = await collectionsApi.getFields(collectionId, search);

        if (response.error) {
          throw new Error(response.error);
        }

        set(state => ({
          fields: {
            ...state.fields,
            [collectionId]: response.data || [],
          },
          isLoading: false,
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load fields';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  createField: async (collectionId, data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.createField(collectionId, data);

      if (response.error) {
        throw new Error(response.error);
      }

      const newField = response.data!;

      set(state => ({
        fields: {
          ...state.fields,
          [collectionId]: [...(state.fields[collectionId] || []), newField],
        },
        isLoading: false,
      }));

      return newField;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create field';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  updateField: async (collectionId, fieldId, data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.updateField(collectionId, fieldId, data);

      if (response.error) {
        throw new Error(response.error);
      }

      const updated = response.data!;

      set(state => ({
        fields: {
          ...state.fields,
          [collectionId]: (state.fields[collectionId] || []).map(f => f.id === fieldId ? updated : f),
        },
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update field';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  deleteField: async (collectionId, fieldId) => {
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.deleteField(collectionId, fieldId);

      if (response.error) {
        throw new Error(response.error);
      }

      set(state => ({
        fields: {
          ...state.fields,
          [collectionId]: (state.fields[collectionId] || []).filter(f => f.id !== fieldId),
        },
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete field';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // Items
  loadItems: async (collectionId: string, page?: number, limit?: number, sortBy?: string, sortOrder?: string) => {
    // Skip virtual collections (multi-asset)
    if (collectionId === MULTI_ASSET_COLLECTION_ID) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.getItems(collectionId, { page, limit, sortBy, sortOrder });

      if (response.error) {
        throw new Error(response.error);
      }

      set(state => ({
        items: {
          ...state.items,
          [collectionId]: response.data?.items || [],
        },
        itemsTotalCount: {
          ...state.itemsTotalCount,
          [collectionId]: response.data?.total || 0,
        },
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load items';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  loadPublishedItems: async (collectionId) => {
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.getPublishedItems(collectionId);

      if (response.error) {
        throw new Error(response.error);
      }

      set(state => ({
        items: {
          ...state.items,
          [collectionId]: response.data || [],
        },
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load published items';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  createItem: async (collectionId, values) => {
    // Create optimistic item with temporary ID
    const tempId = `temp-${Date.now()}`;
    const optimisticItem: CollectionItemWithValues = {
      id: tempId,
      collection_id: collectionId,
      manual_order: (get().items[collectionId]?.length || 0),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      is_published: false,
      values,
    };

    // Optimistically add item to store (no loading state)
    set(state => ({
      items: {
        ...state.items,
        [collectionId]: [...(state.items[collectionId] || []), optimisticItem],
      },
      itemsTotalCount: {
        ...state.itemsTotalCount,
        [collectionId]: (state.itemsTotalCount[collectionId] || 0) + 1,
      },
      error: null,
    }));

    try {
      const response = await collectionsApi.createItem(collectionId, values);

      if (response.error) {
        throw new Error(response.error);
      }

      const newItem = response.data!;

      // Replace temporary item with real item from server
      set(state => ({
        items: {
          ...state.items,
          [collectionId]: (state.items[collectionId] || []).map(item =>
            item.id === tempId ? newItem : item
          ),
        },
      }));

      return newItem;
    } catch (error) {
      // Revert optimistic update on error
      set(state => ({
        items: {
          ...state.items,
          [collectionId]: (state.items[collectionId] || []).filter(item => item.id !== tempId),
        },
        itemsTotalCount: {
          ...state.itemsTotalCount,
          [collectionId]: Math.max(0, (state.itemsTotalCount[collectionId] || 0) - 1),
        },
        error: error instanceof Error ? error.message : 'Failed to create item',
      }));
      throw error;
    }
  },

  updateItem: async (collectionId, itemId, values) => {
    // Store previous state for rollback on error
    const previousItems = get().items[collectionId] || [];
    const previousItem = previousItems.find(item => item.id === itemId);

    // Optimistically update item in store (no loading state)
    set(state => ({
      items: {
        ...state.items,
        [collectionId]: (state.items[collectionId] || []).map(item =>
          item.id === itemId
            ? { ...item, values, updated_at: new Date().toISOString() }
            : item
        ),
      },
      error: null,
    }));

    try {
      const response = await collectionsApi.updateItem(collectionId, itemId, values);

      if (response.error) {
        throw new Error(response.error);
      }

      const updated = response.data!;

      // Update with server response (ensures consistency)
      set(state => ({
        items: {
          ...state.items,
          [collectionId]: (state.items[collectionId] || []).map(item =>
            item.id === itemId ? updated : item
          ),
        },
      }));
    } catch (error) {
      // Revert to previous state on error
      if (previousItem) {
        set(state => ({
          items: {
            ...state.items,
            [collectionId]: (state.items[collectionId] || []).map(item =>
              item.id === itemId ? previousItem : item
            ),
          },
          error: error instanceof Error ? error.message : 'Failed to update item',
        }));
      }
      throw error;
    }
  },

  deleteItem: async (collectionId, itemId) => {
    // Store item for rollback on error
    const previousItems = get().items[collectionId] || [];
    const deletedItem = previousItems.find(item => item.id === itemId);
    const previousCount = get().itemsTotalCount[collectionId] || 0;

    // Optimistically remove item (no loading state)
    set(state => ({
      items: {
        ...state.items,
        [collectionId]: (state.items[collectionId] || []).filter(item => item.id !== itemId),
      },
      itemsTotalCount: {
        ...state.itemsTotalCount,
        [collectionId]: Math.max(0, (state.itemsTotalCount[collectionId] || 0) - 1),
      },
      error: null,
    }));

    try {
      const response = await collectionsApi.deleteItem(collectionId, itemId);

      if (response.error) {
        throw new Error(response.error);
      }
      // Success - item already removed from state
    } catch (error) {
      // Revert optimistic delete on error
      if (deletedItem) {
        set(state => ({
          items: {
            ...state.items,
            [collectionId]: [...(state.items[collectionId] || []), deletedItem],
          },
          itemsTotalCount: {
            ...state.itemsTotalCount,
            [collectionId]: previousCount,
          },
          error: error instanceof Error ? error.message : 'Failed to delete item',
        }));
      }
      throw error;
    }
  },

  duplicateItem: async (collectionId: string, itemId: string) => {
    // Find the source item to create optimistic duplicate
    const sourceItem = get().items[collectionId]?.find(item => item.id === itemId);
    const tempId = `temp-dup-${Date.now()}`;

    // Optimistically add duplicate item (no loading state)
    if (sourceItem) {
      const collectionFields = get().fields[collectionId] || [];
      const allItems = get().items[collectionId] || [];
      const idField = collectionFields.find(f => f.key === 'id');
      const nameField = collectionFields.find(f => f.key === 'name');
      const slugField = collectionFields.find(f => f.key === 'slug');
      const createdAtField = collectionFields.find(f => f.key === 'created_at');
      const updatedAtField = collectionFields.find(f => f.key === 'updated_at');

      // Build values matching server logic
      const newValues = { ...sourceItem.values };
      const now = new Date().toISOString();

      if (idField && newValues[idField.id]) {
        let highestId = 0;
        allItems.forEach(item => {
          const val = item.values[idField.id];
          if (val) {
            const num = parseInt(String(val), 10);
            if (!isNaN(num)) highestId = Math.max(highestId, num);
          }
        });
        newValues[idField.id] = String(highestId + 1);
      }
      if (createdAtField) newValues[createdAtField.id] = now;
      if (updatedAtField) newValues[updatedAtField.id] = now;

      if (nameField && newValues[nameField.id]) {
        newValues[nameField.id] = `${newValues[nameField.id]} (Copy)`;
      }

      if (slugField) {
        const originalSlug = newValues[slugField.id] ? String(newValues[slugField.id]).trim() : '';
        const baseSlug = originalSlug || 'copy';
        const baseSlugClean = baseSlug.replace(/-\d+$/, '');
        const existingSlugs = new Set(
          allItems.map(item => item.values[slugField.id]).filter((s): s is string => !!s && typeof s === 'string')
        );
        let newSlug = `${baseSlugClean}-copy`;
        if (existingSlugs.has(newSlug)) {
          let n = 1;
          while (existingSlugs.has(`${baseSlugClean}-copy-${n}`)) n++;
          newSlug = `${baseSlugClean}-copy-${n}`;
        }
        newValues[slugField.id] = newSlug;
      }

      const optimisticItem: CollectionItemWithValues = {
        id: tempId,
        collection_id: collectionId,
        manual_order: (get().items[collectionId]?.length || 0),
        created_at: now,
        updated_at: now,
        deleted_at: null,
        is_published: false,
        values: newValues,
      };

      set(state => ({
        items: {
          ...state.items,
          [collectionId]: [...(state.items[collectionId] || []), optimisticItem],
        },
        itemsTotalCount: {
          ...state.itemsTotalCount,
          [collectionId]: (state.itemsTotalCount[collectionId] || 0) + 1,
        },
        error: null,
      }));
    }

    try {
      const response = await collectionsApi.duplicateItem(collectionId, itemId);

      if (response.error) {
        throw new Error(response.error);
      }

      // Replace temporary item with real item from server
      if (response.data) {
        set(state => ({
          items: {
            ...state.items,
            [collectionId]: (state.items[collectionId] || []).map(item =>
              item.id === tempId ? response.data! : item
            ),
          },
        }));
      }

      return response.data;
    } catch (error) {
      // Revert optimistic update on error
      set(state => ({
        items: {
          ...state.items,
          [collectionId]: (state.items[collectionId] || []).filter(item => item.id !== tempId),
        },
        itemsTotalCount: {
          ...state.itemsTotalCount,
          [collectionId]: Math.max(0, (state.itemsTotalCount[collectionId] || 0) - 1),
        },
        error: error instanceof Error ? error.message : 'Failed to duplicate item',
      }));
      throw error;
    }
  },

  searchItems: async (collectionId: string, query: string, page?: number, limit?: number, sortBy?: string, sortOrder?: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.searchItems(collectionId, query, { page, limit, sortBy, sortOrder });

      if (response.error) {
        throw new Error(response.error);
      }

      set(state => ({
        items: {
          ...state.items,
          [collectionId]: response.data?.items || [],
        },
        itemsTotalCount: {
          ...state.itemsTotalCount,
          [collectionId]: response.data?.total || 0,
        },
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to search items';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  // Sorting
  updateCollectionSorting: async (collectionId: string, sorting: { field: string; direction: 'asc' | 'desc' | 'manual' }) => {
    set({ isLoading: true, error: null });

    try {
      // Optimistically update the collection sorting
      set(state => {
        const updatedCollections = state.collections.map(c =>
          c.id === collectionId ? { ...c, sorting } : c
        );
        const sortedCollections = sortCollectionsByOrder(updatedCollections);
        return {
          collections: sortedCollections,
        };
      });
      const response = await collectionsApi.update(collectionId, { sorting });

      if (response.error) {
        throw new Error(response.error);
      }

      set({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update sorting';
      set({ error: errorMessage, isLoading: false });
      // Reload to revert optimistic update
      await get().loadCollections();
      throw error;
    }
  },

  reorderItems: async (collectionId: string, updates: Array<{ id: string; manual_order: number }>) => {
    set({ isLoading: true, error: null });

    try {
      // Optimistically update items order
      set(state => {
        const items = state.items[collectionId] || [];
        const updateMap = new Map(updates.map(u => [u.id, u.manual_order]));

        const updatedItems = items.map(item => {
          const newOrder = updateMap.get(item.id);
          return newOrder !== undefined ? { ...item, manual_order: newOrder } : item;
        });

        return {
          items: {
            ...state.items,
            [collectionId]: updatedItems,
          },
        };
      });

      const response = await collectionsApi.reorderItems(collectionId, updates);

      if (response.error) {
        throw new Error(response.error);
      }

      set({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reorder items';
      set({ error: errorMessage, isLoading: false });
      // Reload to revert optimistic update
      await get().loadItems(collectionId);
      throw error;
    }
  },

  // Utility
  clearError: () => {
    set({ error: null });
  },

  getDropdownItems: async (collectionId: string) => {
    try {
      const state = get();

      // Fields and items are ALWAYS preloaded before UI renders
      // No defensive loading needed - guaranteed to be available
      const collectionFields = state.fields[collectionId] || [];
      const items = state.items[collectionId] || [];

      // Find the name field (field with key = 'name')
      const nameField = collectionFields.find(field => field.key === 'name');

      if (!nameField) {
        console.warn(`Name field not found for collection ${collectionId}. Available fields:`, collectionFields.map(f => ({ id: f.id, key: f.key, name: f.name })));
      }

      // Map items to { id, label } format
      const itemsWithLabels = items.map(item => {
        let label = `Item ${item.id.slice(0, 8)}`;

        if (nameField) {
          const nameValue = item.values?.[nameField.id];
          if (nameValue !== null && nameValue !== undefined && String(nameValue).trim() !== '') {
            label = String(nameValue);
          } else {
            // Debug: log when name value is missing
            console.debug(`Item ${item.id} has no name value. Name field ID: ${nameField.id}, Available values:`, Object.keys(item.values || {}));
          }
        }

        return {
          id: item.id,
          label,
        };
      });

      return itemsWithLabels;
    } catch (error) {
      console.error('Failed to get dropdown items:', error);
      return [];
    }
  },
}));
