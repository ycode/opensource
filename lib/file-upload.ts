/**
 * File upload utilities for Supabase Storage
 * Creates Asset records in database for uploaded files
 */

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { createAsset } from '@/lib/repositories/assetRepository';
import { isAssetOfType, ASSET_CATEGORIES } from './asset-utils';
import sharp from 'sharp';
import type { Asset } from '@/types';

const STORAGE_BUCKET = 'assets';

/**
 * Validate SVG content
 * @param content - SVG content to validate
 * @returns true if valid, false otherwise
 */
export function isValidSvg(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return false;
  }

  // Check for SVG tag (case-insensitive)
  const svgTagRegex = /<svg[\s>]/i;
  if (!svgTagRegex.test(trimmed)) {
    return false;
  }

  // Check for closing SVG tag or self-closing tag
  const hasClosingTag = /<\/svg>/i.test(trimmed);
  const hasSelfClosing = /<svg[^>]*\/>/i.test(trimmed);

  if (!hasClosingTag && !hasSelfClosing) {
    return false;
  }

  // Basic structure check: ensure we have at least one SVG element
  const svgMatch = trimmed.match(/<svg[\s>][\s\S]*<\/svg>/i);
  if (!svgMatch) {
    return false;
  }

  return true;
}

/**
 * Clean SVG content by removing potentially dangerous elements, attributes, and comments
 * @param svgContent - Raw SVG string
 * @returns Cleaned SVG string without classes, IDs, comments, or fixed dimensions (preserves inline styles)
 */
export function cleanSvgContent(svgContent: string): string {
  // Remove XML declarations and DOCTYPE
  let cleaned = svgContent
    .replace(/<\?xml[^?]*\?>/gi, '') // Remove <?xml ... ?>
    .replace(/<!DOCTYPE[^>]*>/gi, ''); // Remove <!DOCTYPE ... >

  // Remove HTML/XML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove script tags and event handlers
  cleaned = cleaned
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, ''); // Remove event handlers like onclick, onload, etc.

  // Remove potentially dangerous tags
  const dangerousTags = ['script', 'iframe', 'embed', 'object', 'link', 'style'];
  dangerousTags.forEach(tag => {
    const regex = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });

  // Remove unwanted attributes (width, height)
  cleaned = cleaned
    .replace(/(<svg[^>]*)\s+width\s*=\s*["'][^"']*["']/gi, '$1') // Remove width from SVG
    .replace(/(<svg[^>]*)\s+height\s*=\s*["'][^"']*["']/gi, '$1'); // Remove height from SVG

  // Remove excessive whitespace
  cleaned = cleaned
    .replace(/\s+/g, ' ') // Replace multiple spaces/newlines with single space
    .replace(/>\s+</g, '><'); // Remove spaces between tags

  return cleaned.trim();
}

/**
 * Extract image dimensions from file buffer using sharp
 */
async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  try {
    if (!isAssetOfType(file.type, ASSET_CATEGORIES.IMAGES)) {
      return null;
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const metadata = await sharp(buffer).metadata();

    if (metadata.width && metadata.height) {
      return {
        width: metadata.width,
        height: metadata.height,
      };
    }

    return null;
  } catch (error) {
    console.error('Error extracting image dimensions:', error);
    return null;
  }
}

/**
 * Convert image to WebP format using sharp
 * @param file - Original image file
 * @returns Converted file data and metadata, or null if not an image or conversion fails
 */
async function convertImageToWebP(file: File): Promise<{
  buffer: Buffer;
  mimeType: string;
  fileExtension: string;
  width: number;
  height: number;
} | null> {
  try {
    // Only convert raster images (skip SVG, GIF with animations, etc.)
    if (!isAssetOfType(file.type, ASSET_CATEGORIES.IMAGES) ||
        file.type === 'image/svg+xml' ||
        file.type === 'image/gif') {
      return null;
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Convert to WebP with quality 85
    const webpBuffer = await sharp(buffer)
      .webp({ quality: 85 })
      .toBuffer();

    // Get dimensions from the converted image
    const metadata = await sharp(webpBuffer).metadata();

    return {
      buffer: webpBuffer,
      mimeType: 'image/webp',
      fileExtension: 'webp',
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  } catch (error) {
    console.error('Error converting image to WebP:', error);
    return null;
  }
}

/**
 * Upload a file to Supabase Storage and create Asset record
 * Automatically converts raster images to WebP format for better performance
 *
 * @param file - File to upload
 * @param source - Source identifier (e.g., 'library', 'page-settings', 'components')
 * @param customName - Optional custom name for the file
 * @param assetFolderId - Optional asset folder ID to organize the asset
 * @returns Asset with metadata or null if upload fails
 */
export async function uploadFile(
  file: File,
  source: string,
  customName?: string,
  assetFolderId?: string | null
): Promise<Asset | null> {
  try {
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const filename = customName || baseName || file.name;

    // Handle SVG files - store content directly without uploading to storage
    if (file.type === 'image/svg+xml') {
      const svgText = await file.text();
      const cleanedContent = cleanSvgContent(svgText);

      // Try to extract dimensions from SVG if possible
      let dimensions: { width: number; height: number } | null = null;
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const metadata = await sharp(buffer).metadata();
        if (metadata.width && metadata.height) {
          dimensions = {
            width: metadata.width,
            height: metadata.height,
          };
        }
      } catch {
        // SVG dimension extraction is best-effort
      }

      // Create asset with inline SVG content
      const asset = await createAsset({
        filename,
        storage_path: null,
        public_url: null,
        file_size: cleanedContent.length,
        mime_type: 'image/svg+xml',
        width: dimensions?.width,
        height: dimensions?.height,
        source,
        asset_folder_id: assetFolderId,
        content: cleanedContent,
      });

      return asset;
    }

    // For non-SVG files, proceed with storage upload
    const supabase = await getSupabaseAdmin();

    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);

    // Try to convert image to WebP
    const webpConversion = await convertImageToWebP(file);

    let fileToUpload: File | Buffer;
    let fileExtension: string;
    let mimeType: string;
    let fileSize: number;
    let dimensions: { width: number; height: number } | null = null;

    if (webpConversion) {
      // Use converted WebP image
      fileToUpload = webpConversion.buffer;
      fileExtension = webpConversion.fileExtension;
      mimeType = webpConversion.mimeType;
      fileSize = webpConversion.buffer.length;
      dimensions = {
        width: webpConversion.width,
        height: webpConversion.height,
      };
    } else {
      // Use original file
      fileToUpload = file;
      fileExtension = file.name.split('.').pop() || '';
      mimeType = file.type;
      fileSize = file.size;
      // Get dimensions for non-converted images
      dimensions = await getImageDimensions(file);
    }

    const storagePath = `${timestamp}-${random}.${fileExtension}`;

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType: mimeType,
      });

    if (error) {
      console.error('Error uploading file:', error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    const asset = await createAsset({
      filename,
      storage_path: data.path,
      public_url: urlData.publicUrl,
      file_size: fileSize,
      mime_type: mimeType,
      width: dimensions?.width,
      height: dimensions?.height,
      source,
      asset_folder_id: assetFolderId,
    });

    return asset;
  } catch (error) {
    console.error('Error in uploadFile:', error);
    return null;
  }
}

/**
 * Delete an asset (from both storage and database)
 * @deprecated Use deleteAsset from '@/lib/repositories/assetRepository' instead.
 * This function does not support the draft/published workflow.
 *
 * @param assetId - Asset ID to delete
 * @returns True if successful, false otherwise
 */
export async function deleteAsset(assetId: string): Promise<boolean> {
  try {
    const supabase = await getSupabaseAdmin();

    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const { data: asset, error: fetchError } = await supabase
      .from('assets')
      .select('storage_path')
      .eq('id', assetId)
      .single();

    if (fetchError || !asset) {
      console.error('Error fetching asset:', fetchError);
      return false;
    }

    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([asset.storage_path]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
      return false;
    }

    const { error: dbError } = await supabase
      .from('assets')
      .delete()
      .eq('id', assetId);

    if (dbError) {
      console.error('Error deleting asset from database:', dbError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteAsset:', error);
    return false;
  }
}
