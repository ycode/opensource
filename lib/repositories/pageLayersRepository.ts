import { getSupabaseAdmin } from '../supabase-server';
import type { PageLayers, Layer } from '../../types';
import { generatePageLayersHash } from '../hash-utils';

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
 * @param generatedCSS - Optional CSS generated from Tailwind JIT for published pages
 * @param additionalData - Optional additional fields (e.g., metadata)
 */
export async function upsertDraftLayers(
  pageId: string,
  layers: Layer[],
  generatedCSS?: string | null,
  additionalData?: Record<string, any>
): Promise<PageLayers> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Check if draft exists
  const existingDraft = await getDraftLayers(pageId);

  // Calculate content hash for layers
  const contentHash = generatePageLayersHash({
    layers,
    generated_css: generatedCSS !== undefined ? generatedCSS : null,
  });

  // Prepare update data
  const updateData: any = {
    layers,
    content_hash: contentHash,
    updated_at: new Date().toISOString()
  };

  if (generatedCSS !== undefined) {
    updateData.generated_css = generatedCSS;
  }

  if (additionalData) {
    Object.assign(updateData, additionalData);
  }

  if (existingDraft) {
    // Update existing draft
    const { data, error } = await client
      .from('page_layers')
      .update(updateData)
      .eq('id', existingDraft.id)
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

    if (generatedCSS !== undefined) {
      insertData.generated_css = generatedCSS;
    }

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
 * Get all published layers by publish_keys
 * Used for batch publishing optimization
 */
export async function getPublishedLayersByPublishKeys(publishKeys: string[]): Promise<PageLayers[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  if (publishKeys.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from('page_layers')
    .select('*')
    .in('publish_key', publishKeys)
    .eq('is_published', true)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch published layers: ${error.message}`);
  }

  return data || [];
}

/**
 * Get published layers by publish_key
 * Used to find the published version of draft layers
 */
export async function getPublishedLayersByPublishKey(publishKey: string): Promise<PageLayers | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('page_layers')
    .select('*')
    .eq('publish_key', publishKey)
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
 * Creates or updates a published version of the layers with the same publish_key
 * References the published page ID (not the draft page ID)
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

  // Check if published version exists
  const existingPublished = await getPublishedLayersByPublishKey(draftLayers.publish_key);

  // Calculate content hash for published layers
  const contentHash = generatePageLayersHash({
    layers: draftLayers.layers,
    generated_css: draftLayers.generated_css || null,
  });

  const publishedData: any = {
    page_id: publishedPageId, // Reference the published page, not the draft
    layers: draftLayers.layers,
    content_hash: contentHash,
    is_published: true,
    publish_key: draftLayers.publish_key,
  };

  // Copy generated_css if it exists
  if (draftLayers.generated_css) {
    publishedData.generated_css = draftLayers.generated_css;
  }

  if (existingPublished) {
    // Update existing published version only if content_hash changed
    const hasChanges = existingPublished.content_hash !== contentHash;

    if (hasChanges) {
      const { data, error } = await client
        .from('page_layers')
        .update(publishedData)
        .eq('id', existingPublished.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update published layers: ${error.message}`);
      }

      return data;
    }

    return existingPublished;
  } else {
    // Create new published version
    const { data, error } = await client
      .from('page_layers')
      .insert(publishedData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create published layers: ${error.message}`);
    }

    return data;
  }
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

