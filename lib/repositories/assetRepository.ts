import { getSupabaseAdmin } from '../supabase-server';
import type { Asset } from '../../types';

export interface CreateAssetData {
  filename: string;
  source: string; // Required: identifies where the asset was uploaded from (e.g., 'library', 'page-settings', 'components')
  storage_path?: string | null; // Nullable for SVG icons with inline content
  public_url?: string | null; // Nullable for SVG icons with inline content
  file_size: number;
  mime_type: string;
  width?: number;
  height?: number;
  asset_folder_id?: string | null;
  content?: string | null; // Inline SVG content for icon assets
}

/**
 * Get all assets
 * @param folderId - Optional folder ID to filter assets (null for root folder, undefined for all assets)
 */
export async function getAllAssets(folderId?: string | null): Promise<Asset[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  let query = client
    .from('assets')
    .select('*');

  // Filter by folder if specified
  if (folderId !== undefined) {
    if (folderId === null) {
      query = query.is('asset_folder_id', null);
    } else {
      query = query.eq('asset_folder_id', folderId);
    }
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch assets: ${error.message}`);
  }

  return data || [];
}

/**
 * Get asset by ID
 */
export async function getAssetById(id: string): Promise<Asset | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('assets')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch asset: ${error.message}`);
  }

  return data;
}

/**
 * Create asset record
 */
export async function createAsset(assetData: CreateAssetData): Promise<Asset> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('assets')
    .insert(assetData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create asset: ${error.message}`);
  }

  return data;
}

/**
 * Update asset
 */
export interface UpdateAssetData {
  filename?: string;
  asset_folder_id?: string | null;
  content?: string | null; // Allow updating SVG content
}

export async function updateAsset(id: string, assetData: UpdateAssetData): Promise<Asset> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('assets')
    .update(assetData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update asset: ${error.message}`);
  }

  return data;
}

/**
 * Delete asset
 */
export async function deleteAsset(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Get asset to find storage path
  const asset = await getAssetById(id);

  if (!asset) {
    throw new Error('Asset not found');
  }

  // Delete from storage (only if it has a storage path - SVG icons with inline content don't)
  if (asset.storage_path) {
    const { error: storageError } = await client.storage
      .from('assets')
      .remove([asset.storage_path]);

    if (storageError) {
      throw new Error(`Failed to delete file: ${storageError.message}`);
    }
  }

  // Delete database record
  const { error } = await client
    .from('assets')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete asset record: ${error.message}`);
  }
}

/**
 * Sanitize filename for storage
 * Removes spaces and special characters that might cause issues
 */
function sanitizeFilename(filename: string): string {
  // Get file extension
  const lastDot = filename.lastIndexOf('.');
  const name = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.substring(lastDot) : '';

  // Replace spaces with hyphens and remove special characters
  const sanitized = name
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-zA-Z0-9-_]/g, '') // Remove special characters
    .toLowerCase(); // Convert to lowercase

  return sanitized + ext.toLowerCase();
}

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(file: File): Promise<{ path: string; url: string }> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Sanitize filename to remove spaces and special characters
  const sanitizedName = sanitizeFilename(file.name);
  const filename = `${Date.now()}-${sanitizedName}`;

  const { data, error } = await client.storage
    .from('assets')
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  const { data: urlData } = client.storage
    .from('assets')
    .getPublicUrl(data.path);

  return {
    path: data.path,
    url: urlData.publicUrl,
  };
}
