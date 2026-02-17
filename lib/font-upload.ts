/**
 * Font Upload Utilities
 *
 * Handles uploading custom font files to Supabase Storage and creating font records.
 */

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { createFont } from '@/lib/repositories/fontRepository';
import { STORAGE_BUCKET, STORAGE_FOLDERS } from '@/lib/asset-constants';
import { mapExtensionToFontFormat } from '@/lib/font-utils';
import type { Font } from '@/types';

/**
 * Upload a custom font file to storage and create a font record
 *
 * @param file - Font file (ttf, otf, woff, woff2)
 * @param fontName - Display name for the font
 * @returns Created font record or null if upload fails
 */
export async function uploadFontFile(
  file: File,
  fontName?: string,
): Promise<Font | null> {
  try {
    const supabase = await getSupabaseAdmin();

    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    const format = mapExtensionToFontFormat(extension);

    if (!format) {
      throw new Error(`Unsupported font format: ${extension}`);
    }

    // Generate storage path
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const storagePath = `${STORAGE_FOLDERS.FONTS}/${timestamp}-${random}.${extension}`;

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        cacheControl: '31536000', // Cache for 1 year (fonts don't change)
        upsert: false,
        contentType: file.type || `font/${extension}`,
      });

    if (error) {
      console.error('Error uploading font file:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    // Derive font name from filename if not provided
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const displayName = fontName || baseName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const slugName = displayName.toLowerCase().replace(/\s+/g, '-');

    // Compute file hash for change detection
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Create font record
    const font = await createFont({
      name: slugName,
      family: displayName,
      type: 'custom',
      variants: ['400'], // Default weight
      weights: ['400'],
      category: '',
      kind: format,
      url: urlData.publicUrl,
      storage_path: data.path,
      file_hash: fileHash,
    });

    return font;
  } catch (error) {
    console.error('Error in uploadFontFile:', error);
    return null;
  }
}
