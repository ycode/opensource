/**
 * Custom hook to resolve asset IDs to Asset objects
 * 
 * Provides a simple interface for components to get asset details by ID
 */

import { useEffect, useState } from 'react';
import { useAssetsStore } from '@/stores/useAssetsStore';
import type { Asset } from '@/types';

/**
 * Hook to get an asset by ID
 * Returns the asset object or null if not found
 * Automatically loads assets store if not already loaded
 */
export function useAsset(assetId: string | null | undefined): Asset | null {
  const [asset, setAsset] = useState<Asset | null>(null);
  const { getAsset, loadAssets, isLoaded } = useAssetsStore();

  useEffect(() => {
    // Load assets if not already loaded
    if (!isLoaded) {
      loadAssets();
    }
  }, [isLoaded, loadAssets]);

  useEffect(() => {
    if (!assetId) {
      setAsset(null);
      return;
    }

    const foundAsset = getAsset(assetId);
    setAsset(foundAsset);
  }, [assetId, getAsset]);

  return asset;
}

/**
 * Hook to get multiple assets by IDs
 * Returns an array of assets (nulls for not found)
 */
export function useAssets(assetIds: (string | null | undefined)[]): (Asset | null)[] {
  const [assets, setAssets] = useState<(Asset | null)[]>([]);
  const { getAsset, loadAssets, isLoaded } = useAssetsStore();

  useEffect(() => {
    // Load assets if not already loaded
    if (!isLoaded) {
      loadAssets();
    }
  }, [isLoaded, loadAssets]);

  useEffect(() => {
    const foundAssets = assetIds.map(id => id ? getAsset(id) : null);
    setAssets(foundAssets);
  }, [assetIds, getAsset]);

  return assets;
}
