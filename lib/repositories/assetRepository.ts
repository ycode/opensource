import { getSupabaseAdmin } from '@/lib/supabase-server';
import { SUPABASE_QUERY_LIMIT, SUPABASE_WRITE_BATCH_SIZE } from '@/lib/supabase-constants';
import { generateAssetContentHash } from '../hash-utils';
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
  is_published?: boolean; // Defaults to false
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
 * Get assets with pagination and search support (drafts only)
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

  // Build the query - always filter by is_published=false and deleted_at IS NULL
  let query = client
    .from('assets')
    .select('*', { count: 'exact' })
    .eq('is_published', false)
    .is('deleted_at', null);

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
 * Get all draft assets (legacy function for backwards compatibility)
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
      .eq('is_published', false)
      .is('deleted_at', null)
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
 * @param id Asset ID
 * @param isPublished If true, get published version; if false, get draft version (default: false)
 */
export async function getAssetById(id: string, isPublished: boolean = false): Promise<Asset | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  let query = client
    .from('assets')
    .select('*')
    .eq('id', id)
    .eq('is_published', isPublished);

  // Only filter deleted_at for drafts
  if (!isPublished) {
    query = query.is('deleted_at', null);
  }

  const { data, error } = await query.single();

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
 * @param isPublished If true, get published versions; if false, get draft versions (default: false)
 */
export async function getAssetsByIds(ids: string[], isPublished: boolean = false): Promise<Record<string, Asset>> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  if (ids.length === 0) {
    return {};
  }

  let query = client
    .from('assets')
    .select('*')
    .eq('is_published', isPublished)
    .in('id', ids);

  // Only filter deleted_at for drafts
  if (!isPublished) {
    query = query.is('deleted_at', null);
  }

  const { data, error } = await query;

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
 * Create asset record (always creates as draft)
 */
export async function createAsset(assetData: CreateAssetData): Promise<Asset> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const now = new Date().toISOString();
  const content_hash = generateAssetContentHash({
    filename: assetData.filename,
    storage_path: assetData.storage_path ?? null,
    public_url: assetData.public_url ?? null,
    file_size: assetData.file_size,
    mime_type: assetData.mime_type,
    width: assetData.width ?? null,
    height: assetData.height ?? null,
    asset_folder_id: assetData.asset_folder_id ?? null,
    content: assetData.content ?? null,
    source: assetData.source,
  });

  const { data, error } = await client
    .from('assets')
    .insert({
      ...assetData,
      content_hash,
      is_published: false,
      updated_at: now,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create asset: ${error.message}`);
  }

  return data;
}

/**
 * Update asset (only updates drafts)
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

  // Update the asset fields first, then recompute hash from the full record
  const { data, error } = await client
    .from('assets')
    .update({
      ...assetData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('is_published', false)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update asset: ${error.message}`);
  }

  // Recompute content_hash from the full updated record
  const content_hash = generateAssetContentHash({
    filename: data.filename,
    storage_path: data.storage_path,
    public_url: data.public_url,
    file_size: data.file_size,
    mime_type: data.mime_type,
    width: data.width,
    height: data.height,
    asset_folder_id: data.asset_folder_id,
    content: data.content,
    source: data.source,
  });

  const { data: updated, error: hashError } = await client
    .from('assets')
    .update({ content_hash })
    .eq('id', id)
    .eq('is_published', false)
    .select()
    .single();

  if (hashError) {
    throw new Error(`Failed to update asset hash: ${hashError.message}`);
  }

  return updated;
}

/**
 * Soft-delete asset (sets deleted_at on draft)
 * If the asset was never published, also deletes the physical file
 */
export async function deleteAsset(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Get draft asset
  const draftAsset = await getAssetById(id, false);

  if (!draftAsset) {
    throw new Error('Asset not found');
  }

  // Check if a published version exists
  const publishedAsset = await getAssetById(id, true);

  // If never published, delete the physical file immediately
  if (!publishedAsset && draftAsset.storage_path) {
    const { error: storageError } = await client.storage
      .from('assets')
      .remove([draftAsset.storage_path]);

    if (storageError) {
      console.error(`Failed to delete file from storage: ${storageError.message}`);
      // Continue with soft-delete even if storage deletion fails
    }
  }

  // Soft-delete the draft record
  const { error } = await client
    .from('assets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_published', false)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to delete asset record: ${error.message}`);
  }
}

/**
 * Bulk soft-delete assets
 * If assets were never published, also deletes their physical files
 */
export async function bulkDeleteAssets(ids: string[]): Promise<{ success: string[]; failed: string[] }> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  if (ids.length === 0) {
    return { success: [], failed: [] };
  }

  const draftAssets: Asset[] = [];

  // Get all draft assets in batches
  for (let i = 0; i < ids.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batchIds = ids.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
    const { data, error: fetchDraftError } = await client
      .from('assets')
      .select('*')
      .in('id', batchIds)
      .eq('is_published', false)
      .is('deleted_at', null);

    if (fetchDraftError) {
      throw new Error(`Failed to fetch draft assets: ${fetchDraftError.message}`);
    }

    if (data) {
      draftAssets.push(...data);
    }
  }

  // Get published assets to check which files should be deleted immediately
  const publishedIds = new Set<string>();
  for (let i = 0; i < ids.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batchIds = ids.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
    const { data: publishedAssets, error: fetchPublishedError } = await client
      .from('assets')
      .select('id')
      .in('id', batchIds)
      .eq('is_published', true);

    if (fetchPublishedError) {
      throw new Error(`Failed to fetch published assets: ${fetchPublishedError.message}`);
    }

    publishedAssets?.forEach(a => publishedIds.add(a.id));
  }

  // Collect storage paths for assets that were never published
  const storagePaths = draftAssets
    .filter(asset => asset.storage_path && !publishedIds.has(asset.id))
    .map(asset => asset.storage_path as string);

  // Delete from storage for assets that were never published (in batches)
  if (storagePaths.length > 0) {
    for (let i = 0; i < storagePaths.length; i += SUPABASE_WRITE_BATCH_SIZE) {
      const batch = storagePaths.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
      const { error: storageError } = await client.storage
        .from('assets')
        .remove(batch);

      if (storageError) {
        console.error('Failed to delete some files from storage:', storageError);
        // Continue with soft-delete even if storage deletion fails
      }
    }
  }

  // Soft-delete all draft records in batches
  for (let i = 0; i < ids.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batchIds = ids.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
    const { error: deleteError } = await client
      .from('assets')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', batchIds)
      .eq('is_published', false)
      .is('deleted_at', null);

    if (deleteError) {
      throw new Error(`Failed to delete asset records: ${deleteError.message}`);
    }
  }

  // All succeeded if we got here
  return { success: ids, failed: [] };
}

/**
 * Bulk update assets (move to folder) - only updates drafts
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

  const now = new Date().toISOString();

  // Update fields, then recompute hashes from the full records
  for (let i = 0; i < ids.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batchIds = ids.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);

    // Apply the field updates
    const { error } = await client
      .from('assets')
      .update({
        ...updates,
        updated_at: now,
      })
      .in('id', batchIds)
      .eq('is_published', false)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to update assets: ${error.message}`);
    }

    // Fetch updated records and recompute hashes
    const { data: updatedAssets } = await client
      .from('assets')
      .select('*')
      .in('id', batchIds)
      .eq('is_published', false)
      .is('deleted_at', null);

    if (updatedAssets && updatedAssets.length > 0) {
      const hashRecords = updatedAssets.map(a => ({
        id: a.id,
        is_published: false as const,
        content_hash: generateAssetContentHash({
          filename: a.filename,
          storage_path: a.storage_path,
          public_url: a.public_url,
          file_size: a.file_size,
          mime_type: a.mime_type,
          width: a.width,
          height: a.height,
          asset_folder_id: a.asset_folder_id,
          content: a.content,
          source: a.source,
        }),
      }));

      await client
        .from('assets')
        .upsert(hashRecords, { onConflict: 'id,is_published' });
    }
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

// =============================================================================
// Publishing Functions
// =============================================================================

/**
 * Get all unpublished (draft) assets that have changes
 * Uses pagination to handle more than 1000 assets (Supabase default limit)
 */
export async function getUnpublishedAssets(): Promise<Asset[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const allAssets: Asset[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await client
      .from('assets')
      .select('*')
      .eq('is_published', false)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + SUPABASE_QUERY_LIMIT - 1);

    if (error) {
      throw new Error(`Failed to fetch unpublished assets: ${error.message}`);
    }

    if (data && data.length > 0) {
      allAssets.push(...data);
      offset += data.length;
      hasMore = data.length === SUPABASE_QUERY_LIMIT;
    } else {
      hasMore = false;
    }
  }

  return allAssets;
}

/**
 * Get soft-deleted draft assets that need their published versions and files removed
 */
export async function getDeletedDraftAssets(): Promise<Asset[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const allAssets: Asset[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from('assets')
      .select('*')
      .eq('is_published', false)
      .not('deleted_at', 'is', null)
      .range(offset, offset + SUPABASE_QUERY_LIMIT - 1);

    if (error) {
      throw new Error(`Failed to fetch deleted draft assets: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    allAssets.push(...data);

    if (data.length < SUPABASE_QUERY_LIMIT) break;
    offset += SUPABASE_QUERY_LIMIT;
  }

  return allAssets;
}

/**
 * Publish assets - copies draft to published, using content_hash for change detection
 */
export async function publishAssets(assetIds: string[]): Promise<{ count: number }> {
  if (assetIds.length === 0) {
    return { count: 0 };
  }

  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Fetch draft assets in batches
  const draftAssets: Asset[] = [];
  for (let i = 0; i < assetIds.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batchIds = assetIds.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
    const { data, error: fetchError } = await client
      .from('assets')
      .select('*')
      .in('id', batchIds)
      .eq('is_published', false)
      .is('deleted_at', null);

    if (fetchError) {
      throw new Error(`Failed to fetch draft assets: ${fetchError.message}`);
    }

    if (data) {
      draftAssets.push(...data);
    }
  }

  if (draftAssets.length === 0) {
    return { count: 0 };
  }

  // Fetch existing published content_hash values only (lightweight query)
  const publishedHashById = new Map<string, string | null>();
  for (let i = 0; i < assetIds.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batchIds = assetIds.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
    const { data: existingPublished } = await client
      .from('assets')
      .select('id, content_hash')
      .in('id', batchIds)
      .eq('is_published', true);

    existingPublished?.forEach(a => publishedHashById.set(a.id, a.content_hash));
  }

  // Only publish assets that are new or changed (compare draft hash vs published hash)
  const recordsToUpsert: any[] = [];
  const now = new Date().toISOString();

  for (const draft of draftAssets) {
    // Skip if published version exists with identical hash (including both null)
    if (publishedHashById.has(draft.id) && draft.content_hash === publishedHashById.get(draft.id)) {
      continue;
    }

    recordsToUpsert.push({
      id: draft.id,
      source: draft.source,
      filename: draft.filename,
      storage_path: draft.storage_path,
      public_url: draft.public_url,
      file_size: draft.file_size,
      mime_type: draft.mime_type,
      width: draft.width,
      height: draft.height,
      asset_folder_id: draft.asset_folder_id,
      content: draft.content,
      content_hash: draft.content_hash,
      is_published: true,
      created_at: draft.created_at,
      updated_at: now,
      deleted_at: null,
    });
  }

  if (recordsToUpsert.length > 0) {
    for (let i = 0; i < recordsToUpsert.length; i += SUPABASE_WRITE_BATCH_SIZE) {
      const batch = recordsToUpsert.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
      const { error: upsertError } = await client
        .from('assets')
        .upsert(batch, {
          onConflict: 'id,is_published',
        });

      if (upsertError) {
        throw new Error(`Failed to publish assets: ${upsertError.message}`);
      }
    }
  }

  return { count: recordsToUpsert.length };
}

/**
 * Hard delete assets that were soft-deleted in drafts
 * This removes:
 * 1. The published record (if exists)
 * 2. The physical file from storage
 * 3. The soft-deleted draft record
 */
export async function hardDeleteSoftDeletedAssets(): Promise<{ count: number }> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Get all soft-deleted draft assets
  const deletedDrafts = await getDeletedDraftAssets();

  if (deletedDrafts.length === 0) {
    return { count: 0 };
  }

  const ids = deletedDrafts.map(a => a.id);

  // Collect storage paths to delete
  const storagePaths = deletedDrafts
    .filter(a => a.storage_path)
    .map(a => a.storage_path as string);

  // Delete physical files from storage in batches
  if (storagePaths.length > 0) {
    for (let i = 0; i < storagePaths.length; i += SUPABASE_WRITE_BATCH_SIZE) {
      const batch = storagePaths.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
      const { error: storageError } = await client.storage
        .from('assets')
        .remove(batch);

      if (storageError) {
        console.error('Failed to delete some files from storage:', storageError);
        // Continue with database deletion
      }
    }
  }

  // Delete published and draft versions in batches
  for (let i = 0; i < ids.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batchIds = ids.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);

    // Delete published versions
    const { error: deletePublishedError } = await client
      .from('assets')
      .delete()
      .in('id', batchIds)
      .eq('is_published', true);

    if (deletePublishedError) {
      console.error('Failed to delete published assets:', deletePublishedError);
    }

    // Delete soft-deleted draft versions
    const { error: deleteDraftError } = await client
      .from('assets')
      .delete()
      .in('id', batchIds)
      .eq('is_published', false)
      .not('deleted_at', 'is', null);

    if (deleteDraftError) {
      throw new Error(`Failed to delete draft assets: ${deleteDraftError.message}`);
    }
  }

  return { count: deletedDrafts.length };
}
