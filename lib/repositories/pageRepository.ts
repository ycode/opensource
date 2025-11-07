/**
 * Page Repository
 *
 * Data access layer for page operations with Supabase
 */

import { getSupabaseAdmin } from '../supabase-server';
import { reorderSiblings } from './pageFolderRepository';
import type { Page } from '../../types';
import { isHomepage } from '../page-utils';

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
 * Generate a unique slug from a page name
 */
function generateSlugFromName(name: string, timestamp?: number): string {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (timestamp) {
    return `${baseSlug}-${timestamp}`;
  }

  return baseSlug || `page-${Date.now()}`;
}

/**
 * Automatically transfer index status from existing index page to new one
 * - Finds existing index page in the same folder
 * - Unsets its is_index flag
 * - Generates and sets a slug for it
 */
async function transferIndexPage(
  client: any,
  newIndexPageId: string,
  pageFolderId: string | null
): Promise<void> {
  // Find existing index page in the same folder
  let query = client
    .from('pages')
    .select('id, name, slug')
    .eq('is_index', true)
    .is('deleted_at', null)
    .neq('id', newIndexPageId);

  // Filter by parent folder
  if (pageFolderId === null || pageFolderId === undefined) {
    query = query.is('page_folder_id', null);
  } else {
    query = query.eq('page_folder_id', pageFolderId);
  }

  const { data: existingIndex, error } = await query.limit(1).single();

  // If no existing index found (PGRST116 = no rows), nothing to transfer
  if (error && error.code === 'PGRST116') {
    return;
  }

  if (error) {
    throw new Error(`Failed to check for existing index page: ${error.message}`);
  }

  if (existingIndex) {
    // If the existing index page already has a slug (shouldn't happen but might in edge cases),
    // we don't need to generate a new one - just unset is_index
    if (existingIndex.slug && existingIndex.slug.trim() !== '') {
      const { error: updateError } = await client
        .from('pages')
        .update({
          is_index: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingIndex.id);

      if (updateError) {
        throw new Error(`Failed to transfer index from existing page: ${updateError.message}`);
      }

      return;
    }

    // Generate a slug for the old index page
    const timestamp = Date.now();
    let newSlug = generateSlugFromName(existingIndex.name);

    // Check if slug already exists (regardless of published state)
    const { data: duplicateCheck } = await client
      .from('pages')
      .select('id')
      .eq('slug', newSlug)
      .is('deleted_at', null)
      .neq('id', existingIndex.id)
      .limit(1)
      .single();

    // If slug exists, add timestamp
    if (duplicateCheck) {
      newSlug = generateSlugFromName(existingIndex.name, timestamp);

      // Double-check the timestamped slug doesn't exist either
      const { data: timestampedDuplicateCheck } = await client
        .from('pages')
        .select('id')
        .eq('slug', newSlug)
        .is('deleted_at', null)
        .neq('id', existingIndex.id)
        .limit(1)
        .single();

      // If still duplicate, add random suffix
      if (timestampedDuplicateCheck) {
        newSlug = `${newSlug}-${Math.random().toString(36).substr(2, 5)}`;
      }
    }

    // Update the old index page: unset is_index and set slug
    const { error: updateError } = await client
      .from('pages')
      .update({
        is_index: false,
        slug: newSlug,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingIndex.id);

    if (updateError) {
      throw new Error(`Failed to transfer index from existing page: ${updateError.message}`);
    }
  }
}

/**
 * Validate index page constraints
 * - Index pages must have empty slug
 * - Non-index pages must have non-empty slug
 * - Root folder (page_folder_id = null) must always have an index page
 * - Homepage (root index page) cannot be moved to another folder
 */
async function validateIndexPageConstraints(
  client: any,
  pageData: { is_index?: boolean; slug: string; page_folder_id?: string | null },
  excludePageId?: string,
  currentPageData?: { is_index: boolean; page_folder_id: string | null }
): Promise<void> {
  // Rule 1: Index pages must have empty slug
  if (pageData.is_index && pageData.slug.trim() !== '') {
    throw new Error('Index pages must have an empty slug');
  }

  // Rule 2: Non-index pages must have non-empty slug
  if (!pageData.is_index && pageData.slug.trim() === '') {
    throw new Error('Non-index pages must have a non-empty slug');
  }

  // Rule 3: Homepage (root index page) cannot be moved to another folder
  if (currentPageData && isHomepage(currentPageData as Page)) {
    // If trying to move the homepage to a different folder
    if (pageData.page_folder_id !== null && pageData.page_folder_id !== undefined) {
      throw new Error('The Homepage cannot be moved to another folder. It must remain in the root folder.');
    }
  }

  // Rule 4: Root folder must always have an index page
  // When unsetting is_index (changing from true to false) for a root page
  if (!pageData.is_index && (pageData.page_folder_id === null || pageData.page_folder_id === undefined)) {
    // Check if there are other index pages in root folder
    let query = client
      .from('pages')
      .select('id')
      .eq('is_index', true)
      .is('page_folder_id', null)
      .is('deleted_at', null);

    // Exclude current page if updating
    if (excludePageId) {
      query = query.neq('id', excludePageId);
    }

    const { data: otherRootIndexPages, error } = await query;

    if (error) {
      throw new Error(`Failed to check for other root index pages: ${error.message}`);
    }

    // If no other index pages exist in root, prevent unsetting
    if (!otherRootIndexPages || otherRootIndexPages.length === 0) {
      throw new Error('The root folder must have an index page. Please set another page as index first.');
    }
  }
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

  // Validate index page constraints (no current page data for new pages)
  await validateIndexPageConstraints(
    client,
    {
      is_index: pageData.is_index || false,
      slug: pageData.slug,
      page_folder_id: pageData.page_folder_id,
    },
    undefined,
    undefined
  );

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

  // If setting as index page, transfer from existing index page
  if (pageData.is_index) {
    await transferIndexPage(client, data.id, pageData.page_folder_id || null);
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

  // Get current page data to merge with updates for validation
  const currentPage = await getPageById(id);
  if (!currentPage) {
    throw new Error('Page not found');
  }

  // Merge current data with updates for validation
  const mergedData = {
    is_index: updates.is_index !== undefined ? updates.is_index : currentPage.is_index,
    slug: updates.slug !== undefined ? updates.slug : currentPage.slug,
    page_folder_id: updates.page_folder_id !== undefined ? updates.page_folder_id : currentPage.page_folder_id,
  };

  // Validate index page constraints if is_index or slug is being updated
  if (updates.is_index !== undefined || updates.slug !== undefined || updates.page_folder_id !== undefined) {
    await validateIndexPageConstraints(
      client,
      mergedData,
      id,
      { is_index: currentPage.is_index, page_folder_id: currentPage.page_folder_id }
    );
  }

  // If setting as index page (and wasn't before), transfer from existing index page
  // Use the TARGET page_folder_id (where the page will be) to find the existing index
  const isBecomingIndex = updates.is_index === true && !currentPage.is_index;

  if (isBecomingIndex) {
    const folderIdForTransfer = updates.page_folder_id !== undefined ? updates.page_folder_id : currentPage.page_folder_id;

    // FIRST: Clean up any orphaned pages with empty slugs that are NOT index pages
    // This can happen if a previous operation failed mid-way
    const { data: orphanedPages } = await client
      .from('pages')
      .select('id, name, slug, is_index, page_folder_id')
      .eq('slug', '')
      .eq('is_index', false)
      .is('deleted_at', null);

    if (orphanedPages && orphanedPages.length > 0) {
      // Fix each orphaned page by giving it a slug
      for (const orphan of orphanedPages) {
        const timestamp = Date.now();
        let newSlug = generateSlugFromName(orphan.name, timestamp);

        // Ensure uniqueness
        const { data: duplicateCheck } = await client
          .from('pages')
          .select('id')
          .eq('slug', newSlug)
          .is('deleted_at', null)
          .neq('id', orphan.id)
          .limit(1)
          .single();

        if (duplicateCheck) {
          newSlug = `${newSlug}-${Math.random().toString(36).substr(2, 5)}`;
        }

        await client
          .from('pages')
          .update({ slug: newSlug, updated_at: new Date().toISOString() })
          .eq('id', orphan.id);
      }
    }

    await transferIndexPage(client, id, folderIdForTransfer);
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

  // Prevent deleting the homepage
  if (isHomepage(pageToDelete)) {
    // Check if there are other index pages in root folder
    const { data: otherRootIndexPages, error: checkError } = await client
      .from('pages')
      .select('id')
      .eq('is_index', true)
      .is('page_folder_id', null)
      .is('deleted_at', null)
      .neq('id', id);

    if (checkError) {
      throw new Error(`Failed to check for other root index pages: ${checkError.message}`);
    }

    if (!otherRootIndexPages || otherRootIndexPages.length === 0) {
      throw new Error('Cannot delete the last index page in the root folder. Please set another page as index first.');
    }
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
