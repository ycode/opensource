import { getSupabaseAdmin } from '../supabase-server';
import type { PageVersion, Layer } from '../../types';

/**
 * Get draft version for a page
 */
export async function getDraftVersion(pageId: string): Promise<PageVersion | null> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('page_versions')
    .select('*')
    .eq('page_id', pageId)
    .eq('is_published', false)
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
 * Get published version for a page
 */
export async function getPublishedVersion(pageId: string): Promise<PageVersion | null> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('page_versions')
    .select('*')
    .eq('page_id', pageId)
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch published version: ${error.message}`);
  }

  return data;
}

/**
 * Create or update draft version
 * @param pageId - Page ID
 * @param layers - Page layers
 * @param additionalData - Optional additional fields (e.g., metadata)
 */
export async function upsertDraft(pageId: string, layers: Layer[], additionalData?: Record<string, any>): Promise<PageVersion> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Check if draft exists
  const existingDraft = await getDraftVersion(pageId);

  if (existingDraft) {
    // Update existing draft
    const { data, error } = await client
      .from('page_versions')
      .update({ layers })
      .eq('id', existingDraft.id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update draft: ${error.message}`);
    }

    return data;
  } else {
    // Create new draft with any additional data
    const insertData = additionalData
      ? { page_id: pageId, layers, is_published: false, ...additionalData }
      : { page_id: pageId, layers, is_published: false };

    const { data, error } = await client
      .from('page_versions')
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
 * Publish a page version
 * Creates a new published version from the draft
 */
export async function publishPageVersion(pageId: string): Promise<PageVersion> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Get current draft
  const draft = await getDraftVersion(pageId);
  
  if (!draft) {
    throw new Error('No draft version found to publish');
  }

  // Create new published version with draft's layers
  const { data, error } = await client
    .from('page_versions')
    .insert({
      page_id: pageId,
      layers: draft.layers,
      is_published: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to publish version: ${error.message}`);
  }

  // Update page to reference new published version
  await client
    .from('pages')
    .update({
      status: 'published',
      published_version_id: data.id,
    })
    .eq('id', pageId);

  return data;
}

/**
 * Get all versions for a page (for history)
 */
export async function getPageVersions(pageId: string): Promise<PageVersion[]> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('page_versions')
    .select('*')
    .eq('page_id', pageId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch versions: ${error.message}`);
  }

  return data || [];
}

