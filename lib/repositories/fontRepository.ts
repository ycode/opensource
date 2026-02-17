import { getSupabaseAdmin } from '@/lib/supabase-server';
import { SUPABASE_QUERY_LIMIT, SUPABASE_WRITE_BATCH_SIZE } from '@/lib/supabase-constants';
import { generateFontContentHash } from '@/lib/hash-utils';
import type { Font, CreateFontData, UpdateFontData } from '@/types';

/**
 * Get all fonts (drafts only)
 */
export async function getAllFonts(): Promise<Font[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('fonts')
    .select('*')
    .eq('is_published', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(SUPABASE_QUERY_LIMIT);

  if (error) throw new Error(`Failed to fetch fonts: ${error.message}`);

  return data || [];
}

/**
 * Get all published fonts
 */
export async function getPublishedFonts(): Promise<Font[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('fonts')
    .select('*')
    .eq('is_published', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(SUPABASE_QUERY_LIMIT);

  if (error) throw new Error(`Failed to fetch published fonts: ${error.message}`);

  return data || [];
}

/**
 * Get a font by ID (draft)
 */
export async function getFontById(id: string): Promise<Font | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('fonts')
    .select('*')
    .eq('id', id)
    .eq('is_published', false)
    .is('deleted_at', null)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch font: ${error.message}`);
  }

  return data;
}

/**
 * Create a new font
 */
export async function createFont(fontData: CreateFontData): Promise<Font> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const contentHash = generateFontContentHash(fontData);

  const { data, error } = await client
    .from('fonts')
    .insert({
      name: fontData.name,
      family: fontData.family,
      type: fontData.type,
      variants: fontData.variants,
      weights: fontData.weights,
      category: fontData.category,
      kind: fontData.kind ?? null,
      url: fontData.url ?? null,
      storage_path: fontData.storage_path ?? null,
      file_hash: fontData.file_hash ?? null,
      content_hash: contentHash,
      is_published: false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create font: ${error.message}`);

  return data;
}

/**
 * Update an existing font
 */
export async function updateFont(id: string, fontData: UpdateFontData): Promise<Font> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (fontData.name !== undefined) updatePayload.name = fontData.name;
  if (fontData.family !== undefined) updatePayload.family = fontData.family;
  if (fontData.variants !== undefined) updatePayload.variants = fontData.variants;
  if (fontData.weights !== undefined) updatePayload.weights = fontData.weights;
  if (fontData.category !== undefined) updatePayload.category = fontData.category;

  // Recalculate content hash
  const existing = await getFontById(id);
  if (existing) {
    const merged = {
      name: fontData.name ?? existing.name,
      family: fontData.family ?? existing.family,
      type: existing.type,
      variants: fontData.variants ?? existing.variants,
      weights: fontData.weights ?? existing.weights,
      category: fontData.category ?? existing.category,
    };
    updatePayload.content_hash = generateFontContentHash(merged);
  }

  const { data, error } = await client
    .from('fonts')
    .update(updatePayload)
    .eq('id', id)
    .eq('is_published', false)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new Error(`Failed to update font: ${error.message}`);

  return data;
}

/**
 * Soft-delete a font
 */
export async function deleteFont(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { error } = await client
    .from('fonts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_published', false);

  if (error) throw new Error(`Failed to delete font: ${error.message}`);
}

/**
 * Get all unpublished fonts (fonts that have changes since last publish)
 */
export async function getUnpublishedFonts(): Promise<Font[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Get all draft fonts (including soft-deleted ones for cleanup)
  const { data: draftFonts, error: draftError } = await client
    .from('fonts')
    .select('*')
    .eq('is_published', false)
    .limit(SUPABASE_QUERY_LIMIT);

  if (draftError) throw new Error(`Failed to fetch draft fonts: ${draftError.message}`);

  // Get all published fonts
  const { data: publishedFonts, error: publishedError } = await client
    .from('fonts')
    .select('*')
    .eq('is_published', true)
    .limit(SUPABASE_QUERY_LIMIT);

  if (publishedError) throw new Error(`Failed to fetch published fonts: ${publishedError.message}`);

  const publishedMap = new Map(publishedFonts?.map(f => [f.id, f]) || []);

  // Find fonts that need publishing (new, changed, or deleted)
  return (draftFonts || []).filter(draft => {
    const published = publishedMap.get(draft.id);
    if (!published) return true; // New font
    if (draft.deleted_at) return true; // Deleted font
    return draft.content_hash !== published.content_hash; // Changed font
  });
}

/**
 * Publish all draft fonts to production
 */
export async function publishFonts(): Promise<{ added: number; updated: number; deleted: number }> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const stats = { added: 0, updated: 0, deleted: 0 };

  // Get all draft fonts
  const { data: draftFonts, error: draftError } = await client
    .from('fonts')
    .select('*')
    .eq('is_published', false)
    .limit(SUPABASE_QUERY_LIMIT);

  if (draftError) throw new Error(`Failed to fetch draft fonts: ${draftError.message}`);

  // Get all published fonts
  const { data: publishedFonts, error: publishedError } = await client
    .from('fonts')
    .select('*')
    .eq('is_published', true)
    .limit(SUPABASE_QUERY_LIMIT);

  if (publishedError) throw new Error(`Failed to fetch published fonts: ${publishedError.message}`);

  const publishedMap = new Map(publishedFonts?.map(f => [f.id, f]) || []);

  // Fonts to upsert (new or changed)
  const toUpsert: Record<string, unknown>[] = [];

  for (const draft of draftFonts || []) {
    if (draft.deleted_at) {
      // Soft-deleted in draft - remove from published
      if (publishedMap.has(draft.id)) {
        stats.deleted++;
      }
      continue;
    }

    const published = publishedMap.get(draft.id);

    if (!published) {
      stats.added++;
    } else if (draft.content_hash !== published.content_hash) {
      stats.updated++;
    } else {
      continue; // No changes
    }

    toUpsert.push({
      id: draft.id,
      name: draft.name,
      family: draft.family,
      type: draft.type,
      variants: draft.variants,
      weights: draft.weights,
      category: draft.category,
      kind: draft.kind,
      url: draft.url,
      storage_path: draft.storage_path,
      file_hash: draft.file_hash,
      content_hash: draft.content_hash,
      is_published: true,
      created_at: draft.created_at,
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
  }

  // Upsert changed fonts in batches
  for (let i = 0; i < toUpsert.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batch = toUpsert.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
    const { error } = await client
      .from('fonts')
      .upsert(batch, { onConflict: 'id,is_published' });

    if (error) throw new Error(`Failed to publish fonts batch: ${error.message}`);
  }

  // Delete published fonts that were soft-deleted in draft
  const deletedDraftIds = (draftFonts || [])
    .filter(f => f.deleted_at !== null)
    .map(f => f.id);

  if (deletedDraftIds.length > 0) {
    // Delete from published
    const { error: deletePublishedError } = await client
      .from('fonts')
      .delete()
      .in('id', deletedDraftIds)
      .eq('is_published', true);

    if (deletePublishedError) {
      throw new Error(`Failed to delete published fonts: ${deletePublishedError.message}`);
    }

    // Hard-delete from draft
    const { error: deleteDraftError } = await client
      .from('fonts')
      .delete()
      .in('id', deletedDraftIds)
      .eq('is_published', false);

    if (deleteDraftError) {
      throw new Error(`Failed to hard-delete draft fonts: ${deleteDraftError.message}`);
    }
  }

  // Also delete published fonts whose drafts no longer exist (orphans)
  const activeDraftIds = new Set(
    (draftFonts || []).filter(f => !f.deleted_at).map(f => f.id)
  );

  const orphanedPublished = (publishedFonts || []).filter(f => !activeDraftIds.has(f.id) && !deletedDraftIds.includes(f.id));

  if (orphanedPublished.length > 0) {
    const orphanIds = orphanedPublished.map(f => f.id);
    const { error } = await client
      .from('fonts')
      .delete()
      .in('id', orphanIds)
      .eq('is_published', true);

    if (error) throw new Error(`Failed to delete orphaned published fonts: ${error.message}`);
    stats.deleted += orphanedPublished.length;
  }

  return stats;
}
