/**
 * Hash Utilities
 * 
 * Provides content hashing functionality for change detection across
 * pages, components, and layer styles.
 */

import crypto from 'crypto';

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
 * 
 * @param layersData - Layer tree and CSS
 * @returns Content hash
 */
export function generatePageLayersHash(layersData: {
  layers: any;
  generated_css: string | null;
}): string {
  return generateContentHash({
    layers: layersData.layers,
    generated_css: layersData.generated_css,
  });
}

/**
 * Generate a hash for page content (metadata + layers)
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
  const combinedContent = {
    // Page metadata
    name: pageData.name,
    slug: pageData.slug,
    settings: pageData.settings,
    is_index: pageData.is_index,
    is_dynamic: pageData.is_dynamic,
    error_page: pageData.error_page,
    // Layer content
    layers: layersData.layers,
    generated_css: layersData.generated_css,
  };
  
  return generateContentHash(combinedContent);
}

/**
 * Generate a hash for component content
 * 
 * @param componentData - Component name and layers
 * @returns Content hash
 */
export function generateComponentContentHash(componentData: {
  name: string;
  layers: any;
}): string {
  return generateContentHash({
    name: componentData.name,
    layers: componentData.layers,
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

