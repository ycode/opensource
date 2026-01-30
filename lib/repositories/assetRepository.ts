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

export interface PaginatedAssetsResult {
  assets: Asset[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface GetAssetsOptions {
  folderId?: string | null; // Filter by folder (null = root, undefined = all)
  folderIds?: string[]; // Filter by multiple folders (for search across descendants)
  search?: string; // Search by filename
  page?: number; // Page number (1-based)
  limit?: number; // Items per page
}

/**
 * Get assets with pagination and search support
 */
export async function getAssetsPaginated(options: GetAssetsOptions = {}): Promise<PaginatedAssetsResult> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const {
    folderId,
    folderIds,
    search,
    page = 1,
    limit = 50,
  } = options;

  const offset = (page - 1) * limit;

  // Build the query
  let query = client
    .from('assets')
    .select('*', { count: 'exact' });

  // Filter by folder(s)
  if (folderIds && folderIds.length > 0) {
    // Multiple folders (for search across descendants)
    // Handle 'root' specially - it means assets with null folder_id
    const actualFolderIds = folderIds.filter(id => id !== 'root');
    const includesRoot = folderIds.includes('root');
    
    if (includesRoot && actualFolderIds.length > 0) {
      // Include both root (null) and specific folders
      query = query.or(`asset_folder_id.is.null,asset_folder_id.in.(${actualFolderIds.join(',')})`);
    } else if (includesRoot) {
      // Only root
      query = query.is('asset_folder_id', null);
    } else {
      // Only specific folders
      query = query.in('asset_folder_id', actualFolderIds);
    }
  } else if (folderId !== undefined) {
    // Single folder filter
    if (folderId === null) {
      query = query.is('asset_folder_id', null);
    } else {
      query = query.eq('asset_folder_id', folderId);
    }
  }

  // Search by filename
  if (search && search.trim()) {
    query = query.ilike('filename', `%${search.trim()}%`);
  }

  // Apply pagination and ordering
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to fetch assets: ${error.message}`);
  }

  const total = count || 0;

  return {
    assets: data || [],
    total,
    page,
    limit,
    hasMore: offset + limit < total,
  };
}

/**
 * Get all assets (legacy function for backwards compatibility)
 * @param folderId - Optional folder ID to filter assets (null for root folder, undefined for all assets)
 * @deprecated Use getAssetsPaginated for better performance with large datasets
 */
export async function getAllAssets(folderId?: string | null): Promise<Asset[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Supabase has a default limit of 1000 rows, so we need to paginate for large datasets
  const PAGE_SIZE = 1000;
  const allAssets: Asset[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = client
      .from('assets')
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1)
      .order('created_at', { ascending: false });

    // Filter by folder if specified
    if (folderId !== undefined) {
      if (folderId === null) {
        query = query.is('asset_folder_id', null);
      } else {
        query = query.eq('asset_folder_id', folderId);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch assets: ${error.message}`);
    }

    if (data && data.length > 0) {
      allAssets.push(...data);
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allAssets;
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
 * Get multiple assets by IDs in a single query
 * Returns a map of asset ID to asset for quick lookup
 */
export async function getAssetsByIds(ids: string[]): Promise<Record<string, Asset>> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  if (ids.length === 0) {
    return {};
  }

  const { data, error } = await client
    .from('assets')
    .select('*')
    .in('id', ids);

  if (error) {
    throw new Error(`Failed to fetch assets: ${error.message}`);
  }

  // Convert array to map for O(1) lookup
  const assetMap: Record<string, Asset> = {};
  data?.forEach(asset => {
    assetMap[asset.id] = asset;
  });

  return assetMap;
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
 * Bulk delete assets
 */
export async function bulkDeleteAssets(ids: string[]): Promise<{ success: string[]; failed: string[] }> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  if (ids.length === 0) {
    return { success: [], failed: [] };
  }

  const success: string[] = [];
  const failed: string[] = [];

  // Get all assets to find storage paths
  const { data: assets, error: fetchError } = await client
    .from('assets')
    .select('*')
    .in('id', ids);

  if (fetchError) {
    throw new Error(`Failed to fetch assets: ${fetchError.message}`);
  }

  // Collect storage paths for batch deletion
  const storagePaths = assets
    ?.filter(asset => asset.storage_path)
    .map(asset => asset.storage_path as string) || [];

  // Delete from storage in batch (if there are files to delete)
  if (storagePaths.length > 0) {
    const { error: storageError } = await client.storage
      .from('assets')
      .remove(storagePaths);

    if (storageError) {
      console.error('Failed to delete some files from storage:', storageError);
      // Continue with database deletion even if storage deletion fails
    }
  }

  // Delete database records in batch
  const { error: deleteError } = await client
    .from('assets')
    .delete()
    .in('id', ids);

  if (deleteError) {
    throw new Error(`Failed to delete asset records: ${deleteError.message}`);
  }

  // All succeeded if we got here
  return { success: ids, failed: [] };
}

/**
 * Bulk update assets (move to folder)
 */
export async function bulkUpdateAssets(
  ids: string[],
  updates: UpdateAssetData
): Promise<{ success: string[]; failed: string[] }> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  if (ids.length === 0) {
    return { success: [], failed: [] };
  }

  // Update all assets in batch
  const { error } = await client
    .from('assets')
    .update(updates)
    .in('id', ids);

  if (error) {
    throw new Error(`Failed to update assets: ${error.message}`);
  }

  // All succeeded if we got here
  return { success: ids, failed: [] };
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
