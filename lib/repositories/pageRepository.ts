/**
 * Page Repository
 *
 * Data access layer for page operations with Supabase
 */

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { reorderSiblings } from './pageFolderRepository';
import type { Page, PageSettings } from '../../types';
import { isHomepage } from '../page-utils';
import { incrementSiblingOrders, fixOrphanedPageSlugs } from '../services/pageService';
import { generatePageMetadataHash } from '../hash-utils';

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
  id?: string;
  name: string;
  slug: string;
  is_published?: boolean;
  page_folder_id?: string | null;
  order?: number;
  depth?: number;
  is_index?: boolean;
  is_dynamic?: boolean;
  error_page?: number | null;
  settings?: PageSettings;
  content_hash?: string;
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
  settings?: PageSettings;
  content_hash?: string; // Auto-calculated, should not be set manually
}

function normalizePageFolderId(folderId?: string | null): string | null {
  if (folderId === undefined || folderId === null) {
    return null;
  }

  if (typeof folderId === 'string') {
    const trimmed = folderId.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
      return null;
    }
    return trimmed;
  }

  return folderId;
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
 * @param id - Page ID
 * @param isPublished - Get draft (false) or published (true) version. Defaults to false (draft).
 */
export async function getPageById(id: string, isPublished: boolean = false): Promise<Page | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('pages')
    .select('*')
    .eq('id', id)
    .eq('is_published', isPublished)
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
  pageFolderId: string | null,
  isPublished: boolean = false
): Promise<void> {
  // Find existing index page in the same folder WITH THE SAME is_published status
  // This prevents draft pages from being modified when creating published index pages
  let query = client
    .from('pages')
    .select('id, name, slug')
    .eq('is_index', true)
    .eq('is_published', isPublished)
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
        .eq('id', existingIndex.id)
        .eq('is_published', isPublished); // Must filter by is_published for composite key

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
      .eq('id', existingIndex.id)
      .eq('is_published', isPublished); // Must filter by is_published for composite key

    if (updateError) {
      throw new Error(`Failed to transfer index from existing page: ${updateError.message}`);
    }
  }
}

/**
 * Validate index page constraints
 * - Index pages must have empty slug
 * - Non-index pages must have non-empty slug (unless they're error pages or dynamic pages)
 * - Error pages can have empty slugs regardless of is_index status
 * - Dynamic pages use "*" as slug placeholder
 * - Root folder (page_folder_id = null) must always have an index page
 * - Homepage (root index page) cannot be moved to another folder
 */
async function validateIndexPageConstraints(
  client: any,
  pageData: { is_index?: boolean; slug: string; page_folder_id?: string | null; error_page?: number | null; is_dynamic?: boolean },
  excludePageId?: string,
  currentPageData?: { is_index: boolean; page_folder_id: string | null; is_dynamic?: boolean }
): Promise<void> {
  // Rule 1: Index pages must have empty slug
  if (pageData.is_index && pageData.slug.trim() !== '') {
    throw new Error('Index pages must have an empty slug');
  }

  // Rule 2: Non-index, non-error, non-dynamic pages must have non-empty slug
  const isErrorPage = pageData.error_page !== null && pageData.error_page !== undefined;
  const isDynamicPage = pageData.is_dynamic === true;
  if (!pageData.is_index && !isErrorPage && !isDynamicPage && pageData.slug.trim() === '') {
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

  const normalizedPageFolderId = normalizePageFolderId(pageData.page_folder_id);
  const normalizedPageData: CreatePageData = {
    ...pageData,
    page_folder_id: normalizedPageFolderId,
  };

  // Check if trying to create a dynamic page in a folder that already has one
  if (normalizedPageData.is_dynamic) {
    let dynamicQuery = client
      .from('pages')
      .select('id, name')
      .eq('is_dynamic', true)
      .eq('is_published', normalizedPageData.is_published || false)
      .is('deleted_at', null);

    if (normalizedPageFolderId === null) {
      dynamicQuery = dynamicQuery.is('page_folder_id', null);
    } else {
      dynamicQuery = dynamicQuery.eq('page_folder_id', normalizedPageFolderId);
    }

    const { data: existingDynamicPages, error: checkError } = await dynamicQuery;

    if (checkError) {
      throw new Error(`Failed to check for existing dynamic pages: ${checkError.message}`);
    }

    if (existingDynamicPages && existingDynamicPages.length > 0) {
      const folderName = normalizedPageFolderId ? 'this folder' : 'the root folder';
      throw new Error(`A dynamic page already exists in ${folderName}. Each folder can only contain one dynamic page.`);
    }
  }

  // Validate index page constraints (no current page data for new pages)
  await validateIndexPageConstraints(
    client,
    {
      is_index: normalizedPageData.is_index || false,
      slug: normalizedPageData.slug,
      page_folder_id: normalizedPageFolderId,
      error_page: normalizedPageData.error_page,
      is_dynamic: normalizedPageData.is_dynamic || false,
    },
    undefined,
    undefined
  );

  // Calculate content hash for page metadata
  const contentHash = generatePageMetadataHash({
    name: normalizedPageData.name,
    slug: normalizedPageData.slug,
    settings: normalizedPageData.settings || {},
    is_index: normalizedPageData.is_index || false,
    is_dynamic: normalizedPageData.is_dynamic || false,
    error_page: normalizedPageData.error_page || null,
  });

  // Remove any content_hash from pageData to prevent override
  const { content_hash: _, ...pageDataWithoutHash } = normalizedPageData as any;

  // Merge page data with any additional fields and our calculated content hash
  const insertData = {
    ...(additionalData || {}),
    ...pageDataWithoutHash,
    content_hash: contentHash,
  };

  const { data, error } = await client
    .from('pages')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create page: ${error.message}`);
  }

  // If setting as index page, transfer from existing index page
  if (normalizedPageData.is_index) {
    await transferIndexPage(client, data.id, normalizedPageFolderId, normalizedPageData.is_published || false);
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

  // Get current draft page data to merge with updates for validation
  // Repository update functions always update draft versions (users edit drafts)
  const currentPage = await getPageById(id, false);
  if (!currentPage) {
    throw new Error('Page not found');
  }

  const normalizedUpdates: UpdatePageData =
    updates.page_folder_id !== undefined
      ? {
        ...updates,
        page_folder_id: normalizePageFolderId(updates.page_folder_id),
      }
      : updates;

  // Merge current data with updates for validation
  const mergedData = {
    is_index: normalizedUpdates.is_index !== undefined ? normalizedUpdates.is_index : currentPage.is_index,
    slug: normalizedUpdates.slug !== undefined ? normalizedUpdates.slug : currentPage.slug,
    page_folder_id: normalizedUpdates.page_folder_id !== undefined ? normalizedUpdates.page_folder_id : currentPage.page_folder_id,
    error_page: normalizedUpdates.error_page !== undefined ? normalizedUpdates.error_page : currentPage.error_page,
    is_dynamic: normalizedUpdates.is_dynamic !== undefined ? normalizedUpdates.is_dynamic : currentPage.is_dynamic,
  };

  // Check if trying to make a page dynamic or move a dynamic page to a folder that already has one
  const targetFolderId = normalizedUpdates.page_folder_id !== undefined ? normalizedUpdates.page_folder_id : currentPage.page_folder_id;
  const willBeDynamic = normalizedUpdates.is_dynamic !== undefined ? normalizedUpdates.is_dynamic : currentPage.is_dynamic;
  const isBecomingDynamic = normalizedUpdates.is_dynamic === true && !currentPage.is_dynamic;
  const isMovingDynamicPage = currentPage.is_dynamic && normalizedUpdates.page_folder_id !== undefined && normalizedUpdates.page_folder_id !== currentPage.page_folder_id;

  if (willBeDynamic && (isBecomingDynamic || isMovingDynamicPage)) {
    let existingDynamicPagesQuery = client
      .from('pages')
      .select('id, name')
      .eq('is_dynamic', true)
      .eq('is_published', currentPage.is_published)
      .neq('id', id) // Exclude current page
      .is('deleted_at', null);

    if (targetFolderId === null) {
      existingDynamicPagesQuery = existingDynamicPagesQuery.is('page_folder_id', null);
    } else {
      existingDynamicPagesQuery = existingDynamicPagesQuery.eq('page_folder_id', targetFolderId);
    }

    const { data: existingDynamicPages, error: checkError } = await existingDynamicPagesQuery;

    if (checkError) {
      throw new Error(`Failed to check for existing dynamic pages: ${checkError.message}`);
    }

    if (existingDynamicPages && existingDynamicPages.length > 0) {
      const folderName = targetFolderId ? 'this folder' : 'the root folder';
      throw new Error(`A dynamic page already exists in ${folderName}. Each folder can only contain one dynamic page.`);
    }
  }

  // Validate index page constraints if is_index or slug is being updated
  if (normalizedUpdates.is_index !== undefined || normalizedUpdates.slug !== undefined || normalizedUpdates.page_folder_id !== undefined) {
    await validateIndexPageConstraints(
      client,
      mergedData,
      id,
      { is_index: currentPage.is_index, page_folder_id: currentPage.page_folder_id }
    );
  }

  // If setting as index page (and wasn't before), transfer from existing index page
  // Use the TARGET page_folder_id (where the page will be) to find the existing index
  const isBecomingIndex = normalizedUpdates.is_index === true && !currentPage.is_index;

  if (isBecomingIndex) {
    const folderIdForTransfer = normalizedUpdates.page_folder_id !== undefined ? normalizedUpdates.page_folder_id : currentPage.page_folder_id;

    // FIRST: Clean up any orphaned pages with empty slugs that are NOT index pages
    // This can happen if a previous operation failed mid-way
    const { data: orphanedPages } = await client
      .from('pages')
      .select('id, name, slug, is_index, page_folder_id')
      .eq('slug', '')
      .eq('is_index', false)
      .is('deleted_at', null);

    if (orphanedPages && orphanedPages.length > 0) {
      // Fix all orphaned pages in a single batch operation
      await fixOrphanedPageSlugs(orphanedPages);
    }

    await transferIndexPage(client, id, folderIdForTransfer, currentPage.is_published);
  }

  // Calculate new content hash based on merged data
  const finalData = {
    name: normalizedUpdates.name !== undefined ? normalizedUpdates.name : currentPage.name,
    slug: normalizedUpdates.slug !== undefined ? normalizedUpdates.slug : currentPage.slug,
    settings: normalizedUpdates.settings !== undefined ? normalizedUpdates.settings : currentPage.settings,
    is_index: normalizedUpdates.is_index !== undefined ? normalizedUpdates.is_index : currentPage.is_index,
    is_dynamic: normalizedUpdates.is_dynamic !== undefined ? normalizedUpdates.is_dynamic : currentPage.is_dynamic,
    error_page: normalizedUpdates.error_page !== undefined ? normalizedUpdates.error_page : currentPage.error_page,
  };

  const contentHash = generatePageMetadataHash(finalData);

  // Remove any content_hash from updates to prevent override, then add our calculated one
  const { content_hash: _, ...updatesWithoutHash } = normalizedUpdates as any;

  const updatesWithHash = {
    ...updatesWithoutHash,
    content_hash: contentHash,
  };

  // Repository update functions always update DRAFT versions (users edit drafts)
  const { data, error } = await client
    .from('pages')
    .update(updatesWithHash)
    .eq('id', id)
    .eq('is_published', false)
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

  // Update each page's order (drafts only - users edit drafts)
  const promises = updates.map(({ id, order }) =>
    client
      .from('pages')
      .update({ order })
      .eq('id', id)
      .eq('is_published', false)
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

  // Get the draft page before deletion to know its parent_id and depth
  // Repository delete functions always delete draft versions
  const pageToDelete = await getPageById(id, false);
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

  // Soft-delete draft page layers (publishing service will handle published versions)
  const { error: layersError } = await client
    .from('page_layers')
    .update({ deleted_at: deletedAt })
    .eq('page_id', id)
    .eq('is_published', false)
    .is('deleted_at', null);

  if (layersError) {
    throw new Error(`Failed to delete page layers: ${layersError.message}`);
  }

  // Soft-delete the draft page (publishing service will handle published version)
  const { error } = await client
    .from('pages')
    .update({ deleted_at: deletedAt })
    .eq('id', id)
    .eq('is_published', false)
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

  // Restore draft page (publishing service will handle published version)
  const { error } = await client
    .from('pages')
    .update({ deleted_at: null })
    .eq('id', id)
    .eq('is_published', false)
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
 * Get published pages by IDs
 * Used for batch publishing optimization
 */
export async function getPublishedPagesByIds(ids: string[]): Promise<Page[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('pages')
    .select('*')
    .in('id', ids)
    .eq('is_published', true)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch published pages: ${error.message}`);
  }

  return data || [];
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

  // Get the original draft page
  const originalPage = await getPageById(pageId, false);
  if (!originalPage) {
    throw new Error('Page not found');
  }

  // Dynamic pages cannot be duplicated
  if (originalPage.is_dynamic) {
    throw new Error('Dynamic pages cannot be duplicated');
  }

  const newName = `${originalPage.name} (Copy)`;

  // Generate base slug from the new name
  const baseSlug = newName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Get all existing slugs in the same folder to find a unique one
  let query = client
    .from('pages')
    .select('slug')
    .eq('is_published', false)
    .is('error_page', null)
    .is('deleted_at', null);

  // Handle null parent folder properly
  if (originalPage.page_folder_id === null) {
    query = query.is('page_folder_id', null);
  } else {
    query = query.eq('page_folder_id', originalPage.page_folder_id);
  }

  const { data: existingPages } = await query;

  const existingSlugs = (existingPages || []).map(p => p.slug.toLowerCase());

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

  // Place the duplicate right after the original page
  const newOrder = originalPage.order + 1;

  // Increment order for all siblings (pages and folders) that come after the original page
  await incrementSiblingOrders(newOrder, originalPage.depth, originalPage.page_folder_id);

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
      });

    if (newLayersError) {
      // If layer duplication fails, we should still return the page
      // but log the error
      console.error('Failed to duplicate layers:', newLayersError);
    }
  }

  return newPage;
}

/**
 * Get count of unpublished pages
 * A page needs publishing if:
 * - It has is_published: false (never published), OR
 * - Its draft layers differ from published layers (needs republishing)
 */
export async function getUnpublishedPagesCount(): Promise<number> {
  const pages = await getUnpublishedPages();
  return pages.length;
}

/**
 * Get all unpublished pages
 * A page needs publishing if:
 * - It has is_published: false (never published), OR
 * - Its draft content differs from published content (needs republishing)
 *
 * Uses content_hash for efficient change detection
 */
export async function getUnpublishedPages(): Promise<Page[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Get all draft pages with their layers' content_hash in a single efficient query
  const { data: draftPagesWithLayers, error } = await client
    .from('pages')
    .select(`
      *,
      page_layers!inner(content_hash)
    `)
    .eq('is_published', false)
    .eq('page_layers.is_published', false)
    .is('deleted_at', null)
    .is('page_layers.deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch draft pages: ${error.message}`);
  }

  if (!draftPagesWithLayers || draftPagesWithLayers.length === 0) {
    return [];
  }

  const unpublishedPages: Page[] = [];

  // Check each draft page
  for (const draftPage of draftPagesWithLayers) {
    // Check if a published version exists
    const { data: publishedPageWithLayers } = await client
      .from('pages')
      .select(`
        id,
        content_hash,
        page_folder_id,
        page_layers!inner(content_hash)
      `)
      .eq('id', draftPage.id)
      .eq('is_published', true)
      .eq('page_layers.is_published', true)
      .is('deleted_at', null)
      .is('page_layers.deleted_at', null)
      .single();

    // If no published version exists, needs first-time publishing
    if (!publishedPageWithLayers) {
      unpublishedPages.push(draftPage);
      continue;
    }

    // Compare content hashes - check both page metadata and layers
    // Only compare if both hashes exist (not null)
    const pageMetadataChanged =
      draftPage.content_hash && publishedPageWithLayers.content_hash
        ? draftPage.content_hash !== publishedPageWithLayers.content_hash
        : false; // If either is null, consider them the same (no change)

    const layersChanged =
      draftPage.page_layers[0]?.content_hash && publishedPageWithLayers.page_layers[0]?.content_hash
        ? draftPage.page_layers[0].content_hash !== publishedPageWithLayers.page_layers[0].content_hash
        : false; // If either is null, consider them the same (no change)

    // Check if page was moved to a different folder
    const folderChanged = draftPage.page_folder_id !== publishedPageWithLayers.page_folder_id;

    // If any of these changed, needs republishing
    if (pageMetadataChanged || layersChanged || folderChanged) {
      unpublishedPages.push(draftPage);
    }
  }

  return unpublishedPages;
}
