import { create } from 'zustand';
import { collectionsApi } from '@/lib/api';
import type { CollectionItemWithValues } from '@/types';

/**
 * Collection Layer Store
 *
 * Manages collection data specifically for collection layers in the builder.
 * This is separate from the CMS items store to allow independent data fetching
 * with different sort/limit/offset settings per layer.
 */

interface CollectionLayerState {
  layerData: Record<string, CollectionItemWithValues[]>; // keyed by layerId
  loading: Record<string, boolean>; // loading state per layer
  error: Record<string, string | null>; // error state per layer
  layerConfig: Record<string, { collectionId: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; limit?: number; offset?: number }>; // Track config per layer
  referencedItems: Record<string, CollectionItemWithValues[]>; // Items for referenced collections, keyed by collectionId
  referencedLoading: Record<string, boolean>; // Loading state for referenced collections
}

interface CollectionLayerActions {
  fetchLayerData: (
    layerId: string,
    collectionId: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    limit?: number,
    offset?: number
  ) => Promise<void>;
  fetchReferencedCollectionItems: (collectionId: string) => Promise<void>;
  clearLayerData: (layerId: string) => void;
  clearAllLayerData: () => void;
  updateItemInLayerData: (itemId: string, values: Record<string, string>) => void;
  refetchLayersForCollection: (collectionId: string) => Promise<void>;
}

type CollectionLayerStore = CollectionLayerState & CollectionLayerActions;

export const useCollectionLayerStore = create<CollectionLayerStore>((set, get) => ({
  // Initial state
  layerData: {},
  loading: {},
  error: {},
  layerConfig: {},
  referencedItems: {},
  referencedLoading: {},

  // Fetch items for a referenced collection (used for reference field resolution)
  fetchReferencedCollectionItems: async (collectionId: string) => {
    const { referencedItems, referencedLoading } = get();
    
    // Skip if already loaded or loading
    if (referencedItems[collectionId] || referencedLoading[collectionId]) {
      return;
    }
    
    set((state) => ({
      referencedLoading: { ...state.referencedLoading, [collectionId]: true },
    }));
    
    try {
      const response = await collectionsApi.getItems(collectionId, { limit: 100 });
      
      if (!response.error && response.data?.items) {
        set((state) => ({
          referencedItems: { ...state.referencedItems, [collectionId]: response.data!.items },
          referencedLoading: { ...state.referencedLoading, [collectionId]: false },
        }));
      }
    } catch (error) {
      console.error(`[CollectionLayerStore] Error fetching referenced items for ${collectionId}:`, error);
      set((state) => ({
        referencedLoading: { ...state.referencedLoading, [collectionId]: false },
      }));
    }
  },

  // Fetch data for a specific layer
  fetchLayerData: async (
    layerId: string,
    collectionId: string,
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'asc',
    limit?: number,
    offset?: number
  ) => {
    // Set loading state
    set((state) => ({
      loading: { ...state.loading, [layerId]: true },
      error: { ...state.error, [layerId]: null },
    }));

    try {
      // Fetch items using existing API with layer-specific parameters
      const response = await collectionsApi.getItems(collectionId, {
        sortBy,
        sortOrder,
        limit,
        offset,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const items = response.data?.items || [];

      console.log(`[CollectionLayerStore] Fetched data for layer ${layerId}:`, {
        collectionId,
        sortBy,
        sortOrder,
        limit,
        offset,
        itemsCount: items.length,
        items
      });

      // Store fetched data keyed by layerId
      set((state) => ({
        layerData: { ...state.layerData, [layerId]: items },
        loading: { ...state.loading, [layerId]: false },
        layerConfig: { 
          ...state.layerConfig, 
          [layerId]: { collectionId, sortBy, sortOrder, limit, offset } 
        },
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch layer data';
      set((state) => ({
        error: { ...state.error, [layerId]: errorMessage },
        loading: { ...state.loading, [layerId]: false },
      }));
      console.error(`[CollectionLayerStore] Error fetching data for layer ${layerId}:`, error);
    }
  },

  // Clear data for a specific layer
  clearLayerData: (layerId: string) => {
    set((state) => {
      const { [layerId]: _, ...restLayerData } = state.layerData;
      const { [layerId]: __, ...restLoading } = state.loading;
      const { [layerId]: ___, ...restError } = state.error;

      return {
        layerData: restLayerData,
        loading: restLoading,
        error: restError,
      };
    });
  },

  // Clear all layer data
  clearAllLayerData: () => {
    set({
      layerData: {},
      loading: {},
      error: {},
      referencedItems: {},
      referencedLoading: {},
    });
  },

  // Optimistically update an item across all layer data
  updateItemInLayerData: (itemId, values) => {
    set((state) => {
      const newLayerData = { ...state.layerData };
      
      // Update the item in all layers that have it
      Object.keys(newLayerData).forEach(layerId => {
        newLayerData[layerId] = newLayerData[layerId].map(item => {
          if (item.id === itemId) {
            return { ...item, values };
          }
          return item;
        });
      });
      
      return { layerData: newLayerData };
    });
  },

  // Refetch all layers that use a specific collection
  refetchLayersForCollection: async (collectionId) => {
    const { layerData, layerConfig } = get();
    
    console.log('[CollectionLayerStore] Refetching layers for collection:', collectionId);
    
    // Find all layers that use this collection
    const layersToRefetch = Object.entries(layerConfig)
      .filter(([_, config]) => config.collectionId === collectionId)
      .map(([layerId]) => layerId);
    
    console.log('[CollectionLayerStore] Layers to refetch:', layersToRefetch);
    
    // Refetch each layer without showing loading state
    for (const layerId of layersToRefetch) {
      const config = layerConfig[layerId];
      if (config) {
        try {
          const response = await collectionsApi.getItems(config.collectionId, {
            sortBy: config.sortBy,
            sortOrder: config.sortOrder,
            limit: config.limit,
            offset: config.offset,
          });

          if (!response.error && response.data?.items) {
            // Update data silently (no loading state change)
            set((state) => ({
              layerData: { ...state.layerData, [layerId]: response.data!.items },
            }));
          }
        } catch (error) {
          console.error(`[CollectionLayerStore] Error refetching layer ${layerId}:`, error);
        }
      }
    }
  },
}));
