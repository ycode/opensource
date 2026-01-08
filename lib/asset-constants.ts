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
    'image/avif',
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
 * Default placeholder assets for when asset_id is null
 */
export const DEFAULT_ASSETS = {
  IMAGE: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxNjAwIDkwMCI+PHJlY3Qgd2lkdGg9IjE2MDAiIGhlaWdodD0iOTAwIiBmaWxsPSIjMmYzNDM3Ii8+PHBvbHlnb24gcG9pbnRzPSIwLDkwMCA2MDAsMzAwIDEyMDAsOTAwIiBmaWxsPSIjNGI1MDUyIiBvcGFjaXR5PSIuNiIvPjxwb2x5Z29uIHBvaW50cz0iNzAwLDkwMCAxMTUwLDQ1MCAxNjAwLDkwMCIgZmlsbD0iIzVhNWY2MSIgb3BhY2l0eT0iLjUiLz48L3N2Zz4=',
  ICON: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>',
  VIDEO: '',
  AUDIO: '',
} as const;

/**
 * Get accept attribute string for file input based on category
 */
export function getAcceptString(category?: AssetCategory): string {
  if (!category) {
    return Object.values(ALLOWED_MIME_TYPES).flat().join(',');
  }
  return ALLOWED_MIME_TYPES[category].join(',');
}
