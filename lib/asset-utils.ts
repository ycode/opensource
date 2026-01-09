/**
 * Asset Utility Functions
 * Centralized helpers for asset type detection, formatting, and categorization
 */

import type { AssetCategory } from '@/types';
import {
  ASSET_CATEGORIES,
  ALLOWED_MIME_TYPES,
  DEFAULT_ASSETS,
  getAcceptString,
} from './asset-constants';

// Re-export constants for backward compatibility
export { ASSET_CATEGORIES, ALLOWED_MIME_TYPES, DEFAULT_ASSETS, getAcceptString };

/**
 * Check if an asset matches the specified category based on MIME type
 * Always uses ALLOWED_MIME_TYPES for consistency across all categories
 *
 * @param mimeType - The MIME type to check
 * @param category - The asset category to check against ('images', 'videos', 'audio', 'documents', 'icons')
 * @returns True if the MIME type matches the specified asset category
 *
 * @example
 * isAssetOfType('image/png', 'images') // true
 * isAssetOfType('image/svg+xml', 'icons') // true
 * isAssetOfType('video/mp4', 'videos') // true
 * isAssetOfType('application/pdf', 'documents') // true
 */
export function isAssetOfType(
  mimeType: string | undefined | null,
  category: AssetCategory
): boolean {
  if (!mimeType) return false;
  return ALLOWED_MIME_TYPES[category].includes(mimeType);
}

// Category to label mapping
const CATEGORY_LABELS: Record<AssetCategory, string> = {
  icons: 'Icon',
  images: 'Image',
  videos: 'Video',
  audio: 'Audio',
  documents: 'Document',
};

/**
 * Get a human-readable asset type label
 * Optimized to use getAssetCategoryFromMimeType instead of multiple isAssetOfType calls
 */
export function getAssetTypeLabel(mimeType: string | undefined | null): string {
  if (!mimeType) return 'Unknown';
  const category = getAssetCategoryFromMimeType(mimeType);
  return category ? CATEGORY_LABELS[category] : 'File';
}

// Category to icon name mapping
const CATEGORY_ICONS: Record<AssetCategory, string> = {
  icons: 'icon',
  images: 'image',
  videos: 'video',
  audio: 'audio',
  documents: 'file-text',
};

/**
 * Get icon name for an asset type based on MIME type
 * Optimized to use getAssetCategoryFromMimeType instead of multiple isAssetOfType calls
 */
export function getAssetIcon(mimeType: string | undefined | null): string {
  if (!mimeType) return 'file-text';
  const category = getAssetCategoryFromMimeType(mimeType);
  return category ? CATEGORY_ICONS[category] : 'file-text';
}

/**
 * Get asset category from MIME type
 * Returns the category that matches the MIME type, or null if no match
 * Optimized to check categories in order of specificity (icons first, then by prefix, then by ALLOWED_MIME_TYPES)
 *
 * @param mimeType - The MIME type to check
 * @returns The asset category ('images', 'videos', 'audio', 'documents', 'icons') or null if unknown
 *
 * @example
 * getAssetCategoryFromMimeType('image/png') // 'images'
 * getAssetCategoryFromMimeType('image/svg+xml') // 'icons'
 * getAssetCategoryFromMimeType('video/mp4') // 'videos'
 * getAssetCategoryFromMimeType('unknown/type') // null
 */
export function getAssetCategoryFromMimeType(
  mimeType: string | undefined | null
): AssetCategory | null {
  if (!mimeType) return null;

  // Check icons first (most specific, uses ALLOWED_MIME_TYPES)
  if (ALLOWED_MIME_TYPES.icons.includes(mimeType)) {
    return ASSET_CATEGORIES.ICONS;
  }

  // Check by prefix for faster matching (images, videos, audio)
  if (mimeType.startsWith('image/')) {
    return ASSET_CATEGORIES.IMAGES;
  }
  if (mimeType.startsWith('video/')) {
    return ASSET_CATEGORIES.VIDEOS;
  }
  if (mimeType.startsWith('audio/')) {
    return ASSET_CATEGORIES.AUDIO;
  }

  // Check documents (requires array lookup in ALLOWED_MIME_TYPES)
  if (ALLOWED_MIME_TYPES.documents.includes(mimeType)) {
    return ASSET_CATEGORIES.DOCUMENTS;
  }

  return null;
}

/**
 * Format file size to human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round(bytes / Math.pow(k, i))} ${sizes[i]}`;
}

/**
 * File validation result type
 */
export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate an image file for upload
 * @param file - The file to validate
 * @param maxSizeMB - Maximum file size in megabytes (default: 10MB)
 * @returns Validation result with error message if invalid
 *
 * @example
 * const result = validateImageFile(file, 5);
 * if (!result.isValid) {
 *   console.error(result.error);
 * }
 */
export function validateImageFile(
  file: File,
  maxSizeMB: number = 10
): FileValidationResult {
  // Check file type
  if (!isAssetOfType(file.type, ASSET_CATEGORIES.IMAGES)) {
    return {
      isValid: false,
      error: 'Only image files are allowed',
    };
  }

  // Check file size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      isValid: false,
      error: `File size must be less than ${maxSizeMB}MB`,
    };
  }

  return { isValid: true };
}

/**
 * Generate optimized thumbnail URL for faster loading
 * Adds image transformation parameters for Supabase Storage URLs to reduce file size
 * @param url - Original image URL
 * @param width - Target width in pixels (default: 200)
 * @param height - Target height in pixels (default: 200)
 * @param quality - Image quality 0-100 (default: 80)
 * @returns Optimized URL with transformation parameters or original URL if not a Supabase Storage URL
 *
 * @example
 * getOptimizedImageUrl('https://supabase.co/storage/v1/object/public/assets/image.jpg')
 * // Returns: 'https://supabase.co/storage/v1/object/public/assets/image.jpg?width=200&height=200&resize=cover&quality=80'
 */
export function getOptimizedImageUrl(
  url: string,
  width: number = 200,
  height: number = 200,
  quality: number = 80
): string {
  try {
    const urlObj = new URL(url);
    // Check if it's a Supabase Storage URL
    if (urlObj.hostname.includes('supabase') || urlObj.pathname.includes('/storage/v1/object/public/')) {
      // Add image transformation parameters for smaller, optimized thumbnails
      urlObj.searchParams.set('width', width.toString());
      urlObj.searchParams.set('height', height.toString());
      urlObj.searchParams.set('resize', 'cover');
      urlObj.searchParams.set('quality', quality.toString());
      return urlObj.toString();
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Generate responsive image srcset with multiple sizes
 * Creates optimized URLs for different viewport widths
 * @param url - Original image URL
 * @param sizes - Array of widths in pixels (default: [400, 800, 1200, 1600])
 * @param quality - Image quality 0-100 (default: 85)
 * @returns Srcset string with multiple size options
 *
 * @example
 * generateImageSrcset('https://supabase.co/storage/v1/object/public/assets/image.jpg')
 * // Returns: 'https://.../image.jpg?width=400&quality=85 400w, https://.../image.jpg?width=800&quality=85 800w, ...'
 */
export function generateImageSrcset(
  url: string,
  sizes: number[] = [400, 800, 1200, 1600],
  quality: number = 85
): string {
  try {
    const urlObj = new URL(url);
    // Check if it's a Supabase Storage URL
    const isSupabaseUrl = urlObj.hostname.includes('supabase') || urlObj.pathname.includes('/storage/v1/object/public/');

    if (!isSupabaseUrl) {
      // For non-Supabase URLs, return empty srcset (browser will use src)
      return '';
    }

    // Generate srcset entries for each size
    const srcsetEntries = sizes.map((width) => {
      const sizeUrl = new URL(url);
      sizeUrl.searchParams.set('width', width.toString());
      sizeUrl.searchParams.set('quality', quality.toString());
      sizeUrl.searchParams.set('resize', 'cover');
      return `${sizeUrl.toString()} ${width}w`;
    });

    return srcsetEntries.join(', ');
  } catch {
    return '';
  }
}

/**
 * Get responsive sizes attribute for images
 * Provides default sizes based on common viewport breakpoints
 * @param customSizes - Optional custom sizes string (e.g., "(max-width: 768px) 100vw, 50vw")
 * @returns Sizes attribute string
 *
 * @example
 * getImageSizes() // Returns: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
 */
export function getImageSizes(customSizes?: string): string {
  if (customSizes) {
    return customSizes;
  }
  // Default responsive sizes: full width on mobile, half on tablet, third on desktop
  return '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';
}

// ==========================================
// Re-export folder utilities for backward compatibility
// ==========================================

export {
  flattenAssetFolderTree,
  hasChildFolders,
  rebuildAssetFolderTree,
  buildAssetFolderPath,
  isDescendantAssetFolder,
  type FlattenedAssetFolderNode,
} from './asset-folder-utils';
