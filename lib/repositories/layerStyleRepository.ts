/**
 * Layer Style Repository
 *
 * Data access layer for layer styles (reusable design configurations)
 * Supports draft/published workflow with content hash-based change detection
 */

import { getSupabaseAdmin } from '../supabase-server';
import type { LayerStyle, Layer } from '@/types';
import { generateLayerStyleContentHash } from '../hash-utils';

/**
 * Input data for creating a new layer style
 */
export interface CreateLayerStyleData {
  name: string;
  classes: string;
  design?: LayerStyle['design'];
}

/**
 * Get all layer styles (draft by default)
 */
export async function getAllStyles(isPublished: boolean = false): Promise<LayerStyle[]> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { data, error } = await client
    .from('layer_styles')
    .select('*')
    .eq('is_published', isPublished)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch layer styles: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single layer style by ID (draft by default)
 * With composite primary key, we need to specify is_published to get a single row
 */
export async function getStyleById(id: string, isPublished: boolean = false): Promise<LayerStyle | null> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { data, error } = await client
    .from('layer_styles')
    .select('*')
    .eq('id', id)
    .eq('is_published', isPublished)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch layer style: ${error.message}`);
  }

  return data;
}

/**
 * Create a new layer style (draft by default)
 */
export async function createStyle(
  styleData: CreateLayerStyleData
): Promise<LayerStyle> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Calculate content hash
  const contentHash = generateLayerStyleContentHash({
    name: styleData.name,
    classes: styleData.classes,
    design: styleData.design,
  });

  const { data, error } = await client
    .from('layer_styles')
    .insert({
      name: styleData.name,
      classes: styleData.classes,
      design: styleData.design,
      content_hash: contentHash,
      is_published: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create layer style: ${error.message}`);
  }

  return data;
}

/**
 * Update a layer style and recalculate content hash
 */
export async function updateStyle(
  id: string,
  updates: Partial<Pick<LayerStyle, 'name' | 'classes' | 'design'>>
): Promise<LayerStyle> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Get current style to merge with updates
  const current = await getStyleById(id);
  if (!current) {
    throw new Error('Layer style not found');
  }

  // Merge current data with updates for hash calculation
  const finalData = {
    name: updates.name !== undefined ? updates.name : current.name,
    classes: updates.classes !== undefined ? updates.classes : current.classes,
    design: updates.design !== undefined ? updates.design : current.design,
  };

  // Recalculate content hash
  const contentHash = generateLayerStyleContentHash(finalData);

  const { data, error } = await client
    .from('layer_styles')
    .update({
      ...updates,
      content_hash: contentHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('is_published', false) // Update draft version only
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update layer style: ${error.message}`);
  }

  return data;
}

/**
 * Get published layer style by ID
 * Used to find the published version of a draft layer style
 */
export async function getPublishedStyleById(id: string): Promise<LayerStyle | null> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { data, error } = await client
    .from('layer_styles')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch published layer style: ${error.message}`);
  }

  return data;
}

/**
 * Publish a layer style (dual-record pattern like pages and components)
 * Creates/updates a separate published version while keeping draft untouched
 * Uses composite primary key (id, is_published) - same ID for draft and published versions
 */
export async function publishLayerStyle(draftStyleId: string): Promise<LayerStyle> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Get the draft style
  const draftStyle = await getStyleById(draftStyleId);
  if (!draftStyle) {
    throw new Error('Draft layer style not found');
  }

  // Upsert published version - composite key handles insert/update automatically
  const { data, error } = await client
    .from('layer_styles')
    .upsert({
      id: draftStyle.id, // Same ID for draft and published versions
      name: draftStyle.name,
      classes: draftStyle.classes,
      design: draftStyle.design,
      content_hash: draftStyle.content_hash, // Copy hash from draft
      is_published: true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id,is_published',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to publish layer style: ${error.message}`);
  }

  return data;
}

/**
 * Publish multiple layer styles in batch
 * Uses batch upsert for efficiency
 */
export async function publishLayerStyles(styleIds: string[]): Promise<{ count: number }> {
  if (styleIds.length === 0) {
    return { count: 0 };
  }

  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Batch fetch all draft styles
  const { data: draftStyles, error: fetchError } = await client
    .from('layer_styles')
    .select('*')
    .in('id', styleIds)
    .eq('is_published', false);

  if (fetchError) {
    throw new Error(`Failed to fetch draft layer styles: ${fetchError.message}`);
  }

  if (!draftStyles || draftStyles.length === 0) {
    return { count: 0 };
  }

  // Prepare styles for batch upsert
  const stylesToUpsert = draftStyles.map(draft => ({
    id: draft.id,
    name: draft.name,
    classes: draft.classes,
    design: draft.design,
    content_hash: draft.content_hash,
    is_published: true,
    updated_at: new Date().toISOString(),
  }));

  // Batch upsert all styles
  const { error: upsertError } = await client
    .from('layer_styles')
    .upsert(stylesToUpsert, {
      onConflict: 'id,is_published',
    });

  if (upsertError) {
    throw new Error(`Failed to publish layer styles: ${upsertError.message}`);
  }

  return { count: stylesToUpsert.length };
}

/**
 * Get all unpublished layer styles
 * A layer style needs publishing if:
 * - It has is_published: false (never published), OR
 * - Its draft content_hash differs from published content_hash (needs republishing)
 */
export async function getUnpublishedLayerStyles(): Promise<LayerStyle[]> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Get all draft layer styles
  const { data: draftStyles, error } = await client
    .from('layer_styles')
    .select('*')
    .eq('is_published', false)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch draft layer styles: ${error.message}`);
  }

  if (!draftStyles || draftStyles.length === 0) {
    return [];
  }

  const unpublishedStyles: LayerStyle[] = [];

  // Batch fetch all published styles for the draft IDs
  const draftIds = draftStyles.map(s => s.id);
  const { data: publishedStyles, error: publishedError } = await client
    .from('layer_styles')
    .select('*')
    .in('id', draftIds)
    .eq('is_published', true);

  if (publishedError) {
    throw new Error(`Failed to fetch published layer styles: ${publishedError.message}`);
  }

  // Build lookup map
  const publishedById = new Map<string, LayerStyle>();
  (publishedStyles || []).forEach(s => publishedById.set(s.id, s));

  // Check each draft style
  for (const draftStyle of draftStyles) {
    // Check if published version exists
    const publishedStyle = publishedById.get(draftStyle.id);

    // If no published version exists, needs first-time publishing
    if (!publishedStyle) {
      unpublishedStyles.push(draftStyle);
      continue;
    }

    // Compare content hashes
    if (draftStyle.content_hash !== publishedStyle.content_hash) {
      unpublishedStyles.push(draftStyle);
    }
  }

  return unpublishedStyles;
}

/**
 * Get count of unpublished layer styles
 */
export async function getUnpublishedLayerStylesCount(): Promise<number> {
  const styles = await getUnpublishedLayerStyles();
  return styles.length;
}

/**
 * Delete a layer style and detach it from all layers in all page_layers records
 */
export async function deleteStyle(id: string): Promise<void> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // First, get all page_layers records that might contain layers with this style
  const { data: pageLayersRecords, error: fetchError } = await client
    .from('page_layers')
    .select('id, layers')
    .is('deleted_at', null);

  if (fetchError) {
    throw new Error(`Failed to fetch page layers: ${fetchError.message}`);
  }

  // Detach style from layers in each record
  if (pageLayersRecords && pageLayersRecords.length > 0) {
    const updates = pageLayersRecords
      .map(record => {
        const updatedLayers = detachStyleFromLayersRecursive(record.layers || [], id);
        // Only update if layers actually changed
        if (JSON.stringify(updatedLayers) !== JSON.stringify(record.layers)) {
          return { id: record.id, layers: updatedLayers };
        }
        return null;
      })
      .filter(Boolean);

    // Batch update all affected records
    for (const update of updates) {
      if (update) {
        const { error: updateError } = await client
          .from('page_layers')
          .update({
            layers: update.layers,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.id);

        if (updateError) {
          console.error(`Failed to update page_layers ${update.id}:`, updateError);
        }
      }
    }
  }

  // Finally, delete the style (both draft and published versions)
  const { error } = await client
    .from('layer_styles')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete layer style: ${error.message}`);
  }
}

/**
 * Helper function to recursively remove styleId from layers
 */
function detachStyleFromLayersRecursive(layers: Layer[], styleId: string): Layer[] {
  return layers.map(layer => {
    // Create a clean copy of the layer
    const cleanLayer = { ...layer };

    // If this layer uses the style, remove styleId and styleOverrides
    if (cleanLayer.styleId === styleId) {
      delete cleanLayer.styleId;
      delete cleanLayer.styleOverrides;
    }

    // Recursively process children
    if (cleanLayer.children && cleanLayer.children.length > 0) {
      cleanLayer.children = detachStyleFromLayersRecursive(cleanLayer.children, styleId);
    }

    return cleanLayer;
  });
}
