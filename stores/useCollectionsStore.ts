import { create } from 'zustand';
import { collectionsApi } from '@/lib/api';
import type { Collection, CollectionField, CollectionItemWithValues } from '@/types';

/**
 * Collections Store
 * 
 * Manages state for Collections (CMS) feature using EAV architecture.
 * Handles collections, fields, and items with their values.
 */

interface CollectionsState {
  collections: Collection[];
  fields: Record<number, CollectionField[]>; // keyed by collection_id
  items: Record<number, CollectionItemWithValues[]>; // keyed by collection_id
  selectedCollectionId: number | null;
  isLoading: boolean;
  error: string | null;
}

interface CollectionsActions {
  // Collections
  loadCollections: () => Promise<void>;
  createCollection: (data: {
    name: string;
    collection_name: string;
    sorting?: Record<string, any> | null;
    order?: number | null;
  }) => Promise<Collection>;
  updateCollection: (id: number, data: Partial<Collection>) => Promise<void>;
  deleteCollection: (id: number) => Promise<void>;
  setSelectedCollectionId: (id: number | null) => void;
  
  // Fields
  loadFields: (collectionId: number) => Promise<void>;
  createField: (collectionId: number, data: {
    name: string;
    field_name: string;
    type: 'text' | 'number' | 'boolean' | 'date' | 'reference';
    default?: string | null;
    order?: number;
    reference_collection_id?: number | null;
    fillable?: boolean;
    built_in?: boolean;
    hidden?: boolean;
    data?: Record<string, any>;
  }) => Promise<CollectionField>;
  updateField: (collectionId: number, fieldId: number, data: Partial<CollectionField>) => Promise<void>;
  deleteField: (collectionId: number, fieldId: number) => Promise<void>;
  
  // Items
  loadItems: (collectionId: number) => Promise<void>;
  loadPublishedItems: (collectionId: number) => Promise<void>;
  createItem: (collectionId: number, values: Record<string, any>) => Promise<CollectionItemWithValues>;
  updateItem: (collectionId: number, itemId: number, values: Record<string, any>) => Promise<void>;
  deleteItem: (collectionId: number, itemId: number) => Promise<void>;
  searchItems: (collectionId: number, query: string) => Promise<void>;
  
  // Utility
  clearError: () => void;

  // Publish
  publishCollections: (collectionIds: number[]) => Promise<{ success: boolean; published?: Record<number, number>; error?: string }>;
}

type CollectionsStore = CollectionsState & CollectionsActions;

export const useCollectionsStore = create<CollectionsStore>((set, get) => ({
  // Initial state
  collections: [],
  fields: {},
  items: {},
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
      
      set({ collections: response.data || [], isLoading: false });
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
            field_name: 'id',
            type: 'number' as const,
            order: 0,
            built_in: true,
            fillable: false,
            hidden: false,
          },
          {
            name: 'Name',
            field_name: 'name',
            type: 'text' as const,
            order: 1,
            built_in: true,
            fillable: true,
            hidden: false,
          },
          {
            name: 'Slug',
            field_name: 'slug',
            type: 'text' as const,
            order: 2,
            built_in: true,
            fillable: true,
            hidden: false,
          },
          {
            name: 'Created Date',
            field_name: 'created_at',
            type: 'date' as const,
            order: 3,
            built_in: true,
            fillable: false,
            hidden: false,
          },
          {
            name: 'Updated Date',
            field_name: 'updated_at',
            type: 'date' as const,
            order: 4,
            built_in: true,
            fillable: false,
            hidden: false,
          },
        ];
        
        // Create all built-in fields
        for (const field of builtInFields) {
          await collectionsApi.createField(newCollection.id, field);
        }
      } catch (fieldError) {
        console.error('Failed to create built-in fields:', fieldError);
        // Continue anyway - collection was created successfully
      }
      
      set(state => ({
        collections: [...state.collections, newCollection],
        isLoading: false,
      }));
      
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
      
      set(state => ({
        collections: state.collections.map(c => c.id === id ? updated : c),
        isLoading: false,
      }));
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
      
      set(state => ({
        collections: state.collections.filter(c => c.id !== id),
        selectedCollectionId: state.selectedCollectionId === id ? null : state.selectedCollectionId,
        isLoading: false,
      }));
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
  loadFields: async (collectionId) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await collectionsApi.getFields(collectionId);
      
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
  loadItems: async (collectionId) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await collectionsApi.getItems(collectionId);
      
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
  
  searchItems: async (collectionId, query) => {
    set({ isLoading: true, error: null });
    
    try {
      const response = await collectionsApi.searchItems(collectionId, query);
      
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
      const errorMessage = error instanceof Error ? error.message : 'Failed to search items';
      set({ error: errorMessage, isLoading: false });
      throw error;
    }
  },
  
  // Utility
  clearError: () => {
    set({ error: null });
  },

  // Publish
  publishCollections: async (collectionIds: number[]) => {
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

