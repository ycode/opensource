/**
 * Multi-Asset Collection Utils
 *
 * Shared utilities for multi-asset nested collections.
 * Used by both LayerRenderer (client) and page-fetcher (SSR).
 */

import type { Asset } from '@/types';
import { formatFileSize } from './asset-utils';
import { MULTI_ASSET_VIRTUAL_FIELDS } from './collection-field-utils';

/**
 * Build virtual field values from an Asset object.
 * Used to create the data context for layers inside a multi-asset collection.
 */
export function buildAssetVirtualValues(asset: Asset): Record<string, string> {
  return {
    [MULTI_ASSET_VIRTUAL_FIELDS.FILENAME]: asset.filename || '',
    [MULTI_ASSET_VIRTUAL_FIELDS.URL]: asset.public_url || '',
    [MULTI_ASSET_VIRTUAL_FIELDS.FILE_SIZE]: formatFileSize(asset.file_size || 0),
    [MULTI_ASSET_VIRTUAL_FIELDS.MIME_TYPE]: asset.mime_type || '',
    [MULTI_ASSET_VIRTUAL_FIELDS.WIDTH]: asset.width?.toString() || '',
    [MULTI_ASSET_VIRTUAL_FIELDS.HEIGHT]: asset.height?.toString() || '',
  };
}

/**
 * Parse asset IDs from a multi-asset field value.
 * Handles both JSON string and already-parsed array formats.
 */
export function parseMultiAssetFieldValue(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
