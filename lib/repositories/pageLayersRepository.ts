import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { PageLayers, Layer } from '../../types';
import { generatePageLayersHash } from '../hash-utils';
import { deleteTranslationsInBulk, markTranslationsIncomplete } from './translationRepository';
import { extractLayerContentMap } from '../localisation-utils';

/**
 * Get layers by page_id with optional is_published filter
 */
export async function getLayersByPageId(
  pageId: string,
  isPublished?: boolean
): Promise<PageLayers | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  let query = client
    .from('page_layers')
    .select('*')
    .eq('page_id', pageId)
    .is('deleted_at', null);

  // Apply is_published filter if provided
  if (isPublished !== undefined) {
    query = query.eq('is_published', isPublished);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch layers: ${error.message}`);
  }

  return data;
}

/**
 * Get draft layers for a page
 */
export async function getDraftLayers(pageId: string): Promise<PageLayers | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('page_layers')
    .select('*')
    .eq('page_id', pageId)
    .eq('is_published', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch draft: ${error.message}`);
  }

  return data;
}

/**
 * Get published layers for a page
 */
export async function getPublishedLayers(pageId: string): Promise<PageLayers | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('page_layers')
    .select('*')
    .eq('page_id', pageId)
    .eq('is_published', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch published layers: ${error.message}`);
  }

  return data;
}

/**
 * Create or update draft layers
 * @param pageId - Page ID
 * @param layers - Page layers
 * @param additionalData - Optional additional fields (e.g., metadata)
 */
export async function upsertDraftLayers(
  pageId: string,
  layers: Layer[],
  additionalData?: Record<string, any>
): Promise<PageLayers> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Check if draft exists
  const existingDraft = await getDraftLayers(pageId);

  // Detect removed and changed layer content, update translations accordingly
  if (existingDraft && existingDraft.layers) {
    const oldContentMap = extractLayerContentMap(existingDraft.layers, 'page', pageId);
    const newContentMap = extractLayerContentMap(layers, 'page', pageId);

    // Find removed keys (exist in old but not in new)
    const removedKeys = Object.keys(oldContentMap).filter(key => !(key in newContentMap));

    // Find changed keys (exist in both but value differs)
    const changedKeys = Object.keys(newContentMap).filter(
      key => key in oldContentMap && oldContentMap[key] !== newContentMap[key]
    );

    // Delete translations for removed content
    if (removedKeys.length > 0) {
      await deleteTranslationsInBulk('page', pageId, removedKeys);
    }

    // Mark translations as incomplete for changed content
    if (changedKeys.length > 0) {
      await markTranslationsIncomplete('page', pageId, changedKeys);
    }
  }

  // Calculate content hash for layers
  const contentHash = generatePageLayersHash({
    layers,
    generated_css: (additionalData?.generated_css as string) || null,
  });

  // Prepare update data
  const updateData: any = {
    layers,
    content_hash: contentHash,
    updated_at: new Date().toISOString()
  };

  if (additionalData) {
    Object.assign(updateData, additionalData);
  }

  if (existingDraft) {
    // Update existing draft
    const { data, error } = await client
      .from('page_layers')
      .update(updateData)
      .eq('id', existingDraft.id)
      .eq('is_published', false)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update draft: ${error.message}`);
    }

    return data;
  } else {
    // Create new draft with any additional data
    const insertData: any = {
      page_id: pageId,
      layers,
      content_hash: contentHash,
      is_published: false,
      ...additionalData
    };

    const { data, error } = await client
      .from('page_layers')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create draft: ${error.message}`);
    }

    return data;
  }
}

/**
 * Get all draft layers (non-published)
 * Used for loading all drafts at once in the editor
 */
export async function getAllDraftLayers(): Promise<PageLayers[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('page_layers')
    .select('*')
    .eq('is_published', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch draft layers: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all draft layers for multiple pages
 * Used for batch publishing optimization
 */
export async function getDraftLayersForPages(pageIds: string[]): Promise<PageLayers[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  if (pageIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('page_layers')
    .select('*')
    .in('page_id', pageIds)
    .eq('is_published', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch draft layers: ${error.message}`);
  }

  return data || [];
}

/**
 * Get published layers by IDs
 * Used for batch publishing optimization
 */
export async function getPublishedLayersByIds(ids: string[]): Promise<PageLayers[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('page_layers')
    .select('*')
    .in('id', ids)
    .eq('is_published', true)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch published layers: ${error.message}`);
  }

  return data || [];
}

/**
 * Get published layers by ID
 * Used to find the published version of draft layers
 */
export async function getPublishedLayersById(id: string): Promise<PageLayers | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('page_layers')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch published layers: ${error.message}`);
  }

  return data;
}

/**
 * Publish page layers
 * Creates or updates a published version of the layers with the same ID
 * With composite keys (id, is_published), both draft and published versions use the same page_id
 * @param draftPageId - Page ID to get draft layers from (same as publishedPageId with composite keys)
 * @param publishedPageId - Page ID to reference in published layers (same as draftPageId with composite keys)
 * Draft layers remain unchanged
 */
export async function publishPageLayers(draftPageId: string, publishedPageId: string): Promise<PageLayers> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Get current draft layers
  const draftLayers = await getDraftLayers(draftPageId);

  if (!draftLayers) {
    throw new Error('No draft layers found to publish');
  }

  // Check if published version exists (same id, but is_published = true)
  const existingPublished = await getPublishedLayersById(draftLayers.id);

  if (existingPublished) {
    // Update existing published version only if content_hash changed
    const hasChanges = existingPublished.content_hash !== draftLayers.content_hash;

    if (hasChanges) {
      // Prepare update data WITHOUT primary key fields (id, is_published)
      const updateData: any = {
        page_id: publishedPageId, // Same page ID (draft and published pages share same id)
        layers: draftLayers.layers,
        content_hash: draftLayers.content_hash, // Copy hash from draft
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await client
        .from('page_layers')
        .update(updateData)
        .eq('id', existingPublished.id)
        .eq('is_published', true)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update published layers: ${error.message}`);
      }

      return data;
    }

    return existingPublished;
  } else {
    // Create new published version - include ALL fields for insert
    const insertData: any = {
      id: draftLayers.id, // Use same ID (composite key with is_published)
      page_id: publishedPageId,
      layers: draftLayers.layers,
      content_hash: draftLayers.content_hash,
      is_published: true,
    };

    const { data, error } = await client
      .from('page_layers')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create published layers: ${error.message}`);
    }

    return data;
  }
}

/**
 * Batch publish page layers for multiple pages
 * Much more efficient than calling publishPageLayers in a loop
 * @param pageIds - Array of page IDs to publish layers for
 * @returns Number of layers published
 */
export async function batchPublishPageLayers(pageIds: string[]): Promise<number> {
  if (pageIds.length === 0) {
    return 0;
  }

  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Step 1: Batch fetch all draft layers
  const draftLayers = await getDraftLayersForPages(pageIds);

  if (draftLayers.length === 0) {
    return 0;
  }

  // Build map for quick lookup
  const draftLayersById = new Map<string, PageLayers>();
  for (const draft of draftLayers) {
    draftLayersById.set(draft.id, draft);
  }

  // Step 2: Batch fetch existing published layers
  const draftIds = draftLayers.map(d => d.id);
  const existingPublished = await getPublishedLayersByIds(draftIds);

  const publishedById = new Map<string, PageLayers>();
  for (const pub of existingPublished) {
    publishedById.set(pub.id, pub);
  }

  // Step 3: Prepare upsert data
  const layersToUpsert: any[] = [];
  const now = new Date().toISOString();

  for (const draft of draftLayers) {
    const existing = publishedById.get(draft.id);

    // Only include if new or content_hash changed
    if (!existing || existing.content_hash !== draft.content_hash) {
      layersToUpsert.push({
        id: draft.id,
        page_id: draft.page_id,
        layers: draft.layers,
        content_hash: draft.content_hash,
        is_published: true,
        updated_at: now,
      });
    }
  }

  // Step 4: Batch upsert
  if (layersToUpsert.length > 0) {
    const { error } = await client
      .from('page_layers')
      .upsert(layersToUpsert, {
        onConflict: 'id,is_published',
      });

    if (error) {
      throw new Error(`Failed to batch publish layers: ${error.message}`);
    }
  }

  return layersToUpsert.length;
}

/**
 * Get all layers entries for a page (for history)
 */
export async function getPageLayers(pageId: string): Promise<PageLayers[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('page_layers')
    .select('*')
    .eq('page_id', pageId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch layers: ${error.message}`);
  }

  return data || [];
}
