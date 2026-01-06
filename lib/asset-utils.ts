/**
 * Asset Utility Functions
 * Centralized helpers for asset type detection, formatting, and categorization
 */

import type { AssetCategory } from '@/types';
import {
  ASSET_CATEGORIES,
  ALLOWED_MIME_TYPES,
  getAcceptString,
} from './asset-constants';

// Re-export constants for backward compatibility
export { ASSET_CATEGORIES, ALLOWED_MIME_TYPES, getAcceptString };

/**
 * Check if an asset matches the specified category based on MIME type
 *
 * @param mimeType - The MIME type to check
 * @param category - The asset category to check against ('images', 'videos', 'audio', 'documents')
 * @returns True if the MIME type matches the specified asset category
 *
 * @example
 * isAssetOfType('image/png', 'images') // true
 * isAssetOfType('video/mp4', 'videos') // true
 * isAssetOfType('application/pdf', 'documents') // true
 */
export function isAssetOfType(
  mimeType: string | undefined | null,
  category: AssetCategory
): boolean {
  if (!mimeType) return false;

  switch (category) {
    case 'images':
      return mimeType.startsWith('image/');

    case 'videos':
      return mimeType.startsWith('video/');

    case 'audio':
      return mimeType.startsWith('audio/');

    case 'documents':
      const documentTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
      ];
      return documentTypes.includes(mimeType);

    default:
      return false;
  }
}

/**
 * Get a human-readable asset type label
 */
export function getAssetTypeLabel(mimeType: string | undefined | null): string {
  if (!mimeType) return 'Unknown';
  if (isAssetOfType(mimeType, ASSET_CATEGORIES.IMAGES)) return 'Image';
  if (isAssetOfType(mimeType, ASSET_CATEGORIES.VIDEOS)) return 'Video';
  if (isAssetOfType(mimeType, ASSET_CATEGORIES.AUDIO)) return 'Audio';
  if (isAssetOfType(mimeType, ASSET_CATEGORIES.DOCUMENTS)) return 'Document';
  return 'File';
}

/**
 * Get icon name for an asset type based on MIME type
 */
export function getAssetIcon(mimeType: string | undefined | null): string {
  if (!mimeType) return 'file-text';
  if (isAssetOfType(mimeType, ASSET_CATEGORIES.IMAGES)) return 'image';
  if (isAssetOfType(mimeType, ASSET_CATEGORIES.VIDEOS)) return 'video';
  if (isAssetOfType(mimeType, ASSET_CATEGORIES.AUDIO)) return 'audio';
  if (isAssetOfType(mimeType, ASSET_CATEGORIES.DOCUMENTS)) return 'file-text';
  return 'file-text';
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
 * Get default base 64 encoded SVG asset placeholder by type
 * @param type - Asset category type
 * @returns Default placeholder URL or empty string
 */
export function getDefaultAssetByType(type: AssetCategory): string {
  if (type === ASSET_CATEGORIES.IMAGES) {
    // https://app.ycode.com/images/placeholder-image.jpg
    return 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjAwIDkwMCI+PHJlY3Qgd2lkdGg9IjE2MDAiIGhlaWdodD0iOTAwIiBmaWxsPSIjMmYzNDM3Ii8+PHBvbHlnb24gcG9pbnRzPSIwLDkwMCA2MDAsMzAwIDEyMDAsOTAwIiBmaWxsPSIjNGI1MDUyIiBvcGFjaXR5PSIuNiIvPjxwb2x5Z29uIHBvaW50cz0iNzAwLDkwMCAxMTUwLDQ1MCAxNjAwLDkwMCIgZmlsbD0iIzVhNWY2MSIgb3BhY2l0eT0iLjUiLz48L3N2Zz4=';
  }

  return '';
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
