/**
 * Asset Category Constants
 * Shared constants for asset categorization (no dependencies to avoid circular imports)
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
 * Allowed MIME types per asset category
 */
export const ALLOWED_MIME_TYPES: Record<AssetCategory, string[]> = {
  images: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
    'image/tiff',
  ],
  videos: [
    'video/mp4',
    'video/mpeg',
    'video/webm',
    'video/ogg',
    'video/quicktime',
    'video/x-msvideo',
  ],
  audio: [
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    'audio/aac',
  ],
  documents: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
  ],
};

/**
 * Get accept attribute string for file input based on category
 */
export function getAcceptString(category?: AssetCategory): string {
  if (!category) {
    return Object.values(ALLOWED_MIME_TYPES).flat().join(',');
  }
  return ALLOWED_MIME_TYPES[category].join(',');
}
