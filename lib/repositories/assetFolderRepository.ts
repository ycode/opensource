/**
 * Asset Folder Repository
 *
 * Data access layer for asset folder operations with Supabase
 */

import { getSupabaseAdmin } from '../supabase-server';
import { SUPABASE_QUERY_LIMIT, SUPABASE_WRITE_BATCH_SIZE } from '../supabase/constants';
import type { AssetFolder, CreateAssetFolderData, UpdateAssetFolderData } from '../../types';

/**
 * Get all asset folders (drafts by default)
 * @param isPublished - Filter by published status (default: false for drafts)
 */
export async function getAllAssetFolders(isPublished = false): Promise<AssetFolder[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('asset_folders')
    .select('*')
    .eq('is_published', isPublished)
    .is('deleted_at', null)
    .order('order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch asset folders: ${error.message}`);
  }

  return data || [];
}

/**
 * Get asset folder by ID (draft by default)
 * @param id - Folder ID
 * @param isPublished - Get published or draft version (default: false for draft)
 */
export async function getAssetFolderById(id: string, isPublished = false): Promise<AssetFolder | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('asset_folders')
    .select('*')
    .eq('id', id)
    .eq('is_published', isPublished)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch asset folder: ${error.message}`);
  }

  return data;
}

/**
 * Get all child folders of a parent folder
 * @param parentId - Parent folder ID (null for root folders)
 * @param isPublished - Filter by published status (default: false for drafts)
 */
export async function getChildFolders(
  parentId: string | null,
  isPublished = false
): Promise<AssetFolder[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const query = client
    .from('asset_folders')
    .select('*')
    .eq('is_published', isPublished)
    .is('deleted_at', null);

  // Handle null vs non-null parent_id
  const finalQuery = parentId === null
    ? query.is('asset_folder_id', null)
    : query.eq('asset_folder_id', parentId);

  const { data, error } = await finalQuery.order('order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch child folders: ${error.message}`);
  }

  return data || [];
}

/**
 * Create new asset folder
 */
export async function createAssetFolder(folderData: CreateAssetFolderData): Promise<AssetFolder> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Ensure is_published defaults to false for drafts
  const dataToInsert = {
    ...folderData,
    is_published: folderData.is_published ?? false,
  };

  const { data, error } = await client
    .from('asset_folders')
    .insert(dataToInsert)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create asset folder: ${error.message}`);
  }

  return data;
}

/**
 * Update asset folder (drafts only)
 */
export async function updateAssetFolder(id: string, updates: UpdateAssetFolderData): Promise<AssetFolder> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('asset_folders')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('is_published', false)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update asset folder: ${error.message}`);
  }

  return data;
}

/**
 * Get all descendant folder IDs recursively (drafts only)
 */
async function getDescendantFolderIds(folderId: string): Promise<string[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Fetch all non-deleted draft folders once
  const { data: allFolders, error } = await client
    .from('asset_folders')
    .select('id, asset_folder_id')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch folders: ${error.message}`);
  }

  if (!allFolders || allFolders.length === 0) {
    return [];
  }

  // Build a map for quick lookup
  const foldersByParent = new Map<string, string[]>();
  for (const folder of allFolders) {
    const parentId = folder.asset_folder_id || 'root';
    if (!foldersByParent.has(parentId)) {
      foldersByParent.set(parentId, []);
    }
    foldersByParent.get(parentId)!.push(folder.id);
  }

  // Recursively collect all descendant IDs
  const collectDescendants = (parentId: string): string[] => {
    const children = foldersByParent.get(parentId) || [];
    const descendants: string[] = [...children];

    for (const childId of children) {
      descendants.push(...collectDescendants(childId));
    }

    return descendants;
  };

  return collectDescendants(folderId);
}

/**
 * Soft delete an asset folder and all its nested assets and folders (drafts only)
 */
export async function deleteAssetFolder(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const deletedAt = new Date().toISOString();

  // Get the draft folder before deletion
  const folderToDelete = await getAssetFolderById(id, false);
  if (!folderToDelete) {
    throw new Error('Folder not found');
  }

  // Get all descendant folder IDs
  const descendantFolderIds = await getDescendantFolderIds(id);
  const allFolderIds = [id, ...descendantFolderIds];

  // Soft-delete all draft assets within these folders
  const { error: assetsError } = await client
    .from('assets')
    .update({ deleted_at: new Date().toISOString() })
    .in('asset_folder_id', allFolderIds)
    .eq('is_published', false)
    .is('deleted_at', null);

  if (assetsError) {
    throw new Error(`Failed to delete assets in folder: ${assetsError.message}`);
  }

  // Soft-delete all draft folders
  const { error: foldersError } = await client
    .from('asset_folders')
    .update({ deleted_at: deletedAt })
    .in('id', allFolderIds)
    .eq('is_published', false)
    .is('deleted_at', null);

  if (foldersError) {
    throw new Error(`Failed to delete folders: ${foldersError.message}`);
  }
}

/**
 * Reorder folders within a parent (drafts only)
 */
export async function reorderFolders(updates: Array<{ id: string; order: number }>): Promise<void> {
  if (updates.length === 0) {
    return;
  }

  const { getKnexClient } = await import('../knex-client');
  const knex = await getKnexClient();

  // Batch update using CASE statement for efficiency (drafts only)
  const caseStatements = updates.map(() => 'WHEN id = ? THEN ?::integer').join(' ');
  const values = updates.flatMap(u => [u.id, u.order]);
  const idPlaceholders = updates.map(() => '?').join(', ');

  await knex.raw(`
    UPDATE asset_folders
    SET "order" = CASE ${caseStatements} END,
        updated_at = NOW()
    WHERE id IN (${idPlaceholders})
      AND is_published = false
      AND deleted_at IS NULL
  `, [...values, ...updates.map(u => u.id)]);
}

// =============================================================================
// Publishing Functions
// =============================================================================

/**
 * Get all unpublished (draft) asset folders
 */
export async function getUnpublishedAssetFolders(): Promise<AssetFolder[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('asset_folders')
    .select('*')
    .eq('is_published', false)
    .is('deleted_at', null)
    .order('depth', { ascending: true }) // Parents first
    .order('order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch unpublished asset folders: ${error.message}`);
  }

  return data || [];
}

/**
 * Get soft-deleted draft asset folders
 */
export async function getDeletedDraftAssetFolders(): Promise<AssetFolder[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const allFolders: AssetFolder[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client
      .from('asset_folders')
      .select('*')
      .eq('is_published', false)
      .not('deleted_at', 'is', null)
      .range(offset, offset + SUPABASE_QUERY_LIMIT - 1);

    if (error) {
      throw new Error(`Failed to fetch deleted draft asset folders: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    allFolders.push(...data);

    if (data.length < SUPABASE_QUERY_LIMIT) break;
    offset += SUPABASE_QUERY_LIMIT;
  }

  return allFolders;
}

/** Check if a draft asset folder differs from its published version */
function hasAssetFolderChanged(draft: AssetFolder, published: AssetFolder): boolean {
  return (
    draft.name !== published.name ||
    draft.asset_folder_id !== published.asset_folder_id ||
    draft.depth !== published.depth ||
    draft.order !== published.order
  );
}

/**
 * Publish asset folders - copies draft to published, skipping unchanged folders
 */
export async function publishAssetFolders(folderIds: string[]): Promise<{ count: number }> {
  if (folderIds.length === 0) {
    return { count: 0 };
  }

  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const draftFolders: AssetFolder[] = [];

  // Fetch draft folders in batches
  for (let i = 0; i < folderIds.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batchIds = folderIds.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
    const { data, error: fetchError } = await client
      .from('asset_folders')
      .select('*')
      .in('id', batchIds)
      .eq('is_published', false)
      .is('deleted_at', null);

    if (fetchError) {
      throw new Error(`Failed to fetch draft asset folders: ${fetchError.message}`);
    }

    if (data) {
      draftFolders.push(...data);
    }
  }

  if (draftFolders.length === 0) {
    return { count: 0 };
  }

  // Sort by depth to ensure parents are published before children
  draftFolders.sort((a, b) => a.depth - b.depth);

  // Fetch existing published versions (full data for comparison)
  const publishedById = new Map<string, AssetFolder>();
  for (let i = 0; i < folderIds.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batchIds = folderIds.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
    const { data: existingPublished } = await client
      .from('asset_folders')
      .select('*')
      .in('id', batchIds)
      .eq('is_published', true);

    existingPublished?.forEach(f => publishedById.set(f.id, f));
  }

  // Only publish folders that are new or changed
  const recordsToUpsert: any[] = [];
  const now = new Date().toISOString();

  for (const draft of draftFolders) {
    const existing = publishedById.get(draft.id);

    // Skip if published version exists and is identical
    if (existing && !hasAssetFolderChanged(draft, existing)) {
      continue;
    }

    recordsToUpsert.push({
      id: draft.id,
      name: draft.name,
      asset_folder_id: draft.asset_folder_id,
      depth: draft.depth,
      order: draft.order,
      is_published: true,
      created_at: draft.created_at,
      updated_at: now,
      deleted_at: null,
    });
  }

  // Keep sorted by depth to ensure parents are processed first
  recordsToUpsert.sort((a: any, b: any) => a.depth - b.depth);

  if (recordsToUpsert.length > 0) {
    for (let i = 0; i < recordsToUpsert.length; i += SUPABASE_WRITE_BATCH_SIZE) {
      const batch = recordsToUpsert.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
      const { error: upsertError } = await client
        .from('asset_folders')
        .upsert(batch, {
          onConflict: 'id,is_published',
        });

      if (upsertError) {
        throw new Error(`Failed to publish asset folders: ${upsertError.message}`);
      }
    }
  }

  return { count: recordsToUpsert.length };
}

/**
 * Hard delete asset folders that were soft-deleted in drafts
 */
export async function hardDeleteSoftDeletedAssetFolders(): Promise<{ count: number }> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Get all soft-deleted draft folders
  const deletedDrafts = await getDeletedDraftAssetFolders();

  if (deletedDrafts.length === 0) {
    return { count: 0 };
  }

  const ids = deletedDrafts.map(f => f.id);

  // Clear FK references before deleting to avoid composite FK ON DELETE SET NULL
  // nullifying both asset_folder_id AND is_published (violating NOT NULL constraint)
  for (let i = 0; i < ids.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batchIds = ids.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);

    // Clear asset_folder_id on assets referencing these folders
    await client
      .from('assets')
      .update({ asset_folder_id: null })
      .in('asset_folder_id', batchIds)
      .eq('is_published', true);

    await client
      .from('assets')
      .update({ asset_folder_id: null })
      .in('asset_folder_id', batchIds)
      .eq('is_published', false);

    // Clear parent references on child asset_folders
    await client
      .from('asset_folders')
      .update({ asset_folder_id: null })
      .in('asset_folder_id', batchIds)
      .eq('is_published', true);

    await client
      .from('asset_folders')
      .update({ asset_folder_id: null })
      .in('asset_folder_id', batchIds)
      .eq('is_published', false);
  }

  // Delete published and draft versions in batches
  for (let i = 0; i < ids.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batchIds = ids.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);

    // Delete published versions
    const { error: deletePublishedError } = await client
      .from('asset_folders')
      .delete()
      .in('id', batchIds)
      .eq('is_published', true);

    if (deletePublishedError) {
      console.error('Failed to delete published asset folders:', deletePublishedError);
    }

    // Delete soft-deleted draft versions
    const { error: deleteDraftError } = await client
      .from('asset_folders')
      .delete()
      .in('id', batchIds)
      .eq('is_published', false)
      .not('deleted_at', 'is', null);

    if (deleteDraftError) {
      throw new Error(`Failed to delete draft asset folders: ${deleteDraftError.message}`);
    }
  }

  return { count: deletedDrafts.length };
}
