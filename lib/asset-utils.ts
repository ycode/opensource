/**
 * Asset Utility Functions
 * Centralized helpers for asset type detection, formatting, and categorization
 */

import type { AssetCategory } from '@/types';

/**
 * Asset category constants
 */
export const ASSET_CATEGORIES = {
  IMAGES: 'images' as const,
  VIDEOS: 'videos' as const,
  AUDIO: 'audio' as const,
  DOCUMENTS: 'documents' as const,
} as const satisfies Record<string, AssetCategory>;

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

