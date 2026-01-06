/**
 * Assets Store
 * 
 * Global store for managing assets (images, files) with caching
 */

import { create } from 'zustand';
import type { Asset, AssetFolder } from '@/types';

interface AssetsState {
  assets: Asset[];
  assetsById: Record<string, Asset>;
  folders: AssetFolder[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
}

interface AssetsActions {
  loadAssets: () => Promise<void>;
  setAssets: (assets: Asset[]) => void;
  setFolders: (folders: AssetFolder[]) => void;
  getAsset: (id: string) => Asset | null;
  addAsset: (asset: Asset) => void;
  updateAsset: (assetId: string, updates: Partial<Asset>) => void;
  removeAsset: (id: string) => void;
  addFolder: (folder: AssetFolder) => void;
  updateFolder: (folderId: string, updates: Partial<AssetFolder>) => void;
  deleteFolder: (folderId: string) => Promise<string[]>;
  batchReorderFolders: (updatedFolders: AssetFolder[]) => Promise<void>;
  reset: () => void;
}

type AssetsStore = AssetsState & AssetsActions;

const initialState: AssetsState = {
  assets: [],
  assetsById: {},
  folders: [],
  isLoading: false,
  isLoaded: false,
  error: null,
};

export const useAssetsStore = create<AssetsStore>((set, get) => ({
  ...initialState,

  /**
   * Set assets directly (used during initial load)
   */
  setAssets: (assets: Asset[]) => {
    // Create lookup map
    const assetsById: Record<string, Asset> = {};
    assets.forEach((asset) => {
      assetsById[asset.id] = asset;
    });

    set({
      assets,
      assetsById,
      isLoaded: true,
    });
  },

  /**
   * Set asset folders directly (used during initial load)
   */
  setFolders: (folders: AssetFolder[]) => {
    set({ folders });
  },

  /**
   * Load all assets from API (fallback if not preloaded)
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
   * Update asset in store
   */
  updateAsset: (assetId: string, updates: Partial<Asset>) => {
    set((state) => {
      const updatedAsset = { ...state.assetsById[assetId], ...updates };
      return {
        assets: state.assets.map(a => 
          a.id === assetId ? updatedAsset : a
        ),
        assetsById: {
          ...state.assetsById,
          [assetId]: updatedAsset,
        },
      };
    });
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
   * Add folder to store
   */
  addFolder: (folder: AssetFolder) => {
    set((state) => ({
      folders: [...state.folders, folder],
    }));
  },

  /**
   * Update folder in store
   */
  updateFolder: (folderId: string, updates: Partial<AssetFolder>) => {
    set((state) => ({
      folders: state.folders.map(f => 
        f.id === folderId ? { ...f, ...updates } : f
      ),
    }));
  },

  /**
   * Delete folder and all its descendants recursively
   * Returns array of all deleted folder IDs
   */
  deleteFolder: async (folderId: string): Promise<string[]> => {
    const state = get();

    // Helper to get all descendant folder IDs recursively
    const getDescendantFolderIds = (parentId: string): string[] => {
      const children = state.folders.filter(f => f.asset_folder_id === parentId);
      const descendants: string[] = children.map(c => c.id);
      
      for (const child of children) {
        descendants.push(...getDescendantFolderIds(child.id));
      }
      
      return descendants;
    };

    // Get all folders that will be deleted
    const descendantIds = getDescendantFolderIds(folderId);
    const allFolderIdsToDelete = [folderId, ...descendantIds];

    // Call API to delete folder (backend handles cascading deletion)
    const response = await fetch(`/api/asset-folders/${folderId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete folder');
    }

    // Update state: remove deleted folders
    set((state) => ({
      folders: state.folders.filter(f => !allFolderIdsToDelete.includes(f.id)),
    }));

    // Update state: remove assets that were in deleted folders
    set((state) => {
      const remainingAssets = state.assets.filter(asset => {
        // Keep assets that are not in any of the deleted folders
        return !asset.asset_folder_id || !allFolderIdsToDelete.includes(asset.asset_folder_id);
      });

      // Rebuild assetsById
      const assetsById: Record<string, Asset> = {};
      remainingAssets.forEach((asset) => {
        assetsById[asset.id] = asset;
      });

      return {
        assets: remainingAssets,
        assetsById,
      };
    });

    return allFolderIdsToDelete;
  },

  /**
   * Batch reorder folders after drag and drop
   * Optimistically updates UI then syncs with backend
   */
  batchReorderFolders: async (updatedFolders: AssetFolder[]) => {
    const { folders } = get();

    // Store original state for rollback
    const originalFolders = folders;

    try {
      // Optimistically update the UI
      set({
        folders: updatedFolders,
        isLoading: true,
      });

      // Batch update folders
      const updatePromises = updatedFolders.map(async (folder) => {
        const originalFolder = originalFolders.find(f => f.id === folder.id);
        if (!originalFolder) return;

        // Only update if something changed
        if (
          originalFolder.asset_folder_id !== folder.asset_folder_id ||
          originalFolder.order !== folder.order ||
          originalFolder.depth !== folder.depth
        ) {
          const response = await fetch(`/api/asset-folders/${folder.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              asset_folder_id: folder.asset_folder_id,
              order: folder.order,
              depth: folder.depth,
            }),
          });

          if (!response.ok) {
            throw new Error(`Failed to update folder ${folder.id}`);
          }
        }
      });

      // Wait for all updates to complete
      await Promise.all(updatePromises);

      set({ isLoading: false });
    } catch (error) {
      console.error('Failed to reorder folders:', error);
      
      // Rollback to original state on error
      set({
        folders: originalFolders,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to reorder folders',
      });
      
      throw error;
    }
  },

  /**
   * Reset store to initial state
   */
  reset: () => {
    set(initialState);
  },
}));
