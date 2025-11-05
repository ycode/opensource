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
import { getSupabaseAdmin } from '../supabase-server';
import type { Page, PageLayers } from '../../types';

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
  created: number;
  updated: number;
  unchanged: number;
}

/**
 * Publish all draft pages and their layers
 * Optimized with batch queries to minimize database roundtrips
 *
 * Publishing order:
 * 1. Fetch all drafts (pages + layers) in batch
 * 2. Fetch existing published versions in batch
 * 3. Publish pages (no dependencies)
 * 4. Publish page layers (depends on pages via page_id)
 *
 * @returns Publishing results with statistics
 */
export async function publishAllPages(): Promise<PublishAllResult> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Step 1: Fetch all draft pages (including soft-deleted to handle deletions)
  const allDraftPages = await getAllDraftPages(true);

  if (allDraftPages.length === 0) {
    return {
      published: [],
      created: 0,
      updated: 0,
      unchanged: 0,
    };
  }

  // Separate active and soft-deleted drafts
  const activeDraftPages = allDraftPages.filter(p => p.deleted_at === null);
  const softDeletedDrafts = allDraftPages.filter(p => p.deleted_at !== null);

  const draftPageIds = activeDraftPages.map(p => p.id);
  const draftPagePublishKeys = activeDraftPages.map(p => p.publish_key);
  const allPublishKeys = allDraftPages.map(p => p.publish_key);

  // Step 2: Fetch all draft layers for these pages in one query
  const draftLayersArray = await getDraftLayersForPages(draftPageIds);
  const draftLayersByPageId = new Map<string, PageLayers>();
  draftLayersArray.forEach(layers => {
    draftLayersByPageId.set(layers.page_id, layers);
  });

  // Step 3: Fetch existing published pages and layers in batch (for all drafts including deleted)
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

  // Step 3.5: Soft-delete published versions of soft-deleted drafts
  const deletedAt = new Date().toISOString();
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

  // Step 4: Prepare pages to create/update (only for active drafts)
  const pagesToCreate: any[] = [];
  const pagesToUpdate: Array<{ id: string; updates: any }> = [];

  for (const draftPage of activeDraftPages) {
    const existingPublished = publishedPagesByKey.get(draftPage.publish_key);

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
      // Check if update is needed
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
        pagesToUpdate.push({
          id: existingPublished.id,
          updates: publishedData,
        });
      }
    } else {
      pagesToCreate.push(publishedData);
    }
  }

  // Step 5: Batch create/update pages
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

  // Step 6: Fetch all published pages again to get current state
  const allPublishedPages = await getPublishedPagesByPublishKeys(draftPagePublishKeys);
  const publishedPagesMapByKey = new Map<string, Page>();
  allPublishedPages.forEach(page => {
    publishedPagesMapByKey.set(page.publish_key, page);
  });

  // Step 7: Prepare layers to create/update (only for active drafts)
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
    };

    // Copy generated_css if it exists
    if (draftLayers.generated_css) {
      publishedData.generated_css = draftLayers.generated_css;
    }

    if (existingPublishedLayers) {
      // Check if update is needed (layers or CSS changed)
      const layersChanged = JSON.stringify(existingPublishedLayers.layers) !== JSON.stringify(draftLayers.layers);
      const cssChanged = existingPublishedLayers.generated_css !== draftLayers.generated_css;
      const hasChanges = layersChanged || cssChanged;

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

  // Step 8: Batch create/update layers
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

  // Step 9: Fetch final published state
  const finalPublishedPages = await getPublishedPagesByPublishKeys(draftPagePublishKeys);
  const finalPublishedLayers = await getPublishedLayersByPublishKeys(draftLayersArray.map(l => l.publish_key));

  const finalLayersByPageId = new Map<string, PageLayers>();
  finalPublishedLayers.forEach(layers => {
    finalLayersByPageId.set(layers.page_id, layers);
  });

  // Step 10: Build results
  const results: PublishResult[] = [];
  for (const page of finalPublishedPages) {
    const layers = finalLayersByPageId.get(page.id);
    if (layers) {
      results.push({ page, layers });
    }
  }

  const totalCreated = createdPages.length + createdLayersCount;
  const totalUpdated = updatedPagesCount + updatedLayersCount;
  const totalUnchanged = (activeDraftPages.length * 2) - totalCreated - totalUpdated;

  return {
    published: results,
    created: totalCreated,
    updated: totalUpdated,
    unchanged: totalUnchanged,
  };
}

