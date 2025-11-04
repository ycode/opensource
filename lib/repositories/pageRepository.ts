/**
 * Page Repository
 *
 * Data access layer for page operations with Supabase
 */

import { getSupabaseAdmin } from '../supabase-server';
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
  console.log('[pageRepository.getAllPages] Getting Supabase client...');
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

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('[pageRepository.getAllPages] Query error:', error);
    throw new Error(`Failed to fetch pages: ${error.message}`);
  }

  console.log('[pageRepository.getAllPages] Query success, rows:', data?.length || 0);
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

  console.log('[pageRepository.createPage] Creating page:', insertData);

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
 * Soft delete a page and its associated page layers
 * Sets deleted_at to current timestamp instead of hard deleting
 * Also deletes all page_layers (draft and published) for this page
 */
export async function deletePage(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const deletedAt = new Date().toISOString();

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
 * Publish a page
 * Creates or updates a published version of the page with the same publish_key
 * Draft page remains unchanged
 */
export async function publishPage(draftPageId: string): Promise<Page> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Get draft page
  const draftPage = await getPageById(draftPageId);

  if (!draftPage) {
    throw new Error('Draft page not found');
  }

  if (draftPage.is_published) {
    throw new Error('Cannot publish a page that is already marked as published');
  }

  // Check if published version exists
  const existingPublished = await getPublishedPageByPublishKey(draftPage.publish_key);

  const publishedData = {
    name: draftPage.name,
    slug: draftPage.slug,
    page_folder_id: draftPage.page_folder_id,
    order: draftPage.order,
    depth: draftPage.depth,
    is_index: draftPage.is_index,
    is_dynamic: draftPage.is_dynamic,
    is_locked: draftPage.is_locked,
    error_page: draftPage.error_page,
    settings: draftPage.settings,
    is_published: true,
    publish_key: draftPage.publish_key,
  };

  if (existingPublished) {
    // Update existing published version only if data changed
    const hasChanges =
      existingPublished.name !== draftPage.name ||
      existingPublished.slug !== draftPage.slug ||
      existingPublished.page_folder_id !== draftPage.page_folder_id ||
      existingPublished.order !== draftPage.order ||
      existingPublished.depth !== draftPage.depth ||
      existingPublished.is_index !== draftPage.is_index ||
      existingPublished.is_dynamic !== draftPage.is_dynamic ||
      existingPublished.is_locked !== draftPage.is_locked ||
      existingPublished.error_page !== draftPage.error_page ||
      JSON.stringify(existingPublished.settings) !== JSON.stringify(draftPage.settings);

    if (hasChanges) {
      const { data, error } = await client
        .from('pages')
        .update(publishedData)
        .eq('id', existingPublished.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update published page: ${error.message}`);
      }

      return data;
    }

    return existingPublished;
  } else {
    // Create new published version
    const { data, error } = await client
      .from('pages')
      .insert(publishedData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create published page: ${error.message}`);
    }

    return data;
  }
}

