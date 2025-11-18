/**
 * Page Service
 *
 * Business logic layer for page and folder operations.
 * Coordinates between repositories and handles complex operations.
 *
 * ⚠️ Server-side only - contains database operations
 */

import { getKnexClient } from '../knex-client';
import { getPublishedPagesByIds } from '../repositories/pageRepository';
import { publishPageLayers } from '../repositories/pageLayersRepository';
import { getSupabaseAdmin } from '../supabase-server';

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
  const {
    getAllDraftPageFolders,
    getPublishedPageFoldersByIds,
  } = await import('../repositories/pageFolderRepository');

  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Step 1: Batch fetch all draft pages in a single query
  const { data: draftPagesData, error: pagesError } = await client
    .from('pages')
    .select('*')
    .in('id', pageIds)
    .eq('is_published', false)
    .is('deleted_at', null);

  if (pagesError) {
    throw new Error(`Failed to fetch draft pages: ${pagesError.message}`);
  }

  // Filter valid draft pages
  const validDraftPages = (draftPagesData || []).filter(
    (page) => !page.deleted_at && !page.is_published
  );

  if (validDraftPages.length === 0) {
    return { count: 0 };
  }

  // Step 2: Collect all unique folder IDs from pages
  const folderIdsFromPages = new Set<string>();
  for (const page of validDraftPages) {
    if (page.page_folder_id) {
      folderIdsFromPages.add(page.page_folder_id);
    }
  }

  // Step 3: Fetch all draft folders and build lookup map
  const allDraftFolders = await getAllDraftPageFolders();
  const draftFoldersById = new Map<string, typeof allDraftFolders[0]>();
  for (const folder of allDraftFolders) {
    draftFoldersById.set(folder.id, folder);
  }

  // Step 4: Collect all ancestor folders that need publishing (traverse in memory)
  const folderIdsToPublish = new Set<string>();

  const collectAncestors = (folderId: string | null) => {
    if (!folderId) return;
    const folder = draftFoldersById.get(folderId);
    if (folder && !folder.deleted_at && !folder.is_published) {
      folderIdsToPublish.add(folder.id);
      collectAncestors(folder.page_folder_id);
    }
  };

  for (const folderId of folderIdsFromPages) {
    collectAncestors(folderId);
  }

  // Step 5: Batch fetch published folders and pages for lookups
  const folderIdsArray = Array.from(folderIdsToPublish);
  const pageIdsArray = validDraftPages.map((p) => p.id);

  const [publishedFolders, publishedPages] = await Promise.all([
    folderIdsArray.length > 0
      ? getPublishedPageFoldersByIds(folderIdsArray)
      : Promise.resolve([]),
    pageIdsArray.length > 0
      ? getPublishedPagesByIds(pageIdsArray)
      : Promise.resolve([]),
  ]);

  // Build lookup maps
  const publishedFoldersById = new Map<string, typeof publishedFolders[0]>();
  for (const folder of publishedFolders) {
    publishedFoldersById.set(folder.id, folder);
  }

  const publishedPagesById = new Map<string, typeof publishedPages[0]>();
  for (const page of publishedPages) {
    publishedPagesById.set(page.id, page);
  }

  // Step 6: Prepare folders to publish (sorted by depth - parents first)
  const foldersToPublish = folderIdsArray
    .map((id) => draftFoldersById.get(id))
    .filter(
      (folder): folder is NonNullable<typeof folder> =>
        folder !== undefined && !folder.deleted_at && !folder.is_published
    )
    .sort((a, b) => a.depth - b.depth);

  // Step 7: Publish folders using upsert
  const foldersToUpsert: any[] = [];

  for (const draftFolder of foldersToPublish) {
    // Ensure parent folder is published
    let publishedParentId: string | null = null;
    if (draftFolder.page_folder_id) {
      const publishedParent = publishedFoldersById.get(draftFolder.page_folder_id);
      if (!publishedParent) {
        console.warn(
          `Parent folder ${draftFolder.page_folder_id} is not published, skipping folder ${draftFolder.id}`
        );
        continue;
      }
      publishedParentId = publishedParent.id;
    }

    foldersToUpsert.push({
      id: draftFolder.id,
      name: draftFolder.name,
      slug: draftFolder.slug,
      page_folder_id: publishedParentId,
      order: draftFolder.order,
      depth: draftFolder.depth,
      settings: draftFolder.settings,
      is_published: true,
      updated_at: new Date().toISOString(),
    });
  }

  // Batch upsert folders
  if (foldersToUpsert.length > 0) {
    await client
      .from('page_folders')
      .upsert(foldersToUpsert, {
        onConflict: 'id,is_published',
      });
  }

  // Step 8: Publish pages using upsert (only pages that changed or are new)
  const pagesToUpsert: any[] = [];

  for (const draftPage of validDraftPages) {
    // Ensure parent folder is published
    let publishedParentId: string | null = null;
    if (draftPage.page_folder_id) {
      const publishedParent = publishedFoldersById.get(draftPage.page_folder_id);
      if (!publishedParent) {
        console.warn(
          `Parent folder ${draftPage.page_folder_id} is not published, skipping page ${draftPage.id}`
        );
        continue;
      }
      publishedParentId = publishedParent.id;
    }

    const existingPublished = publishedPagesById.get(draftPage.id);

    // Only include if new or content_hash changed
    if (!existingPublished || existingPublished.content_hash !== draftPage.content_hash) {
      pagesToUpsert.push({
        id: draftPage.id,
        name: draftPage.name,
        slug: draftPage.slug,
        page_folder_id: publishedParentId,
        order: draftPage.order,
        depth: draftPage.depth,
        is_index: draftPage.is_index,
        is_dynamic: draftPage.is_dynamic,
        error_page: draftPage.error_page,
        settings: draftPage.settings,
        content_hash: draftPage.content_hash,
        is_published: true,
        updated_at: new Date().toISOString(),
      });
    }
  }

  // Batch upsert pages
  if (pagesToUpsert.length > 0) {
    const { error: upsertError } = await client
      .from('pages')
      .upsert(pagesToUpsert, {
        onConflict: 'id,is_published',
      });

    if (upsertError) {
      throw new Error(`Failed to upsert pages: ${upsertError.message}`);
    }
  }

  // Step 9: Publish page layers (can't batch due to individual logic in publishPageLayers)
  // Publish layers for all valid draft pages, even if the page itself hasn't changed
  let publishedCount = 0;
  for (const draftPage of validDraftPages) {
    try {
      // Skip if parent folder check failed earlier
      if (draftPage.page_folder_id) {
        const publishedParent = publishedFoldersById.get(draftPage.page_folder_id);
        if (!publishedParent) {
          continue;
        }
      }

      // Ensure page has a published version (either just upserted or already exists)
      const pageWasUpserted = pagesToUpsert.some(p => p.id === draftPage.id);
      const pageAlreadyPublished = publishedPagesById.has(draftPage.id);

      if (!pageWasUpserted && !pageAlreadyPublished) {
        // Page doesn't have a published version, skip layer publishing
        continue;
      }

      await publishPageLayers(draftPage.id, draftPage.id);
      publishedCount++;
    } catch (error) {
      console.error(`Error publishing layers for page ${draftPage.id}:`, error);
    }
  }

  return { count: publishedCount };
}
