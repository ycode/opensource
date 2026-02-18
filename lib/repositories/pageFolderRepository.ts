/**
 * Page Folder Repository
 *
 * Data access layer for page folder operations with Supabase
 */

import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { PageFolder } from '../../types';
import { incrementSiblingOrders } from '../services/pageService';

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
  id?: string;
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
    .eq('is_published', false)
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

  // Update each folder's order (drafts only - users edit drafts)
  const promises = updates.map(({ id, order }) =>
    client
      .from('page_folders')
      .update({ order })
      .eq('id', id)
      .eq('is_published', false)
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

  // Fetch sibling folders - filter by parent_id AND depth (drafts only)
  let foldersQuery = client
    .from('page_folders')
    .select('id, order')
    .eq('depth', depth)
    .eq('is_published', false)
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

  // Fetch sibling pages - filter by parent_id AND depth (drafts only)
  let pagesQuery = client
    .from('pages')
    .select('id, order')
    .eq('depth', depth)
    .eq('is_published', false)
    .is('deleted_at', null)
    .is('error_page', null);

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

  // Apply updates using batch CASE statements for efficiency (drafts only)
  if (folderUpdates.length > 0) {
    const { getKnexClient } = await import('../knex-client');
    const { batchUpdateColumn } = await import('../knex-helpers');
    const knex = await getKnexClient();

    await batchUpdateColumn(knex, 'page_folders', 'order',
      folderUpdates.map(u => ({ id: u.id, value: u.order })),
      {
        extraWhereClause: 'AND is_published = false AND deleted_at IS NULL',
        castType: 'integer',
      }
    );
  }

  if (pageUpdates.length > 0) {
    const { getKnexClient } = await import('../knex-client');
    const { batchUpdateColumn } = await import('../knex-helpers');
    const knex = await getKnexClient();

    await batchUpdateColumn(knex, 'pages', 'order',
      pageUpdates.map(u => ({ id: u.id, value: u.order })),
      {
        extraWhereClause: 'AND is_published = false AND deleted_at IS NULL AND error_page IS NULL',
        castType: 'integer',
      }
    );
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

  // Query 2: Get all draft page IDs within these folders
  const { data: affectedPages, error: fetchPagesError } = await client
    .from('pages')
    .select('id')
    .in('page_folder_id', allFolderIds)
    .eq('is_published', false)
    .is('deleted_at', null);

  if (fetchPagesError) {
    throw new Error(`Failed to fetch pages in folder: ${fetchPagesError.message}`);
  }

  const affectedPageIds = affectedPages?.map(p => p.id) || [];

  // Query 3: Soft-delete all draft page_layers for affected pages (if any)
  if (affectedPageIds.length > 0) {
    const { error: layersError } = await client
      .from('page_layers')
      .update({ deleted_at: deletedAt })
      .in('page_id', affectedPageIds)
      .eq('is_published', false)
      .is('deleted_at', null);

    if (layersError) {
      throw new Error(`Failed to delete page layers: ${layersError.message}`);
    }
  }

  // Query 4: Soft-delete all draft pages within this folder and its descendants
  const { error: pagesError } = await client
    .from('pages')
    .update({ deleted_at: deletedAt })
    .in('page_folder_id', allFolderIds)
    .eq('is_published', false)
    .is('deleted_at', null);

  if (pagesError) {
    throw new Error(`Failed to delete pages in folder: ${pagesError.message}`);
  }

  // Query 5: Soft-delete ALL draft folders (parent + descendants) in a single query
  const { error: foldersError } = await client
    .from('page_folders')
    .update({ deleted_at: deletedAt })
    .in('id', allFolderIds)
    .eq('is_published', false)
    .is('deleted_at', null);

  if (foldersError) {
    throw new Error(`Failed to delete folders: ${foldersError.message}`);
  }

  // Reorder remaining siblings (both pages and folders) with the same parent_id and depth
  try {
    await reorderSiblings(folderToDelete.page_folder_id, folderToDelete.depth);
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

  // Restore draft folder (publishing service will handle published version)
  const { error } = await client
    .from('page_folders')
    .update({ deleted_at: null })
    .eq('id', id)
    .eq('is_published', false)
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
 * Get draft page folder by ID
 */
export async function getDraftPageFolderById(id: string): Promise<PageFolder | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('page_folders')
    .select('*')
    .eq('id', id)
    .eq('is_published', false)
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
 * Get published page folder by ID
 */
export async function getPublishedPageFolderById(id: string): Promise<PageFolder | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('page_folders')
    .select('*')
    .eq('id', id)
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
 * Get all draft page folders (is_published = false)
 * @param includeSoftDeleted - Include soft-deleted folders
 */
export async function getAllDraftPageFolders(includeSoftDeleted = false): Promise<PageFolder[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  let query = client
    .from('page_folders')
    .select('*')
    .eq('is_published', false);

  if (!includeSoftDeleted) {
    query = query.is('deleted_at', null);
  }

  const { data, error } = await query.order('order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch draft folders: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all published page folders
 *
 * @param includeSoftDeleted - Whether to include soft-deleted folders (default: false)
 * @returns Array of published page folders
 */
export async function getAllPublishedPageFolders(includeSoftDeleted = false): Promise<PageFolder[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  let query = client
    .from('page_folders')
    .select('*')
    .eq('is_published', true);

  if (!includeSoftDeleted) {
    query = query.is('deleted_at', null);
  }

  const { data, error } = await query.order('order', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch published folders: ${error.message}`);
  }

  return data || [];
}

/**
 * Get published page folders by IDs
 * Fetches multiple published folders in a single query
 */
export async function getPublishedPageFoldersByIds(ids: string[]): Promise<PageFolder[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('page_folders')
    .select('*')
    .in('id', ids)
    .eq('is_published', true);

  if (error) {
    throw new Error(`Failed to fetch published folders: ${error.message}`);
  }

  return data || [];
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
  if (updates.length === 0) {
    return;
  }

  const { getKnexClient } = await import('../knex-client');
  const { batchUpdateColumn } = await import('../knex-helpers');
  const knex = await getKnexClient();

  await batchUpdateColumn(knex, 'page_folders', 'order',
    updates.map(u => ({ id: u.id, value: u.order })),
    {
      extraWhereClause: 'AND is_published = false AND deleted_at IS NULL',
      castType: 'integer',
    }
  );
}

/**
 * Duplicate a page folder recursively
 * Creates a copy of the folder with all its child pages and folders
 * @param folderId - ID of the folder to duplicate
 * @returns The newly created folder
 */
export async function duplicatePageFolder(folderId: string): Promise<PageFolder> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Get the original folder
  const originalFolder = await getPageFolderById(folderId);
  if (!originalFolder) {
    throw new Error('Folder not found');
  }

  const newName = `${originalFolder.name} (Copy)`;

  // Generate base slug from the new name
  const baseSlug = newName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Get all existing slugs in the same parent folder to find a unique one
  let query = client
    .from('page_folders')
    .select('slug')
    .is('deleted_at', null);

  // Handle null parent folder properly
  if (originalFolder.page_folder_id === null) {
    query = query.is('page_folder_id', null);
  } else {
    query = query.eq('page_folder_id', originalFolder.page_folder_id);
  }

  const { data: existingFolders } = await query;

  const existingSlugs = (existingFolders || []).map(f => f.slug.toLowerCase());

  // Find unique slug
  let newSlug = baseSlug;
  if (existingSlugs.includes(baseSlug)) {
    let counter = 2;
    newSlug = `${baseSlug}-${counter}`;
    while (existingSlugs.includes(newSlug)) {
      counter++;
      newSlug = `${baseSlug}-${counter}`;
    }
  }

  // Place the duplicate right after the original folder
  const newOrder = originalFolder.order + 1;

  // Increment order for all siblings (folders and pages) that come after the original folder
  await incrementSiblingOrders(newOrder, originalFolder.depth, originalFolder.page_folder_id);

  // Create the new folder
  const { data: newFolder, error: folderError } = await client
    .from('page_folders')
    .insert({
      name: newName,
      slug: newSlug,
      is_published: false, // Always create as unpublished
      page_folder_id: originalFolder.page_folder_id,
      order: newOrder,
      depth: originalFolder.depth,
      settings: originalFolder.settings || {},
    })
    .select()
    .single();

  if (folderError) {
    throw new Error(`Failed to create duplicate folder: ${folderError.message}`);
  }

  // Now recursively duplicate all child folders and pages
  await duplicateFolderContents(client, folderId, newFolder.id);

  return newFolder;
}

/**
 * Helper function to recursively duplicate all contents of a folder
 * @param client - Supabase client
 * @param originalFolderId - Original folder ID
 * @param newFolderId - New folder ID
 */
async function duplicateFolderContents(
  client: any,
  originalFolderId: string,
  newFolderId: string
): Promise<void> {
  // Get all child folders
  const { data: childFolders, error: foldersError } = await client
    .from('page_folders')
    .select('*')
    .eq('page_folder_id', originalFolderId)
    .is('deleted_at', null)
    .order('order', { ascending: true });

  if (foldersError) {
    throw new Error(`Failed to fetch child folders: ${foldersError.message}`);
  }

  // Get all child pages
  const { data: childPages, error: pagesError } = await client
    .from('pages')
    .select('*')
    .eq('page_folder_id', originalFolderId)
    .is('deleted_at', null)
    .order('order', { ascending: true });

  if (pagesError) {
    throw new Error(`Failed to fetch child pages: ${pagesError.message}`);
  }

  // Duplicate child folders first (to maintain order)
  const folderIdMap = new Map<string, string>(); // Map old folder ID to new folder ID

  if (childFolders && childFolders.length > 0) {
    for (const folder of childFolders) {
      const timestamp = Date.now() + Math.random(); // Add randomness for uniqueness
      const newFolderSlug = `folder-${Math.floor(timestamp)}`;

      const { data: duplicatedFolder, error: dupError } = await client
        .from('page_folders')
        .insert({
          name: folder.name,
          slug: newFolderSlug,
          is_published: false,
          page_folder_id: newFolderId, // Point to new parent
          order: folder.order,
          depth: folder.depth,
          settings: folder.settings || {},
        })
        .select()
        .single();

      if (dupError) {
        throw new Error(`Failed to duplicate child folder: ${dupError.message}`);
      }

      folderIdMap.set(folder.id, duplicatedFolder.id);

      // Recursively duplicate this folder's contents
      await duplicateFolderContents(client, folder.id, duplicatedFolder.id);
    }
  }

  // Duplicate child pages
  if (childPages && childPages.length > 0) {
    for (const page of childPages) {
      const timestamp = Date.now() + Math.random();
      const newPageSlug = page.is_index ? '' : `page-${Math.floor(timestamp)}`;

      const { data: duplicatedPage, error: dupError } = await client
        .from('pages')
        .insert({
          name: page.name,
          slug: newPageSlug,
          is_published: false,
          page_folder_id: newFolderId, // Point to new parent
          order: page.order,
          depth: page.depth,
          is_index: page.is_index,
          is_dynamic: page.is_dynamic,
          error_page: page.error_page,
          settings: page.settings || {},
        })
        .select()
        .single();

      if (dupError) {
        throw new Error(`Failed to duplicate child page: ${dupError.message}`);
      }

      // Duplicate the page's draft layers if they exist
      const { data: originalLayers, error: layersError } = await client
        .from('page_layers')
        .select('*')
        .eq('page_id', page.id)
        .eq('is_published', false)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      // If there are draft layers, duplicate them for the new page
      if (!layersError && originalLayers) {
        await client
          .from('page_layers')
          .insert({
            page_id: duplicatedPage.id,
            layers: originalLayers.layers,
            is_published: false,
          });
      }
    }
  }
}
