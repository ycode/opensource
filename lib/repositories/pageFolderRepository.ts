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
  is_published?: boolean;
  page_folder_id?: string | null;
}

/**
 * Retrieves all page folders from the database
 *
 * @param filters - Optional key-value filters to apply (e.g., { is_published: true })
 * @returns Promise resolving to array of page folders, ordered by creation date (newest first)
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

  const { data, error } = await query.order('created_at', { ascending: false });

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
 * Soft delete a page folder
 * Sets deleted_at to current timestamp instead of hard deleting
 */
export async function deletePageFolder(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { error } = await client
    .from('page_folders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null); // Only delete if not already deleted

  if (error) {
    throw new Error(`Failed to delete page folder: ${error.message}`);
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

