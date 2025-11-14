/**
 * Page Service
 *
 * Business logic layer for page and folder operations.
 * Coordinates between repositories and handles complex operations.
 *
 * ⚠️ Server-side only - contains database operations
 */

import { getKnexClient } from '../knex-client';
import { getPageById, getPublishedPageByPublishKey, createPage, updatePage } from '../repositories/pageRepository';
import { publishPageLayers, getDraftLayers } from '../repositories/pageLayersRepository';
import type { Page } from '@/types';

/**
 * Helper: Generate a unique slug from a page name
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
 * Increment order for all sibling items (pages and folders) at a given position
 *
 * This is used during duplication operations to make space for the new item.
 * For example, if duplicating a page at order 2, all siblings with order >= 2
 * will be incremented to order 3, 4, 5, etc.
 *
 * Uses raw SQL for efficient bulk updates - updates both pages and folders
 * in the same parent with a single query each.
 *
 * @param startOrder - The order position to start incrementing from (inclusive)
 * @param depth - The depth level of the siblings to update
 * @param parentFolderId - The parent folder ID (null for root level)
 * @throws Error if the database update fails
 *
 * @example
 * // Make space at position 3 in the root folder
 * await incrementSiblingOrders(3, 0, null);
 *
 * @example
 * // Make space at position 5 in a specific folder
 * await incrementSiblingOrders(5, 1, 'folder-uuid');
 */
export async function incrementSiblingOrders(
  startOrder: number,
  depth: number,
  parentFolderId: string | null
): Promise<void> {
  const knex = await getKnexClient();

  try {
    // Update pages - single query to increment all matching rows
    if (parentFolderId === null) {
      await knex.raw(`
        UPDATE pages
        SET "order" = "order" + 1
        WHERE "order" >= ?
          AND depth = ?
          AND page_folder_id IS NULL
          AND deleted_at IS NULL
      `, [startOrder, depth]);
    } else {
      await knex.raw(`
        UPDATE pages
        SET "order" = "order" + 1
        WHERE "order" >= ?
          AND depth = ?
          AND page_folder_id = ?
          AND deleted_at IS NULL
      `, [startOrder, depth, parentFolderId]);
    }

    // Update folders - single query to increment all matching rows
    if (parentFolderId === null) {
      await knex.raw(`
        UPDATE page_folders
        SET "order" = "order" + 1
        WHERE "order" >= ?
          AND depth = ?
          AND page_folder_id IS NULL
          AND deleted_at IS NULL
      `, [startOrder, depth]);
    } else {
      await knex.raw(`
        UPDATE page_folders
        SET "order" = "order" + 1
        WHERE "order" >= ?
          AND depth = ?
          AND page_folder_id = ?
          AND deleted_at IS NULL
      `, [startOrder, depth, parentFolderId]);
    }
  } catch (error) {
    throw new Error(`Failed to increment sibling orders: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fix orphaned pages by assigning them unique slugs
 *
 * Orphaned pages have empty slugs and are not index pages. This can happen
 * when operations fail mid-way. This function efficiently fixes all orphaned
 * pages by:
 * 1. Fetching all existing slugs once for duplicate checking
 * 2. Generating unique slugs for all orphaned pages
 * 3. Batch updating all pages at once
 *
 * @param orphanedPages - Array of orphaned page records to fix
 * @throws Error if the database update fails
 */
export async function fixOrphanedPageSlugs(
  orphanedPages: Array<{ id: string; name: string; slug: string; is_index: boolean; page_folder_id: string | null }>
): Promise<void> {
  if (orphanedPages.length === 0) return;

  const knex = await getKnexClient();

  try {
    // Fetch all existing slugs once for duplicate checking
    const existingSlugs = await knex('pages')
      .select('slug')
      .whereNotNull('slug')
      .whereNot('slug', '')
      .whereNull('deleted_at')
      .then(rows => new Set(rows.map(r => r.slug)));

    // Generate unique slugs for all orphaned pages
    const updates: Array<{ id: string; slug: string }> = [];
    const timestamp = Date.now();

    for (const orphan of orphanedPages) {
      let newSlug = generateSlugFromName(orphan.name, timestamp + updates.length);

      // Ensure uniqueness
      let counter = 0;
      while (existingSlugs.has(newSlug) || updates.some(u => u.slug === newSlug)) {
        newSlug = `${generateSlugFromName(orphan.name, timestamp + updates.length)}-${counter}`;
        counter++;
      }

      updates.push({ id: orphan.id, slug: newSlug });
      existingSlugs.add(newSlug); // Mark as used
    }

    // Batch update all orphaned pages using CASE statement for efficiency
    if (updates.length > 0) {
      const caseStatements = updates.map(() =>
        `WHEN id = ? THEN ?`
      ).join(' ');

      const values = updates.flatMap(u => [u.id, u.slug]);
      const idPlaceholders = updates.map(() => '?').join(', ');

      await knex.raw(`
        UPDATE pages
        SET slug = CASE ${caseStatements} END,
            updated_at = NOW()
        WHERE id IN (${idPlaceholders})
      `, [...values, ...updates.map(u => u.id)]);
    }
  } catch (error) {
    throw new Error(`Failed to fix orphaned page slugs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Publish specified pages
 * Creates/updates separate published versions while keeping drafts unchanged
 *
 * @param pageIds - Array of draft page IDs to publish
 * @returns Object with count of published pages
 */
export async function publishPages(pageIds: string[]): Promise<{ count: number }> {
  if (pageIds.length === 0) {
    return { count: 0 };
  }

  // Import folder functions
  const { getPageFolderById, createPageFolder, updatePageFolder, getPublishedPageFolderByPublishKey } = await import('../repositories/pageFolderRepository');

  // Collect all unique folders that need to be published
  const folderPublishKeysToPublish = new Set<string>();
  const draftFolderIdToPublishKey = new Map<string, string>();

  // First pass: identify all folders that need publishing
  for (const draftPageId of pageIds) {
    try {
      const draftPage = await getPageById(draftPageId);
      if (!draftPage || draftPage.deleted_at) {
        continue;
      }

      // Collect all ancestor folders
      let currentFolderId = draftPage.page_folder_id;
      while (currentFolderId) {
        const folder = await getPageFolderById(currentFolderId);
        if (folder && !folder.deleted_at) {
          folderPublishKeysToPublish.add(folder.publish_key);
          draftFolderIdToPublishKey.set(folder.id, folder.publish_key);
          currentFolderId = folder.page_folder_id;
        } else {
          break;
        }
      }
    } catch (error) {
      console.error(`Error collecting folders for page ${draftPageId}:`, error);
    }
  }

  // Map to store draft folder ID → published folder ID
  const draftToPublishedFolderIds = new Map<string, string>();

  // Publish all required folders
  for (const publishKey of folderPublishKeysToPublish) {
    try {
      // Get draft folder by publish_key
      const { getPageFolderByPublishKey } = await import('../repositories/pageFolderRepository');
      const draftFolder = await getPageFolderByPublishKey(publishKey);

      if (!draftFolder || draftFolder.deleted_at) {
        continue;
      }

      // Check if published version exists
      const existingPublishedFolder = await getPublishedPageFolderByPublishKey(publishKey);

      // Resolve parent folder reference - use published folder ID if parent is being published
      const publishedParentFolderId = draftFolder.page_folder_id
        ? draftToPublishedFolderIds.get(draftFolder.page_folder_id) || draftFolder.page_folder_id
        : null;

      if (existingPublishedFolder) {
        // Update existing published folder
        await updatePageFolder(existingPublishedFolder.id, {
          name: draftFolder.name,
          slug: draftFolder.slug,
          page_folder_id: publishedParentFolderId,
          order: draftFolder.order,
          depth: draftFolder.depth,
          settings: draftFolder.settings,
        });
        draftToPublishedFolderIds.set(draftFolder.id, existingPublishedFolder.id);
      } else {
        // Create new published folder
        const publishedFolder = await createPageFolder({
          name: draftFolder.name,
          slug: draftFolder.slug,
          is_published: true,
          publish_key: draftFolder.publish_key,
          page_folder_id: publishedParentFolderId,
          order: draftFolder.order,
          depth: draftFolder.depth,
          settings: draftFolder.settings,
        });
        draftToPublishedFolderIds.set(draftFolder.id, publishedFolder.id);
      }
    } catch (error) {
      console.error(`Error publishing folder with publish_key ${publishKey}:`, error);
    }
  }

  // Now publish the pages
  let publishedCount = 0;

  for (const draftPageId of pageIds) {
    try {
      // Get the draft page
      const draftPage = await getPageById(draftPageId);
      if (!draftPage || draftPage.deleted_at) {
        console.warn(`Draft page ${draftPageId} not found or deleted, skipping`);
        continue;
      }

      // Check if published version already exists
      const existingPublishedPage = await getPublishedPageByPublishKey(draftPage.publish_key);

      // Resolve folder reference - use published folder ID if folder was published
      const publishedFolderId = draftPage.page_folder_id
        ? draftToPublishedFolderIds.get(draftPage.page_folder_id) || draftPage.page_folder_id
        : null;

      let publishedPageId: string;

      if (existingPublishedPage) {
        // Update existing published page
        await updatePage(existingPublishedPage.id, {
          name: draftPage.name,
          slug: draftPage.slug,
          page_folder_id: publishedFolderId,
          order: draftPage.order,
          depth: draftPage.depth,
          is_index: draftPage.is_index,
          is_dynamic: draftPage.is_dynamic,
          error_page: draftPage.error_page,
          settings: draftPage.settings,
          content_hash: draftPage.content_hash, // Copy hash for change detection
        });
        publishedPageId = existingPublishedPage.id;
      } else {
        // Create new published page with same publish_key
        const publishedPage = await createPage({
          name: draftPage.name,
          slug: draftPage.slug,
          is_published: true,
          publish_key: draftPage.publish_key,
          page_folder_id: publishedFolderId,
          order: draftPage.order,
          depth: draftPage.depth,
          is_index: draftPage.is_index,
          is_dynamic: draftPage.is_dynamic,
          error_page: draftPage.error_page,
          settings: draftPage.settings,
          content_hash: draftPage.content_hash, // Copy hash for change detection
        });
        publishedPageId = publishedPage.id;
      }

      // Publish the layers (copy draft → published)
      await publishPageLayers(draftPageId, publishedPageId);

      publishedCount++;
    } catch (error) {
      console.error(`Error publishing page ${draftPageId}:`, error);
      // Continue with other pages
    }
  }

  return { count: publishedCount };
}

