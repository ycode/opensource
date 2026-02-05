/**
 * Folder Service
 *
 * Business logic for page folder operations
 */

import { getSupabaseAdmin } from '../supabase-server';
import type { PageFolder } from '@/types';

/**
 * Result of folder publishing operation
 */
export interface PublishFoldersResult {
  count: number;
}

/**
 * Collect ancestor folder IDs for given page folder IDs
 * Traverses up the folder tree to ensure all parent folders are published
 */
async function collectAncestorFolderIds(
  pageIds: string[],
  client: any
): Promise<Set<string>> {
  const folderIdsToPublish = new Set<string>();

  // Fetch pages to get their folder IDs
  const { data: pagesToPublish } = await client
    .from('pages')
    .select('page_folder_id')
    .in('id', pageIds)
    .eq('is_published', false)
    .is('deleted_at', null);

  if (!pagesToPublish) {
    return folderIdsToPublish;
  }

  // Get all draft folders to traverse ancestors
  const { data: allDraftFolders } = await client
    .from('page_folders')
    .select('*')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (!allDraftFolders) {
    return folderIdsToPublish;
  }

  const foldersById = new Map<string, PageFolder>(
    allDraftFolders.map((f: PageFolder) => [f.id, f])
  );

  // Collect all ancestor folder IDs
  const collectAncestors = (folderId: string | null): void => {
    if (!folderId) return;
    const folder = foldersById.get(folderId);
    if (folder) {
      folderIdsToPublish.add(folder.id);
      collectAncestors(folder.page_folder_id);
    }
  };

  for (const page of pagesToPublish) {
    if (page.page_folder_id) {
      collectAncestors(page.page_folder_id);
    }
  }

  return folderIdsToPublish;
}

/**
 * Publish folders by their IDs
 * Handles soft-deleted folders and sorts by depth to ensure parents are published first
 *
 * @param folderIds - Array of folder IDs to publish (empty array = publish all)
 * @param pageIds - Optional array of page IDs to collect ancestor folders from
 * @returns Number of folders published
 */
export async function publishFolders(
  folderIds: string[] = [],
  pageIds?: string[]
): Promise<PublishFoldersResult> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const isPublishingAll = folderIds.length === 0;
  const folderIdsToPublish = new Set<string>(folderIds);

  // Collect ancestor folders if page IDs provided
  if (!isPublishingAll && pageIds && pageIds.length > 0) {
    const ancestorIds = await collectAncestorFolderIds(pageIds, client);
    ancestorIds.forEach(id => folderIdsToPublish.add(id));
  }

  // Skip if no folders to publish
  if (!isPublishingAll && folderIdsToPublish.size === 0) {
    return { count: 0 };
  }

  // Get all draft folders (including soft-deleted for cleanup)
  const { data: allDraftFolders, error: foldersError } = await client
    .from('page_folders')
    .select('*')
    .eq('is_published', false);

  if (foldersError || !allDraftFolders) {
    throw new Error(`Failed to fetch folders: ${foldersError?.message}`);
  }

  // Filter folders based on request
  const foldersToProcess = isPublishingAll
    ? allDraftFolders
    : allDraftFolders.filter((f: PageFolder) => folderIdsToPublish.has(f.id));

  // Separate active and soft-deleted folders
  const activeFolders = foldersToProcess.filter((f: PageFolder) => f.deleted_at === null);
  const softDeletedFolders = foldersToProcess.filter((f: PageFolder) => f.deleted_at !== null);

  // Get existing published folders (need full data to verify parent relationships)
  const folderIdsToCheck = foldersToProcess.map((f: PageFolder) => f.id);
  
  // Also get all parent folder IDs that we might need to reference
  const parentFolderIds = new Set<string>();
  foldersToProcess.forEach((f: PageFolder) => {
    if (f.page_folder_id) {
      parentFolderIds.add(f.page_folder_id);
    }
  });
  
  const allIdsToCheck = [...new Set([...folderIdsToCheck, ...parentFolderIds])];

  // Fetch all published folders we need to reference
  const { data: existingPublished } = await client
    .from('page_folders')
    .select('*')
    .eq('is_published', true)
    .in('id', allIdsToCheck);

  const publishedFoldersById = new Map<string, PageFolder>(
    (existingPublished || []).map((f: PageFolder) => [f.id, f])
  );
  const publishedIds = new Set(publishedFoldersById.keys());

  if (folderIdsToCheck.length > 0) {
    // Soft-delete published versions of soft-deleted drafts
    const idsToSoftDelete = softDeletedFolders
      .filter((f: PageFolder) => publishedIds.has(f.id))
      .map((f: PageFolder) => f.id);

    if (idsToSoftDelete.length > 0) {
      await client
        .from('page_folders')
        .update({ deleted_at: new Date().toISOString() })
        .eq('is_published', true)
        .in('id', idsToSoftDelete)
        .is('deleted_at', null);
    }
  }

  // Sort active folders by depth (parents first)
  const sortedFolders = [...activeFolders].sort(
    (a: PageFolder, b: PageFolder) => (a.depth || 0) - (b.depth || 0)
  );

  // Track folders being published in this batch
  const foldersBeingPublished = new Set<string>();

  // Prepare folders to upsert, resolving parent folder IDs to published versions
  const foldersToUpsert: Array<{
    id: string;
    name: string;
    slug: string;
    page_folder_id: string | null;
    order: number | null;
    depth: number;
    settings: PageFolder['settings'];
    is_published: boolean;
  }> = [];

  for (const folder of sortedFolders) {
    let publishedParentId: string | null = null;
    
    if (folder.page_folder_id) {
      // Check if parent is already published or being published in this batch
      const parentIsPublished = publishedFoldersById.has(folder.page_folder_id);
      const parentIsInBatch = foldersBeingPublished.has(folder.page_folder_id);
      
      if (!parentIsPublished && !parentIsInBatch) {
        // Parent folder is not published and not in this batch - skip this folder
        console.warn(
          `Parent folder ${folder.page_folder_id} is not published, skipping folder ${folder.id}`
        );
        continue;
      }
      
      // Use the same ID since published folders share the same ID as drafts
      publishedParentId = folder.page_folder_id;
    }
    
    foldersBeingPublished.add(folder.id);
    
    foldersToUpsert.push({
      id: folder.id,
      name: folder.name,
      slug: folder.slug,
      page_folder_id: publishedParentId,
      order: folder.order,
      depth: folder.depth,
      settings: folder.settings,
      is_published: true,
    });
  }

  if (foldersToUpsert.length === 0) {
    return { count: 0 };
  }

  const { error: upsertError } = await client
    .from('page_folders')
    .upsert(foldersToUpsert, { onConflict: 'id,is_published' });

  if (upsertError) {
    throw new Error(`Failed to publish folders: ${upsertError.message}`);
  }

  return { count: foldersToUpsert.length };
}
