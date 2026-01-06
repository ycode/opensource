/**
 * Asset Folder Repository
 *
 * Data access layer for asset folder operations with Supabase
 */

import { getSupabaseAdmin } from '../supabase-server';
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

  console.log(`[deleteAssetFolder] Deleting folder ${id} and ${descendantFolderIds.length} descendant folders`);

  // Soft-delete all assets within these folders
  const { error: assetsError } = await client
    .from('assets')
    .delete()
    .in('asset_folder_id', allFolderIds);

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

  console.log(`[deleteAssetFolder] Successfully deleted folder ${id} and its contents`);
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
