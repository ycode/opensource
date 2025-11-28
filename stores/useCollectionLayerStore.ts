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
  clearLayerData: (layerId: string) => void;
  clearAllLayerData: () => void;
}

type CollectionLayerStore = CollectionLayerState & CollectionLayerActions;

export const useCollectionLayerStore = create<CollectionLayerStore>((set, get) => ({
  // Initial state
  layerData: {},
  loading: {},
  error: {},

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
    });
  },
}));
