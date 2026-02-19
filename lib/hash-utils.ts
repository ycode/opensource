/**
 * Hash Utilities
 *
 * Provides content hashing functionality for change detection across
 * pages, components, layer styles, and assets.
 */

import crypto from 'crypto';
import { stripUIProperties } from './layer-utils';
import type { Layer } from '@/types';

/**
 * Generate a SHA-256 hash from any content
 *
 * @param content - Any serializable content (object, string, number, etc.)
 * @returns SHA-256 hash as a hex string (64 characters)
 *
 * @example
 * const hash1 = generateContentHash({ name: 'Test', value: 123 });
 * const hash2 = generateContentHash({ name: 'Test', value: 123 });
 * console.log(hash1 === hash2); // true - deterministic hashing
 */
export function generateContentHash(content: any): string {
  // Handle null/undefined
  if (content === null || content === undefined) {
    return crypto
      .createHash('sha256')
      .update('null')
      .digest('hex');
  }

  // Serialize with sorted keys for deterministic hashing
  const serialized = serializeForHash(content);

  // Generate SHA-256 hash
  return crypto
    .createHash('sha256')
    .update(serialized)
    .digest('hex');
}

/**
 * Serialize content with sorted keys for deterministic hashing
 * Ensures the same object always produces the same hash regardless of key order
 */
function serializeForHash(obj: any): string {
  // Primitive types
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj !== 'object') return String(obj);

  // Arrays
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => serializeForHash(item)).join(',') + ']';
  }

  // Objects - sort keys for deterministic output
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key => {
    const value = serializeForHash(obj[key]);
    return `"${key}":${value}`;
  });

  return '{' + pairs.join(',') + '}';
}

/**
 * Generate a hash for page metadata only
 *
 * @param pageData - Page metadata fields
 * @returns Content hash
 */
export function generatePageMetadataHash(pageData: {
  name: string;
  slug: string;
  settings: any;
  is_index: boolean;
  is_dynamic: boolean;
  error_page: number | null;
}): string {
  return generateContentHash({
    name: pageData.name,
    slug: pageData.slug,
    settings: pageData.settings,
    is_index: pageData.is_index,
    is_dynamic: pageData.is_dynamic,
    error_page: pageData.error_page,
  });
}

/**
 * Generate a hash for page layers content
 * Strip UI-only properties (like 'open') before hashing to prevent false changes
 *
 * @param layersData - Layer tree and CSS
 * @returns Content hash
 */
export function generatePageLayersHash(layersData: {
  layers: any;
  generated_css: string | null;
}): string {
  // Strip UI properties from layers before hashing
  const layersForHash = Array.isArray(layersData.layers)
    ? stripUIProperties(layersData.layers as Layer[])
    : layersData.layers;

  return generateContentHash({
    layers: layersForHash,
    generated_css: layersData.generated_css,
  });
}

/**
 * Generate a hash for page content (metadata + layers)
 * Strip UI-only properties (like 'open') before hashing to prevent false changes
 *
 * @param pageData - Page metadata fields
 * @param layersData - Layer tree and CSS
 * @returns Content hash
 */
export function generatePageContentHash(
  pageData: {
    name: string;
    slug: string;
    settings: any;
    is_index: boolean;
    is_dynamic: boolean;
    error_page: number | null;
  },
  layersData: {
    layers: any;
    generated_css: string | null;
  }
): string {
  // Strip UI properties from layers before hashing
  const layersForHash = Array.isArray(layersData.layers)
    ? stripUIProperties(layersData.layers as Layer[])
    : layersData.layers;

  const combinedContent = {
    // Page metadata
    name: pageData.name,
    slug: pageData.slug,
    settings: pageData.settings,
    is_index: pageData.is_index,
    is_dynamic: pageData.is_dynamic,
    error_page: pageData.error_page,
    // Layer content
    layers: layersForHash,
    generated_css: layersData.generated_css,
  };

  return generateContentHash(combinedContent);
}

/**
 * Generate a hash for component content
 * Strip UI-only properties (like 'open') before hashing to prevent false changes
 *
 * @param componentData - Component name and layers
 * @returns Content hash
 */
export function generateComponentContentHash(componentData: {
  name: string;
  layers: any;
}): string {
  // Strip UI properties from layers before hashing
  const layersForHash = Array.isArray(componentData.layers)
    ? stripUIProperties(componentData.layers as Layer[])
    : componentData.layers;

  return generateContentHash({
    name: componentData.name,
    layers: layersForHash,
  });
}

/**
 * Generate a hash for layer style content
 *
 * @param styleData - Style name, classes, and design
 * @returns Content hash
 */
export function generateLayerStyleContentHash(styleData: {
  name: string;
  classes: string;
  design: any;
}): string {
  return generateContentHash({
    name: styleData.name,
    classes: styleData.classes,
    design: styleData.design,
  });
}

/**
 * Generate a hash for asset content
 * Covers all mutable fields that affect the published output
 */
export function generateAssetContentHash(assetData: {
  filename: string;
  storage_path: string | null;
  public_url: string | null;
  file_size: number;
  mime_type: string;
  width?: number | null;
  height?: number | null;
  asset_folder_id?: string | null;
  content?: string | null;
  source: string;
}): string {
  return generateContentHash({
    filename: assetData.filename,
    storage_path: assetData.storage_path,
    public_url: assetData.public_url,
    file_size: assetData.file_size,
    mime_type: assetData.mime_type,
    width: assetData.width ?? null,
    height: assetData.height ?? null,
    asset_folder_id: assetData.asset_folder_id ?? null,
    content: assetData.content ?? null,
    source: assetData.source,
  });
}

/**
 * Generate a content hash for a font for change detection
 */
export function generateFontContentHash(fontData: {
  name: string;
  family: string;
  type: string;
  variants?: string[];
  weights?: string[];
  category?: string;
}): string {
  return generateContentHash({
    name: fontData.name,
    family: fontData.family,
    type: fontData.type,
    variants: fontData.variants,
    weights: fontData.weights,
    category: fontData.category,
  });
}

/**
 * Generate a content hash for a collection item's EAV values.
 * Values are sorted by field_id for stability regardless of insertion order.
 */
export function generateCollectionItemContentHash(
  values: Array<{ field_id: string; value: string | null }>
): string {
  const sorted = [...values]
    .sort((a, b) => a.field_id.localeCompare(b.field_id))
    .map(v => ({ field_id: v.field_id, value: v.value ?? '' }));
  return generateContentHash(sorted);
}
