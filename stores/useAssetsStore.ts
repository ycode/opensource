/**
 * Assets Store
 * 
 * Global store for managing assets (images, files) with caching
 */

import { create } from 'zustand';
import type { Asset } from '@/types';

interface AssetsState {
  assets: Asset[];
  assetsById: Record<string, Asset>;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
}

interface AssetsActions {
  loadAssets: () => Promise<void>;
  getAsset: (id: string) => Asset | null;
  addAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;
  reset: () => void;
}

type AssetsStore = AssetsState & AssetsActions;

const initialState: AssetsState = {
  assets: [],
  assetsById: {},
  isLoading: false,
  isLoaded: false,
  error: null,
};

export const useAssetsStore = create<AssetsStore>((set, get) => ({
  ...initialState,

  /**
   * Load all assets from API
   */
  loadAssets: async () => {
    // Don't reload if already loaded or currently loading
    if (get().isLoaded || get().isLoading) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await fetch('/api/assets');
      
      if (!response.ok) {
        throw new Error('Failed to fetch assets');
      }

      const { data: assets } = await response.json();
      
      // Create lookup map
      const assetsById: Record<string, Asset> = {};
      assets.forEach((asset: Asset) => {
        assetsById[asset.id] = asset;
      });

      set({
        assets,
        assetsById,
        isLoading: false,
        isLoaded: true,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load assets',
      });
    }
  },

  /**
   * Get asset by ID (from cache or fetch if not found)
   */
  getAsset: (id: string) => {
    const state = get();
    
    // Try to get from cache
    const cached = state.assetsById[id];
    if (cached) {
      return cached;
    }

    // If not in cache and store is loaded, it doesn't exist
    if (state.isLoaded) {
      return null;
    }

    // If store not loaded yet, fetch from API in background
    fetch(`/api/assets/${id}`)
      .then(res => res.ok ? res.json() : null)
      .then(result => {
        if (result?.data) {
          const asset = result.data;
          set((state) => ({
            assetsById: {
              ...state.assetsById,
              [asset.id]: asset,
            },
          }));
        }
      })
      .catch(err => {
        console.error('Failed to fetch asset:', err);
      });

    return null;
  },

  /**
   * Add new asset to store (after upload)
   */
  addAsset: (asset: Asset) => {
    set((state) => ({
      assets: [asset, ...state.assets],
      assetsById: {
        ...state.assetsById,
        [asset.id]: asset,
      },
    }));
  },

  /**
   * Remove asset from store (after delete)
   */
  removeAsset: (id: string) => {
    set((state) => {
      const { [id]: removed, ...restAssetsById } = state.assetsById;
      
      return {
        assets: state.assets.filter(a => a.id !== id),
        assetsById: restAssetsById,
      };
    });
  },

  /**
   * Reset store to initial state
   */
  reset: () => {
    set(initialState);
  },
}));
