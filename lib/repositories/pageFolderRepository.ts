/**
 * Page Folder Repository
 *
 * Data access layer for page folder operations with Supabase
 */

import { getSupabaseAdmin } from '../supabase-server';
import type { PageFolder } from '../../types';

/**
 * Query filters for page folder lookups
 */
export interface QueryFilters {
  [key: string]: string | number | boolean | null;
}

/**
 * Data required to create a new page folder
 */
export interface CreatePageFolderData {
  name: string;
  slug: string;
  depth?: number;
  order?: number;
  settings?: Record<string, any>;
  is_published?: boolean;
  page_folder_id?: string | null;
}

/**
 * Data that can be updated on an existing page folder
 */
export interface UpdatePageFolderData {
  name?: string;
  slug?: string;
  depth?: number;
  order?: number;
  settings?: Record<string, any>;
  is_published?: boolean;
  page_folder_id?: string | null;
}

/**
 * Retrieves all page folders from the database
 *
 * @param filters - Optional key-value filters to apply (e.g., { is_published: true })
 * @returns Promise resolving to array of page folders, ordered by order field (ascending)
 * @throws Error if Supabase query fails
 */
export async function getAllPageFolders(filters?: QueryFilters): Promise<PageFolder[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  let query = client
    .from('page_folders')
    .select('*')
    .is('deleted_at', null);

  // Apply filters if provided
  if (filters) {
    Object.entries(filters).forEach(([column, value]) => {
      query = query.eq(column, value);
    });
  }

  const { data, error } = await query.order('order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch page folders: ${error.message}`);
  }

  return data || [];
}

/**
 * Get page folder by ID
 */
export async function getPageFolderById(id: string): Promise<PageFolder | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('page_folders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch page folder: ${error.message}`);
  }

  return data;
}

/**
 * Get all child folders of a parent folder
 * @param parentId - Parent folder ID (null for root folders)
 * @param orderBy - Order by field ('order' for manual sorting, 'created_at' for chronological)
 */
export async function getChildFolders(
  parentId: string | null,
  orderBy: 'order' | 'created_at' = 'order'
): Promise<PageFolder[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const query = client
    .from('page_folders')
    .select('*')
    .is('deleted_at', null);

  // Handle null vs non-null parent_id
  const finalQuery = parentId === null
    ? query.is('page_folder_id', null)
    : query.eq('page_folder_id', parentId);

  const { data, error } = await finalQuery.order(orderBy, { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch child folders: ${error.message}`);
  }

  return data || [];
}

/**
 * Create new page folder
 */
export async function createPageFolder(folderData: CreatePageFolderData): Promise<PageFolder> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('page_folders')
    .insert(folderData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create page folder: ${error.message}`);
  }

  return data;
}

/**
 * Update page folder
 */
export async function updatePageFolder(id: string, updates: UpdatePageFolderData): Promise<PageFolder> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('page_folders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update page folder: ${error.message}`);
  }

  return data;
}

/**
 * Get all descendant folder IDs recursively
 * Fetches all folders once and traverses in memory for better performance
 *
 * This is the database-aware version that fetches folders from Supabase.
 * For in-memory operations, use the utility function from lib/pages.ts instead.
 *
 * @param folderId - Parent folder ID
 * @returns Array of all descendant folder IDs
 */
async function getDescendantFolderIdsFromDB(folderId: string): Promise<string[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Fetch all non-deleted folders once
  const { data: allFolders, error } = await client
    .from('page_folders')
    .select('id, page_folder_id')
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch folders: ${error.message}`);
  }

  if (!allFolders || allFolders.length === 0) {
    return [];
  }

  // Build a map for quick lookup: parentId -> childIds[]
  const foldersByParent = new Map<string, string[]>();
  for (const folder of allFolders) {
    const parentId = folder.page_folder_id || 'root';
    if (!foldersByParent.has(parentId)) {
      foldersByParent.set(parentId, []);
    }
    foldersByParent.get(parentId)!.push(folder.id);
  }

  // Recursively collect all descendant IDs using in-memory data
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
 * Batch update order for multiple folders
 * @param updates - Array of { id, order } objects
 */
export async function batchUpdateFolderOrder(updates: Array<{ id: string; order: number }>): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Update each folder's order
  const promises = updates.map(({ id, order }) =>
    client
      .from('page_folders')
      .update({ order })
      .eq('id', id)
      .is('deleted_at', null)
  );

  const results = await Promise.all(promises);

  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    throw new Error(`Failed to update folder order: ${errors[0].error?.message}`);
  }
}

/**
 * Reorder all siblings (both pages and folders) at the same parent level
 * This ensures pages and folders share continuous order values
 * @param parentId - Parent folder ID (null for root)
 * @param depth - Depth level of the siblings to reorder
 */
export async function reorderSiblings(parentId: string | null, depth: number): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Fetch sibling folders - filter by parent_id AND depth
  let foldersQuery = client
    .from('page_folders')
    .select('id, order')
    .eq('depth', depth)
    .is('deleted_at', null);

  if (parentId === null) {
    foldersQuery = foldersQuery.is('page_folder_id', null);
  } else {
    foldersQuery = foldersQuery.eq('page_folder_id', parentId);
  }

  const { data: siblingFolders, error: foldersError } = await foldersQuery.order('order', { ascending: true });

  if (foldersError) {
    throw new Error(`Failed to fetch sibling folders: ${foldersError.message}`);
  }

  // Fetch sibling pages - filter by parent_id AND depth
  let pagesQuery = client
    .from('pages')
    .select('id, order')
    .eq('depth', depth)
    .is('deleted_at', null);

  if (parentId === null) {
    pagesQuery = pagesQuery.is('page_folder_id', null);
  } else {
    pagesQuery = pagesQuery.eq('page_folder_id', parentId);
  }

  const { data: siblingPages, error: pagesError } = await pagesQuery.order('order', { ascending: true });

  if (pagesError) {
    throw new Error(`Failed to fetch sibling pages: ${pagesError.message}`);
  }

  // Combine and sort by current order
  const allSiblings = [
    ...(siblingFolders || []).map(f => ({ id: f.id, order: f.order ?? 0, type: 'folder' as const })),
    ...(siblingPages || []).map(p => ({ id: p.id, order: p.order ?? 0, type: 'page' as const })),
  ].sort((a, b) => a.order - b.order);

  // Update order for all siblings (continuous sequence: 0, 1, 2, ...)
  // Only update items whose order actually changed
  const folderUpdates: Array<{ id: string; order: number }> = [];
  const pageUpdates: Array<{ id: string; order: number }> = [];

  allSiblings.forEach((sibling, index) => {
    // Only update if order changed
    if (sibling.order !== index) {
      if (sibling.type === 'folder') {
        folderUpdates.push({ id: sibling.id, order: index });
      } else {
        pageUpdates.push({ id: sibling.id, order: index });
      }
    }
  });

  // Apply updates
  if (folderUpdates.length > 0) {
    const folderPromises = folderUpdates.map(({ id, order }) =>
      client
        .from('page_folders')
        .update({ order })
        .eq('id', id)
        .is('deleted_at', null)
    );

    const folderResults = await Promise.all(folderPromises);
    const folderErrors = folderResults.filter(r => r.error);
    if (folderErrors.length > 0) {
      throw new Error(`Failed to reorder folders: ${folderErrors[0].error?.message}`);
    }
  }

  if (pageUpdates.length > 0) {
    const pagePromises = pageUpdates.map(({ id, order }) =>
      client
        .from('pages')
        .update({ order })
        .eq('id', id)
        .is('deleted_at', null)
    );

    const pageResults = await Promise.all(pagePromises);
    const pageErrors = pageResults.filter(r => r.error);
    if (pageErrors.length > 0) {
      throw new Error(`Failed to reorder pages: ${pageErrors[0].error?.message}`);
    }
  }
}

/**
 * Soft delete a page folder and all its nested pages and folders
 * Sets deleted_at to current timestamp instead of hard deleting
 * Recursively deletes all child folders, pages, and their page_layers
 * After deletion, reorders remaining folders with the same parent_id
 */
export async function deletePageFolder(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const deletedAt = new Date().toISOString();

  // Get the folder before deletion to know its parent_id and depth
  const folderToDelete = await getPageFolderById(id);
  if (!folderToDelete) {
    throw new Error('Folder not found');
  }

  // Query 1: Get all descendant folder IDs from database
  const descendantFolderIds = await getDescendantFolderIdsFromDB(id);
  const allFolderIds = [id, ...descendantFolderIds];

  console.log(`[deletePageFolder] Deleting folder ${id} and ${descendantFolderIds.length} descendant folders`);

  // Query 2: Get all page IDs within these folders
  const { data: affectedPages, error: fetchPagesError } = await client
    .from('pages')
    .select('id')
    .in('page_folder_id', allFolderIds)
    .is('deleted_at', null);

  if (fetchPagesError) {
    throw new Error(`Failed to fetch pages in folder: ${fetchPagesError.message}`);
  }

  const affectedPageIds = affectedPages?.map(p => p.id) || [];

  // Query 3: Delete all page_layers for affected pages (if any)
  if (affectedPageIds.length > 0) {
    const { error: layersError } = await client
      .from('page_layers')
      .update({ deleted_at: deletedAt })
      .in('page_id', affectedPageIds)
      .is('deleted_at', null);

    if (layersError) {
      throw new Error(`Failed to delete page layers: ${layersError.message}`);
    }
  }

  // Query 4: Delete all pages within this folder and its descendants
  const { error: pagesError } = await client
    .from('pages')
    .update({ deleted_at: deletedAt })
    .in('page_folder_id', allFolderIds)
    .is('deleted_at', null);

  if (pagesError) {
    throw new Error(`Failed to delete pages in folder: ${pagesError.message}`);
  }

  // Query 5: Delete ALL folders (parent + descendants) in a single query
  const { error: foldersError } = await client
    .from('page_folders')
    .update({ deleted_at: deletedAt })
    .in('id', allFolderIds)
    .is('deleted_at', null);

  if (foldersError) {
    throw new Error(`Failed to delete folders: ${foldersError.message}`);
  }

  console.log(`[deletePageFolder] Successfully deleted folder ${id}, ${affectedPageIds.length} pages, and their layers`);

  // Reorder remaining siblings (both pages and folders) with the same parent_id and depth
  try {
    await reorderSiblings(folderToDelete.page_folder_id, folderToDelete.depth);
    console.log(`[deletePageFolder] Reordered siblings under parent ${folderToDelete.page_folder_id || 'root'} at depth ${folderToDelete.depth}`);
  } catch (reorderError) {
    console.error('[deletePageFolder] Failed to reorder siblings:', reorderError);
    // Don't fail the deletion if reordering fails
  }
}

/**
 * Restore a soft-deleted page folder
 */
export async function restorePageFolder(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { error } = await client
    .from('page_folders')
    .update({ deleted_at: null })
    .eq('id', id)
    .not('deleted_at', 'is', null); // Only restore if deleted

  if (error) {
    throw new Error(`Failed to restore page folder: ${error.message}`);
  }
}

/**
 * Force delete a page folder (permanent deletion)
 * Use with caution!
 */
export async function forceDeletePageFolder(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { error } = await client
    .from('page_folders')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to force delete page folder: ${error.message}`);
  }
}

/**
 * Get published page folder by publish_key
 */
export async function getPublishedPageFolderByPublishKey(publishKey: string): Promise<PageFolder | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('page_folders')
    .select('*')
    .eq('publish_key', publishKey)
    .eq('is_published', true)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch published page folder: ${error.message}`);
  }

  return data;
}

/**
 * Get page folder by slug
 * @param slug - Folder slug
 * @param filters - Optional additional filters
 */
export async function getPageFolderBySlug(slug: string, filters?: QueryFilters): Promise<PageFolder | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  let query = client
    .from('page_folders')
    .select('*')
    .eq('slug', slug)
    .is('deleted_at', null);

  // Apply additional filters if provided
  if (filters) {
    Object.entries(filters).forEach(([column, value]) => {
      query = query.eq(column, value);
    });
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch page folder: ${error.message}`);
  }

  return data;
}

/**
 * Reorder folders within a parent
 * Updates the order field for multiple folders in a single operation
 * @param updates - Array of { id, order } objects
 */
export async function reorderFolders(updates: Array<{ id: string; order: number }>): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Update each folder's order
  const promises = updates.map(({ id, order }) =>
    client
      .from('page_folders')
      .update({ order })
      .eq('id', id)
  );

  const results = await Promise.all(promises);

  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    throw new Error(`Failed to reorder folders: ${errors[0].error?.message}`);
  }
}

