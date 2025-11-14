/**
 * Publishing Service
 *
 * Handles publishing workflow where draft records remain unchanged
 * and published versions are created/updated with the same publish_key
 */

import {
  getAllDraftPages,
  getPublishedPagesByPublishKeys
} from '../repositories/pageRepository';
import {
  getDraftLayersForPages,
  getPublishedLayersByPublishKeys
} from '../repositories/pageLayersRepository';
import {
  getAllDraftPageFolders,
  getPublishedPageFoldersByPublishKeys
} from '../repositories/pageFolderRepository';
import { getSupabaseAdmin } from '../supabase-server';
import { getSettingByKey, setSetting } from '../repositories/settingsRepository';
import type { Page, PageLayers, PageFolder } from '../../types';

/**
 * Result of publishing operation
 */
export interface PublishResult {
  page: Page;
  layers: PageLayers;
}

/**
 * Overall publishing result with stats
 */
export interface PublishAllResult {
  published: PublishResult[];
  publishedFolders: PageFolder[];
  created: number;
  updated: number;
  unchanged: number;
}

/**
 * Publish all draft pages, folders, and layers
 * Optimized with batch queries to minimize database roundtrips
 *
 * Publishing order:
 * 1. Fetch all drafts (folders + pages + layers) in batch
 * 2. Fetch existing published versions in batch
 * 3. Publish folders (no dependencies, but pages depend on them)
 * 4. Publish pages (depends on folders via page_folder_id)
 * 5. Publish page layers (depends on pages via page_id)
 *
 * @returns Publishing results with statistics
 */
export async function publishAllPages(): Promise<PublishAllResult> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Step 1: Fetch all draft folders (including soft-deleted to handle deletions)
  const allDraftFolders = await getAllDraftPageFolders(true);

  // Separate active and soft-deleted draft folders
  const activeDraftFolders = allDraftFolders.filter(f => f.deleted_at === null);
  const softDeletedDraftFolders = allDraftFolders.filter(f => f.deleted_at !== null);

  const allFolderPublishKeys = allDraftFolders.map(f => f.publish_key);

  // Step 2: Fetch existing published folders in batch
  const existingPublishedFolders = await getPublishedPageFoldersByPublishKeys(allFolderPublishKeys);

  const publishedFoldersByKey = new Map<string, PageFolder>();
  existingPublishedFolders.forEach(folder => {
    publishedFoldersByKey.set(folder.publish_key, folder);
  });

  // Step 3: Soft-delete published versions of soft-deleted draft folders
  const deletedAt = new Date().toISOString();
  const foldersToSoftDelete: string[] = [];

  for (const softDeletedDraft of softDeletedDraftFolders) {
    const publishedFolder = publishedFoldersByKey.get(softDeletedDraft.publish_key);
    if (publishedFolder) {
      foldersToSoftDelete.push(publishedFolder.id);
    }
  }

  if (foldersToSoftDelete.length > 0) {
    await client
      .from('page_folders')
      .update({ deleted_at: deletedAt })
      .in('id', foldersToSoftDelete)
      .is('deleted_at', null);
  }

  // Step 4: Prepare folders to create/update (only for active drafts)
  // Sort by depth to process parent folders before children
  const sortedActiveDraftFolders = [...activeDraftFolders].sort((a, b) => (a.depth || 0) - (b.depth || 0));

  // Map to track draft folder ID → published folder ID
  const draftToPublishedFolderIds = new Map<string, string>();

  // First, populate map with existing published folders
  activeDraftFolders.forEach(draft => {
    const existing = publishedFoldersByKey.get(draft.publish_key);
    if (existing) {
      draftToPublishedFolderIds.set(draft.id, existing.id);
    }
  });

  const foldersToCreate: any[] = [];
  const foldersToUpdate: Array<{ id: string; updates: any }> = [];

  for (const draftFolder of sortedActiveDraftFolders) {
    const existingPublished = publishedFoldersByKey.get(draftFolder.publish_key);

    // Resolve parent folder reference to published ID
    const publishedParentFolderId = draftFolder.page_folder_id
      ? draftToPublishedFolderIds.get(draftFolder.page_folder_id) || draftFolder.page_folder_id
      : null;

    const publishedData = {
      name: draftFolder.name,
      slug: draftFolder.slug,
      page_folder_id: publishedParentFolderId,
      order: draftFolder.order,
      depth: draftFolder.depth,
      settings: draftFolder.settings,
      is_published: true,
      publish_key: draftFolder.publish_key,
    };

    if (existingPublished) {
      // Check if update is needed
      const hasChanges =
        existingPublished.name !== draftFolder.name ||
        existingPublished.slug !== draftFolder.slug ||
        existingPublished.page_folder_id !== publishedParentFolderId ||
        existingPublished.order !== draftFolder.order ||
        existingPublished.depth !== draftFolder.depth ||
        JSON.stringify(existingPublished.settings) !== JSON.stringify(draftFolder.settings);

      if (hasChanges) {
        foldersToUpdate.push({
          id: existingPublished.id,
          updates: publishedData,
        });
      }
    } else {
      foldersToCreate.push(publishedData);
    }
  }

  // Step 5: Batch create/update folders
  let createdFoldersCount = 0;
  let updatedFoldersCount = 0;

  if (foldersToCreate.length > 0) {
    const { data, error } = await client
      .from('page_folders')
      .insert(foldersToCreate)
      .select();

    if (error) {
      throw new Error(`Failed to create published folders: ${error.message}`);
    }

    createdFoldersCount = data?.length || 0;

    // Update map with newly created folders (match by publish_key)
    if (data) {
      data.forEach((publishedFolder: PageFolder) => {
        const draftFolder = sortedActiveDraftFolders.find(df => df.publish_key === publishedFolder.publish_key);
        if (draftFolder) {
          draftToPublishedFolderIds.set(draftFolder.id, publishedFolder.id);
        }
      });
    }
  }

  for (const { id, updates } of foldersToUpdate) {
    const { error } = await client
      .from('page_folders')
      .update(updates)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update published folder: ${error.message}`);
    }

    updatedFoldersCount++;
  }

  // Step 6: Fetch all draft pages (including soft-deleted to handle deletions)
  const allDraftPages = await getAllDraftPages(true);

  // Get ALL published folders for building complete paths during cache invalidation
  // We need all folders, not just those with draft versions, to correctly build nested paths
  const { getAllPublishedPageFolders } = await import('../repositories/pageFolderRepository');
  const finalPublishedFolders = await getAllPublishedPageFolders();

  if (allDraftPages.length === 0) {
    const totalFoldersCreated = createdFoldersCount;
    const totalFoldersUpdated = updatedFoldersCount;
    const totalFoldersUnchanged = activeDraftFolders.length - totalFoldersCreated - totalFoldersUpdated;

    return {
      published: [],
      publishedFolders: finalPublishedFolders,
      created: totalFoldersCreated,
      updated: totalFoldersUpdated,
      unchanged: totalFoldersUnchanged,
    };
  }

  // Separate active and soft-deleted drafts
  const activeDraftPages = allDraftPages.filter(p => p.deleted_at === null);
  const softDeletedDrafts = allDraftPages.filter(p => p.deleted_at !== null);

  const draftPageIds = activeDraftPages.map(p => p.id);
  const draftPagePublishKeys = activeDraftPages.map(p => p.publish_key);
  const allPublishKeys = allDraftPages.map(p => p.publish_key);

  // Step 7: Fetch all draft layers for these pages in one query
  const draftLayersArray = await getDraftLayersForPages(draftPageIds);
  const draftLayersByPageId = new Map<string, PageLayers>();
  draftLayersArray.forEach(layers => {
    draftLayersByPageId.set(layers.page_id, layers);
  });

  // Step 8: Fetch existing published pages and layers in batch (for all drafts including deleted)
  const [existingPublishedPages, existingPublishedLayers] = await Promise.all([
    getPublishedPagesByPublishKeys(allPublishKeys),
    getPublishedLayersByPublishKeys(draftLayersArray.map(l => l.publish_key)),
  ]);

  const publishedPagesByKey = new Map<string, Page>();
  existingPublishedPages.forEach(page => {
    publishedPagesByKey.set(page.publish_key, page);
  });

  const publishedLayersByKey = new Map<string, PageLayers>();
  existingPublishedLayers.forEach(layers => {
    publishedLayersByKey.set(layers.publish_key, layers);
  });

  // Step 9: Soft-delete published versions of soft-deleted drafts
  const pagesToSoftDelete: string[] = [];
  const layersToSoftDelete: string[] = [];

  for (const softDeletedDraft of softDeletedDrafts) {
    const publishedPage = publishedPagesByKey.get(softDeletedDraft.publish_key);
    if (publishedPage) {
      pagesToSoftDelete.push(publishedPage.id);

      // Also mark published layers for soft-delete
      const publishedLayers = existingPublishedLayers.find(
        l => l.page_id === publishedPage.id
      );
      if (publishedLayers) {
        layersToSoftDelete.push(publishedLayers.id);
      }
    }
  }

  // Soft-delete published pages
  if (pagesToSoftDelete.length > 0) {
    await client
      .from('pages')
      .update({ deleted_at: deletedAt })
      .in('id', pagesToSoftDelete)
      .is('deleted_at', null);
  }

  // Soft-delete published layers
  if (layersToSoftDelete.length > 0) {
    await client
      .from('page_layers')
      .update({ deleted_at: deletedAt })
      .in('id', layersToSoftDelete)
      .is('deleted_at', null);
  }

  // Step 10: Prepare pages to create/update (only for active drafts)
  const pagesToCreate: any[] = [];
  const pagesToUpdate: Array<{ id: string; updates: any }> = [];

  for (const draftPage of activeDraftPages) {
    const existingPublished = publishedPagesByKey.get(draftPage.publish_key);

    // Resolve folder reference to published ID
    const publishedFolderId = draftPage.page_folder_id
      ? draftToPublishedFolderIds.get(draftPage.page_folder_id) || draftPage.page_folder_id
      : null;

    const publishedData = {
      name: draftPage.name,
      slug: draftPage.slug,
      page_folder_id: publishedFolderId,
      order: draftPage.order,
      depth: draftPage.depth,
      is_index: draftPage.is_index,
      is_dynamic: draftPage.is_dynamic,
      error_page: draftPage.error_page,
      settings: draftPage.settings,
      is_published: true,
      publish_key: draftPage.publish_key,
      content_hash: draftPage.content_hash, // Copy hash for change detection
    };

    if (existingPublished) {
      // Check if update is needed using content_hash for efficient comparison
      const hasChanges = existingPublished.content_hash !== draftPage.content_hash;

      if (hasChanges) {
        pagesToUpdate.push({
          id: existingPublished.id,
          updates: publishedData,
        });
      }
    } else {
      pagesToCreate.push(publishedData);
    }
  }

  // Step 11: Batch create/update pages
  let createdPages: Page[] = [];
  let updatedPagesCount = 0;

  if (pagesToCreate.length > 0) {
    const { data, error } = await client
      .from('pages')
      .insert(pagesToCreate)
      .select();

    if (error) {
      throw new Error(`Failed to create published pages: ${error.message}`);
    }

    createdPages = data || [];
  }

  for (const { id, updates } of pagesToUpdate) {
    const { error } = await client
      .from('pages')
      .update(updates)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update published page: ${error.message}`);
    }

    updatedPagesCount++;
  }

  // Step 12: Fetch all published pages again to get current state
  const allPublishedPages = await getPublishedPagesByPublishKeys(draftPagePublishKeys);
  const publishedPagesMapByKey = new Map<string, Page>();
  allPublishedPages.forEach(page => {
    publishedPagesMapByKey.set(page.publish_key, page);
  });

  // Step 13: Prepare layers to create/update (only for active drafts)
  const layersToCreate: any[] = [];
  const layersToUpdate: Array<{ id: string; updates: any }> = [];

  for (const draftPage of activeDraftPages) {
    const draftLayers = draftLayersByPageId.get(draftPage.id);
    if (!draftLayers) continue;

    const publishedPage = publishedPagesMapByKey.get(draftPage.publish_key);
    if (!publishedPage) continue;

    const existingPublishedLayers = publishedLayersByKey.get(draftLayers.publish_key);

    const publishedData: any = {
      page_id: publishedPage.id, // Reference published page, not draft
      layers: draftLayers.layers,
      is_published: true,
      publish_key: draftLayers.publish_key,
      content_hash: draftLayers.content_hash, // Copy hash for change detection
    };

    if (existingPublishedLayers) {
      // Check if update is needed using content_hash for efficient comparison
      const hasChanges = existingPublishedLayers.content_hash !== draftLayers.content_hash;

      if (hasChanges) {
        layersToUpdate.push({
          id: existingPublishedLayers.id,
          updates: publishedData,
        });
      }
    } else {
      layersToCreate.push(publishedData);
    }
  }

  // Step 14: Batch create/update layers
  let createdLayersCount = 0;
  let updatedLayersCount = 0;

  if (layersToCreate.length > 0) {
    const { error } = await client
      .from('page_layers')
      .insert(layersToCreate);

    if (error) {
      throw new Error(`Failed to create published layers: ${error.message}`);
    }

    createdLayersCount = layersToCreate.length;
  }

  for (const { id, updates } of layersToUpdate) {
    const { error } = await client
      .from('page_layers')
      .update(updates)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update published layers: ${error.message}`);
    }

    updatedLayersCount++;
  }

  // Step 15: Fetch final published state
  const finalPublishedPages = await getPublishedPagesByPublishKeys(draftPagePublishKeys);
  const finalPublishedLayers = await getPublishedLayersByPublishKeys(draftLayersArray.map(l => l.publish_key));

  const finalLayersByPageId = new Map<string, PageLayers>();
  finalPublishedLayers.forEach(layers => {
    finalLayersByPageId.set(layers.page_id, layers);
  });

  // Step 16: Build results
  const results: PublishResult[] = [];
  for (const page of finalPublishedPages) {
    const layers = finalLayersByPageId.get(page.id);
    if (layers) {
      results.push({ page, layers });
    }
  }

  const totalCreated = createdFoldersCount + createdPages.length + createdLayersCount;
  const totalUpdated = updatedFoldersCount + updatedPagesCount + updatedLayersCount;
  const totalUnchanged = (activeDraftFolders.length + activeDraftPages.length * 2) - totalCreated - totalUpdated;

  // Step 17: Copy draft CSS to published CSS
  console.log('[publishingService] Copying draft CSS to published CSS...');
  try {
    const draftCSS = await getSettingByKey('draft_css');
    if (draftCSS) {
      await setSetting('published_css', draftCSS);
      console.log('[publishingService] CSS published successfully');
    } else {
      console.warn('[publishingService] No draft CSS found to publish');
    }
  } catch (cssError) {
    console.error('[publishingService] Failed to copy CSS to published:', cssError);
    // Don't fail the entire publish operation if CSS copy fails
  }

  return {
    published: results,
    publishedFolders: finalPublishedFolders,
    created: totalCreated,
    updated: totalUpdated,
    unchanged: totalUnchanged,
  };
}

