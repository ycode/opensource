/**
 * File upload utilities for Supabase Storage
 * Creates Asset records in database for uploaded files
 */

import { getSupabaseAdmin } from './supabase-server';
import { createAsset } from './repositories/assetRepository';
import { isAssetOfType, ASSET_CATEGORIES } from './asset-utils';
import sharp from 'sharp';
import type { Asset } from '@/types';

const STORAGE_BUCKET = 'assets';

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
 * Upload a file to Supabase Storage and create Asset record
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
    const supabase = await getSupabaseAdmin();

    if (!supabase) {
      throw new Error('Supabase client not available');
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const fileExtension = file.name.split('.').pop();
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const storagePath = `${timestamp}-${random}.${fileExtension}`;
    const filename = customName || baseName || file.name;

    const dimensions = await getImageDimensions(file);

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
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
      file_size: file.size,
      mime_type: file.type,
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
