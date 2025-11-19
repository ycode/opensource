import { create } from 'zustand';
import { collectionsApi } from '@/lib/api';
import { sortCollectionsByOrder } from '@/lib/collection-utils';
import type { Collection, CollectionField, CollectionItemWithValues } from '@/types';

/**
 * Collections Store
 *
 * Manages state for Collections (CMS) feature using EAV architecture.
 * Handles collections, fields, and items with their values.
 */

interface CollectionsState {
  collections: Collection[];
  fields: Record<string, CollectionField[]>; // keyed by collection_id (UUID)
  items: Record<string, CollectionItemWithValues[]>; // keyed by collection_id (current page only, UUID)
  itemsTotalCount: Record<string, number>; // keyed by collection_id (UUID) - total count for pagination
  selectedCollectionId: string | null;
  isLoading: boolean;
  error: string | null;
}

interface CollectionsActions {
  // Collections
  loadCollections: () => Promise<void>;
  createCollection: (data: {
    name: string;
    sorting?: Record<string, any> | null;
    order?: number;
  }) => Promise<Collection>;
  updateCollection: (id: string, data: Partial<Collection>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  setSelectedCollectionId: (id: string | null) => void;

  // Fields
  loadFields: (collectionId: string, search?: string) => Promise<void>;
  createField: (collectionId: string, data: {
    name: string;
    type: 'text' | 'number' | 'boolean' | 'date' | 'reference' | 'rich_text';
    default?: string | null;
    order?: number;
    reference_collection_id?: string | null; // UUID
    fillable?: boolean;
    key?: string | null;
    hidden?: boolean;
    data?: Record<string, any>;
  }) => Promise<CollectionField>;
  updateField: (collectionId: string, fieldId: string, data: Partial<CollectionField>) => Promise<void>;
  deleteField: (collectionId: string, fieldId: string) => Promise<void>;

  // Items
  loadItems: (collectionId: string, page?: number, limit?: number) => Promise<void>;
  loadPublishedItems: (collectionId: string) => Promise<void>;
  getDropdownItems: (collectionId: string) => Promise<Array<{ id: string; label: string }>>;
  createItem: (collectionId: string, values: Record<string, any>) => Promise<CollectionItemWithValues>;
  updateItem: (collectionId: string, itemId: string, values: Record<string, any>) => Promise<void>;
  deleteItem: (collectionId: string, itemId: string) => Promise<void>;
  duplicateItem: (collectionId: string, itemId: string) => Promise<CollectionItemWithValues | undefined>;
  searchItems: (collectionId: string, query: string, page?: number, limit?: number) => Promise<void>;

  // Sorting
  updateCollectionSorting: (collectionId: string, sorting: { field: string; direction: 'asc' | 'desc' | 'manual' }) => Promise<void>;
  reorderItems: (collectionId: string, updates: Array<{ id: string; manual_order: number }>) => Promise<void>;

  // Utility
  clearError: () => void;

  // Publish
  publishCollections: (collectionIds: string[]) => Promise<{ success: boolean; published?: Record<string, number>; error?: string }>;
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
      const sortedCollections = sortCollectionsByOrder(collections);
      set({ collections: sortedCollections, isLoading: false });

      // Preload fields for all collections
      const fieldsPromises = collections.map(async (collection) => {
        try {
          const fieldsResponse = await collectionsApi.getFields(collection.id);
          if (!fieldsResponse.error && fieldsResponse.data) {
            return { collectionId: collection.id, fields: fieldsResponse.data };
          }
          return { collectionId: collection.id, fields: [] };
        } catch (error) {
          console.error(`Failed to load fields for collection ${collection.id}:`, error);
          return { collectionId: collection.id, fields: [] };
        }
      });

      const fieldsResults = await Promise.all(fieldsPromises);
      const fieldsMap: Record<string, CollectionField[]> = {};

      fieldsResults.forEach(({ collectionId, fields }) => {
        fieldsMap[collectionId] = fields;
      });

      set((state) => ({
        fields: {
          ...state.fields,
          ...fieldsMap,
        },
      }));

      // Preload 20 items per collection
      const itemsPromises = collections.map(async (collection) => {
        try {
          const itemsResponse = await collectionsApi.getItems(collection.id, { page: 1, limit: 20 });
          if (!itemsResponse.error && itemsResponse.data) {
            return {
              collectionId: collection.id,
              items: itemsResponse.data.items || [],
              total: itemsResponse.data.total || 0,
            };
          }
          return { collectionId: collection.id, items: [], total: 0 };
        } catch (error) {
          console.error(`Failed to preload items for collection ${collection.id}:`, error);
          return { collectionId: collection.id, items: [], total: 0 };
        }
      });

      const itemsResults = await Promise.all(itemsPromises);
      const itemsMap: Record<string, CollectionItemWithValues[]> = {};
      const itemsTotalCountMap: Record<string, number> = {};

      itemsResults.forEach(({ collectionId, items, total }) => {
        itemsMap[collectionId] = items;
        itemsTotalCountMap[collectionId] = total;
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load collections';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
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

        // Create all built-in fields
        const createdFields: CollectionField[] = [];
        for (const field of builtInFields) {
          const fieldResponse = await collectionsApi.createField(newCollection.id, field);
          if (!fieldResponse.error && fieldResponse.data) {
            createdFields.push(fieldResponse.data);
          }
        }

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

  setSelectedCollectionId: (id) => {
    set({ selectedCollectionId: id });
  },

  // Fields
  loadFields: async (collectionId: string, search?: string) => {
    set({ isLoading: true, error: null });

    try {
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
  loadItems: async (collectionId: string, page?: number, limit?: number) => {
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.getItems(collectionId, { page, limit });

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
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.createItem(collectionId, values);

      if (response.error) {
        throw new Error(response.error);
      }

      const newItem = response.data!;

      set(state => ({
        items: {
          ...state.items,
          [collectionId]: [...(state.items[collectionId] || []), newItem],
        },
        isLoading: false,
      }));

      return newItem;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create item';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  updateItem: async (collectionId, itemId, values) => {
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.updateItem(collectionId, itemId, values);

      if (response.error) {
        throw new Error(response.error);
      }

      const updated = response.data!;

      set(state => ({
        items: {
          ...state.items,
          [collectionId]: (state.items[collectionId] || []).map(item => item.id === itemId ? updated : item),
        },
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update item';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  deleteItem: async (collectionId, itemId) => {
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.deleteItem(collectionId, itemId);

      if (response.error) {
        throw new Error(response.error);
      }

      set(state => ({
        items: {
          ...state.items,
          [collectionId]: (state.items[collectionId] || []).filter(item => item.id !== itemId),
        },
        isLoading: false,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete item';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  duplicateItem: async (collectionId: string, itemId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.duplicateItem(collectionId, itemId);

      if (response.error) {
        throw new Error(response.error);
      }

      // Optimistically add the new item to the store
      if (response.data) {
        set(state => ({
          items: {
            ...state.items,
            [collectionId]: [...(state.items[collectionId] || []), response.data!],
          },
          isLoading: false,
        }));
      }

      return response.data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to duplicate item';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },

  searchItems: async (collectionId: string, query: string, page?: number, limit?: number) => {
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.searchItems(collectionId, query, { page, limit });

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
      // Check if items are already loaded in store (from preload or previous load)
      const state = get();
      let items = state.items[collectionId];

      // Only load items if not already in store
      if (!items || items.length === 0) {
        await get().loadItems(collectionId, 1, 20);
        // Get updated state after loading
        const updatedState = get();
        items = updatedState.items[collectionId] || [];
      }

      // Fields are already loaded on builder init, so just use them from store
      const collectionFields = state.fields[collectionId] || [];

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

  // Publish
  publishCollections: async (collectionIds: string[]) => {
    set({ isLoading: true, error: null });

    try {
      const response = await collectionsApi.publishCollections(collectionIds);

      if (response.error) {
        throw new Error(response.error);
      }

      // Reload items for affected collections
      for (const collectionId of collectionIds) {
        await get().loadItems(collectionId);
      }

      set({ isLoading: false });
      return { success: true, published: response.data?.published || {} };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to publish collections';
      set({ error: errorMessage, isLoading: false });
      return { success: false, error: errorMessage };
    }
  },
}));
