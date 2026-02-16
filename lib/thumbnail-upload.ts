/**
 * Thumbnail upload utility for component previews
 * Converts image buffers to WebP and uploads to Supabase Storage
 */

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { STORAGE_BUCKET, STORAGE_FOLDERS } from '@/lib/asset-constants';
import sharp from 'sharp';

/**
 * Convert an image buffer to WebP format
 * @param imageBuffer - Raw image buffer (PNG, JPEG, etc.)
 * @param quality - WebP quality 0-100
 * @returns WebP buffer
 */
export async function convertToWebP(imageBuffer: Buffer, quality: number = 85): Promise<Buffer> {
  return sharp(imageBuffer)
    .webp({ quality })
    .toBuffer();
}

/**
 * Upload a component thumbnail to Supabase Storage as WebP
 * Replaces existing thumbnail if present (upsert)
 * @param componentId - Component ID used as filename
 * @param imageBuffer - Raw image buffer (PNG from html-to-image)
 * @returns Public URL of the uploaded thumbnail
 */
export async function uploadThumbnail(componentId: string, imageBuffer: Buffer): Promise<string> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const webpBuffer = await convertToWebP(imageBuffer);
  const storagePath = `${STORAGE_FOLDERS.COMPONENTS}/${componentId}.webp`;

  const { data, error } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, webpBuffer, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'image/webp',
    });

  if (error) {
    throw new Error(`Failed to upload thumbnail: ${error.message}`);
  }

  const { data: urlData } = client.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Delete a component thumbnail from Supabase Storage
 * @param componentId - Component ID used as filename
 */
export async function deleteThumbnail(componentId: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const storagePath = `${STORAGE_FOLDERS.COMPONENTS}/${componentId}.webp`;

  const { error } = await client.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Failed to delete thumbnail: ${error.message}`);
  }
}
