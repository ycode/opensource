/**
 * Page Repository
 *
 * Data access layer for page operations with Supabase
 */

import { getSupabaseAdmin } from '../supabase-server';
import { reorderSiblings } from './pageFolderRepository';
import type { Page } from '../../types';

/**
 * Query filters for page lookups
 */
export interface QueryFilters {
  [key: string]: string | number | boolean | null;
}

/**
 * Data required to create a new page
 */
export interface CreatePageData {
  name: string;
  slug: string;
  is_published?: boolean;
  page_folder_id?: string | null;
  order?: number;
  depth?: number;
  is_index?: boolean;
  is_dynamic?: boolean;
  is_locked?: boolean;
  error_page?: number | null;
  settings?: Record<string, any>;
}

/**
 * Data that can be updated on an existing page
 */
export interface UpdatePageData {
  name?: string;
  slug?: string;
  is_published?: boolean;
  page_folder_id?: string | null;
  order?: number;
  depth?: number;
  is_index?: boolean;
  is_dynamic?: boolean;
  is_locked?: boolean;
  error_page?: number | null;
  settings?: Record<string, any>;
}

/**
 * Retrieves all pages from the database
 *
 * @param filters - Optional key-value filters to apply (e.g., { is_published: true })
 * @returns Promise resolving to array of pages, ordered by creation date (newest first)
 * @throws Error if Supabase query fails
 *
 * @example
 * const allPages = await getAllPages();
 * const publishedPages = await getAllPages({ is_published: true });
 */
export async function getAllPages(filters?: QueryFilters): Promise<Page[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    console.error('[pageRepository.getAllPages] Supabase client is null!');
    throw new Error('Supabase not configured');
  }

  console.log('[pageRepository.getAllPages] Querying pages table...', filters ? `with filters: ${JSON.stringify(filters)}` : 'no filters');

  let query = client
    .from('pages')
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
    console.error('[pageRepository.getAllPages] Query error:', error);
    throw new Error(`Failed to fetch pages: ${error.message}`);
  }

  return data || [];
}

/**
 * Get page by ID
 */
export async function getPageById(id: string): Promise<Page | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('pages')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch page: ${error.message}`);
  }

  return data;
}

/**
 * Get page by slug
 * @param slug - Page slug
 * @param filters - Optional additional filters
 */
export async function getPageBySlug(slug: string, filters?: QueryFilters): Promise<Page | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  let query = client
    .from('pages')
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
    throw new Error(`Failed to fetch page: ${error.message}`);
  }

  return data;
}

/**
 * Create new page
 * @param pageData - Page data to create
 * @param additionalData - Optional additional fields (e.g., metadata, tags)
 */
export async function createPage(pageData: CreatePageData, additionalData?: Record<string, any>): Promise<Page> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Merge page data with any additional fields
  const insertData = additionalData
    ? { ...pageData, ...additionalData }
    : pageData;


  const { data, error } = await client
    .from('pages')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create page: ${error.message}`);
  }

  return data;
}

/**
 * Update page
 */
export async function updatePage(id: string, updates: UpdatePageData): Promise<Page> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('pages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update page: ${error.message}`);
  }

  return data;
}

/**
 * Batch update order for multiple pages
 * @param updates - Array of { id, order } objects
 */
export async function batchUpdatePageOrder(updates: Array<{ id: string; order: number }>): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Update each page's order
  const promises = updates.map(({ id, order }) =>
    client
      .from('pages')
      .update({ order })
      .eq('id', id)
      .is('deleted_at', null)
  );

  const results = await Promise.all(promises);

  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    throw new Error(`Failed to update page order: ${errors[0].error?.message}`);
  }
}

/**
 * Soft delete a page and its associated page layers
 * Sets deleted_at to current timestamp instead of hard deleting
 * Also deletes all page_layers (draft and published) for this page
 * After deletion, reorders remaining pages with the same parent_id
 */
export async function deletePage(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const deletedAt = new Date().toISOString();

  // Get the page before deletion to know its parent_id and depth
  const pageToDelete = await getPageById(id);
  if (!pageToDelete) {
    throw new Error('Page not found');
  }

  // Delete all page_layers (draft and published) for this page
  const { error: layersError } = await client
    .from('page_layers')
    .update({ deleted_at: deletedAt })
    .eq('page_id', id)
    .is('deleted_at', null);

  if (layersError) {
    throw new Error(`Failed to delete page layers: ${layersError.message}`);
  }

  // Delete the page itself
  const { error } = await client
    .from('pages')
    .update({ deleted_at: deletedAt })
    .eq('id', id)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to delete page: ${error.message}`);
  }

  console.log(`[deletePage] Successfully deleted page ${id} and its layers`);

  // Reorder remaining siblings (both pages and folders) with the same parent_id and depth
  try {
    await reorderSiblings(pageToDelete.page_folder_id, pageToDelete.depth);
    console.log(`[deletePage] Reordered siblings under parent ${pageToDelete.page_folder_id || 'root'} at depth ${pageToDelete.depth}`);
  } catch (reorderError) {
    console.error('[deletePage] Failed to reorder siblings:', reorderError);
    // Don't fail the deletion if reordering fails
  }
}

/**
 * Restore a soft-deleted page
 */
export async function restorePage(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { error } = await client
    .from('pages')
    .update({ deleted_at: null })
    .eq('id', id)
    .not('deleted_at', 'is', null); // Only restore if deleted

  if (error) {
    throw new Error(`Failed to restore page: ${error.message}`);
  }
}

/**
 * Force delete a page (permanent deletion)
 * Use with caution!
 */
export async function forceDeletePage(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { error } = await client
    .from('pages')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to force delete page: ${error.message}`);
  }
}

/**
 * Get all draft pages
 * @param includeDeleted - If true, includes soft-deleted drafts
 */
export async function getAllDraftPages(includeDeleted = false): Promise<Page[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  let query = client
    .from('pages')
    .select('*')
    .eq('is_published', false);

  // Exclude soft-deleted records by default
  if (!includeDeleted) {
    query = query.is('deleted_at', null);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch draft pages: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all published pages by publish_keys
 * Used for batch publishing optimization
 */
export async function getPublishedPagesByPublishKeys(publishKeys: string[]): Promise<Page[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  if (publishKeys.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('pages')
    .select('*')
    .in('publish_key', publishKeys)
    .eq('is_published', true)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch published pages: ${error.message}`);
  }

  return data || [];
}

/**
 * Get published page by publish_key
 * Used to find the published version of a draft page
 */
export async function getPublishedPageByPublishKey(publishKey: string): Promise<Page | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('pages')
    .select('*')
    .eq('publish_key', publishKey)
    .eq('is_published', true)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch published page: ${error.message}`);
  }

  return data;
}

/**
 * Get all pages in a specific folder
 * @param folderId - Folder ID (null for root/unorganized pages)
 */
export async function getPagesByFolder(folderId: string | null): Promise<Page[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const query = client
    .from('pages')
    .select('*')
    .is('deleted_at', null);

  // Handle null vs non-null folder_id
  const finalQuery = folderId === null
    ? query.is('page_folder_id', null)
    : query.eq('page_folder_id', folderId);

  const { data, error } = await finalQuery.order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch pages by folder: ${error.message}`);
  }

  return data || [];
}

/**
 * Duplicate a page with its draft layers
 * Creates a copy of the page and its draft layers with a new slug
 *
 * @param pageId - ID of the page to duplicate
 * @returns Promise resolving to the new duplicated page
 */
export async function duplicatePage(pageId: string): Promise<Page> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Get the original page
  const originalPage = await getPageById(pageId);
  if (!originalPage) {
    throw new Error('Page not found');
  }

  // Generate new slug with timestamp to ensure uniqueness
  const timestamp = Date.now();
  const newSlug = `page-${timestamp}`;
  const newName = `${originalPage.name} (Copy)`;

  // Get the max order for siblings
  const query = client
    .from('pages')
    .select('order')
    .eq('depth', originalPage.depth)
    .is('deleted_at', null);

  // Handle null vs non-null folder_id
  const orderQuery = originalPage.page_folder_id === null
    ? query.is('page_folder_id', null)
    : query.eq('page_folder_id', originalPage.page_folder_id);

  const { data: siblings, error: orderError } = await orderQuery.order('order', { ascending: false }).limit(1);

  if (orderError) {
    throw new Error(`Failed to get sibling order: ${orderError.message}`);
  }

  const maxOrder = siblings && siblings.length > 0 ? siblings[0].order : -1;
  const newOrder = maxOrder + 1;

  // Create the new page
  const { data: newPage, error: pageError } = await client
    .from('pages')
    .insert({
      name: newName,
      slug: newSlug,
      is_published: false, // Always create as unpublished
      page_folder_id: originalPage.page_folder_id,
      order: newOrder,
      depth: originalPage.depth,
      is_index: false, // Don't duplicate index status
      is_dynamic: originalPage.is_dynamic,
      is_locked: false, // Don't duplicate locked status
      error_page: originalPage.error_page,
      settings: originalPage.settings || {},
    })
    .select()
    .single();

  if (pageError) {
    throw new Error(`Failed to create duplicate page: ${pageError.message}`);
  }

  // Get the original page's draft layers
  const { data: originalLayers, error: layersError } = await client
    .from('page_layers')
    .select('*')
    .eq('page_id', pageId)
    .eq('is_published', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // If there are draft layers, duplicate them for the new page
  if (!layersError && originalLayers) {
    const { error: newLayersError } = await client
      .from('page_layers')
      .insert({
        page_id: newPage.id,
        layers: originalLayers.layers,
        is_published: false,
        publish_key: newPage.publish_key,
        generated_css: null, // Don't copy generated CSS
      });

    if (newLayersError) {
      // If layer duplication fails, we should still return the page
      // but log the error
      console.error('Failed to duplicate layers:', newLayersError);
    }
  }

  return newPage;
}
