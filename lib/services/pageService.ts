/**
 * Page Service
 *
 * Business logic layer for page and folder operations.
 * Coordinates between repositories and handles complex operations.
 *
 * ⚠️ Server-side only - contains database operations
 */

import { getKnexClient } from '../knex-client';

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
      const caseStatements = updates.map((u, idx) =>
        `WHEN id = $${idx * 2 + 1} THEN $${idx * 2 + 2}`
      ).join(' ');

      const values = updates.flatMap(u => [u.id, u.slug]);

      await knex.raw(`
        UPDATE pages
        SET slug = CASE ${caseStatements} END,
            updated_at = NOW()
        WHERE id IN (${updates.map((_, idx) => `$${idx * 2 + 1}`).join(', ')})
      `, values);
    }
  } catch (error) {
    throw new Error(`Failed to fix orphaned page slugs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

