/**
 * Component Repository
 *
 * Data access layer for components (reusable layer trees)
 * Components are stored globally and can be instanced across pages
 * Supports draft/published workflow with content hash-based change detection
 */

import { getSupabaseAdmin } from '../supabase-server';
import type { Component, Layer } from '@/types';
import { generateComponentContentHash } from '../hash-utils';

/**
 * Input data for creating a new component
 */
export interface CreateComponentData {
  name: string;
  layers: Layer[];
}

/**
 * Get all components (draft by default)
 */
export async function getAllComponents(isPublished: boolean = false): Promise<Component[]> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { data, error } = await client
    .from('components')
    .select('*')
    .eq('is_published', isPublished)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch components: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single component by ID (draft by default)
 * With composite primary key, we need to specify is_published to get a single row
 */
export async function getComponentById(id: string, isPublished: boolean = false): Promise<Component | null> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { data, error } = await client
    .from('components')
    .select('*')
    .eq('id', id)
    .eq('is_published', isPublished)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch component: ${error.message}`);
  }

  return data;
}

/**
 * Create a new component (draft by default)
 */
export async function createComponent(
  componentData: CreateComponentData
): Promise<Component> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Calculate content hash
  const contentHash = generateComponentContentHash({
    name: componentData.name,
    layers: componentData.layers,
  });

  const { data, error } = await client
    .from('components')
    .insert({
      name: componentData.name,
      layers: componentData.layers,
      content_hash: contentHash,
      is_published: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create component: ${error.message}`);
  }

  return data;
}

/**
 * Update a component and recalculate content hash
 */
export async function updateComponent(
  id: string,
  updates: Partial<Pick<Component, 'name' | 'layers'>>
): Promise<Component> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Get current component to merge with updates
  const current = await getComponentById(id);
  if (!current) {
    throw new Error('Component not found');
  }

  // Merge current data with updates for hash calculation
  const finalData = {
    name: updates.name !== undefined ? updates.name : current.name,
    layers: updates.layers !== undefined ? updates.layers : current.layers,
  };

  // Recalculate content hash
  const contentHash = generateComponentContentHash(finalData);

  const { data, error } = await client
    .from('components')
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
    throw new Error(`Failed to update component: ${error.message}`);
  }

  return data;
}

/**
 * Get published component by ID
 * Used to find the published version of a draft component
 */
export async function getPublishedComponentById(id: string): Promise<Component | null> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { data, error } = await client
    .from('components')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch published component: ${error.message}`);
  }

  return data;
}

/**
 * Publish a component (dual-record pattern like pages)
 * Creates/updates a separate published version while keeping draft untouched
 * Uses composite primary key (id, is_published) - same ID for draft and published versions
 */
export async function publishComponent(draftComponentId: string): Promise<Component> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Get the draft component
  const draftComponent = await getComponentById(draftComponentId);
  if (!draftComponent) {
    throw new Error('Draft component not found');
  }

  // Upsert published version - composite key handles insert/update automatically
  const { data, error } = await client
    .from('components')
    .upsert({
      id: draftComponent.id, // Same ID for draft and published versions
      name: draftComponent.name,
      layers: draftComponent.layers,
      content_hash: draftComponent.content_hash, // Copy hash from draft
      is_published: true,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id,is_published',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to publish component: ${error.message}`);
  }

  return data;
}

/**
 * Publish multiple components in batch
 * Uses batch upsert for efficiency
 */
export async function publishComponents(componentIds: string[]): Promise<{ count: number }> {
  if (componentIds.length === 0) {
    return { count: 0 };
  }

  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Batch fetch all draft components
  const { data: draftComponents, error: fetchError } = await client
    .from('components')
    .select('*')
    .in('id', componentIds)
    .eq('is_published', false);

  if (fetchError) {
    throw new Error(`Failed to fetch draft components: ${fetchError.message}`);
  }

  if (!draftComponents || draftComponents.length === 0) {
    return { count: 0 };
  }

  // Prepare components for batch upsert
  const componentsToUpsert = draftComponents.map(draft => ({
    id: draft.id,
    name: draft.name,
    layers: draft.layers,
    content_hash: draft.content_hash,
    is_published: true,
    updated_at: new Date().toISOString(),
  }));

  // Batch upsert all components
  const { error: upsertError } = await client
    .from('components')
    .upsert(componentsToUpsert, {
      onConflict: 'id,is_published',
    });

  if (upsertError) {
    throw new Error(`Failed to publish components: ${upsertError.message}`);
  }

  return { count: componentsToUpsert.length };
}

/**
 * Get all unpublished components
 * A component needs publishing if:
 * - It has is_published: false (never published), OR
 * - Its draft content_hash differs from published content_hash (needs republishing)
 */
export async function getUnpublishedComponents(): Promise<Component[]> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Get all draft components
  const { data: draftComponents, error } = await client
    .from('components')
    .select('*')
    .eq('is_published', false)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch draft components: ${error.message}`);
  }

  if (!draftComponents || draftComponents.length === 0) {
    return [];
  }

  const unpublishedComponents: Component[] = [];

  // Batch fetch all published components for the draft IDs
  const draftIds = draftComponents.map(c => c.id);
  const { data: publishedComponents, error: publishedError } = await client
    .from('components')
    .select('*')
    .in('id', draftIds)
    .eq('is_published', true);

  if (publishedError) {
    throw new Error(`Failed to fetch published components: ${publishedError.message}`);
  }

  // Build lookup map
  const publishedById = new Map<string, Component>();
  (publishedComponents || []).forEach(c => publishedById.set(c.id, c));

  // Check each draft component
  for (const draftComponent of draftComponents) {
    // Check if published version exists
    const publishedComponent = publishedById.get(draftComponent.id);

    // If no published version exists, needs first-time publishing
    if (!publishedComponent) {
      unpublishedComponents.push(draftComponent);
      continue;
    }

    // Compare content hashes
    if (draftComponent.content_hash !== publishedComponent.content_hash) {
      unpublishedComponents.push(draftComponent);
    }
  }

  return unpublishedComponents;
}

/**
 * Get count of unpublished components
 */
export async function getUnpublishedComponentsCount(): Promise<number> {
  const components = await getUnpublishedComponents();
  return components.length;
}

/**
 * Delete a component and detach it from all layers in all page_layers records
 */
export async function deleteComponent(id: string): Promise<void> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // First, get all page_layers records that might contain layers with this component
  const { data: pageLayersRecords, error: fetchError } = await client
    .from('page_layers')
    .select('id, layers')
    .is('deleted_at', null);

  if (fetchError) {
    throw new Error(`Failed to fetch page layers: ${fetchError.message}`);
  }

  // Detach component from layers in each record
  if (pageLayersRecords && pageLayersRecords.length > 0) {
    const updates = pageLayersRecords
      .map(record => {
        const updatedLayers = detachComponentFromLayersRecursive(record.layers || [], id);
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

  // Finally, delete the component (both draft and published versions)
  const { error } = await client
    .from('components')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete component: ${error.message}`);
  }
}

/**
 * Helper function to recursively remove componentId from layers
 */
function detachComponentFromLayersRecursive(layers: Layer[], componentId: string): Layer[] {
  return layers.map(layer => {
    // Create a clean copy of the layer
    const cleanLayer = { ...layer };

    // If this layer uses the component, remove componentId and componentOverrides
    if (cleanLayer.componentId === componentId) {
      delete cleanLayer.componentId;
      delete cleanLayer.componentOverrides;
    }

    // Recursively process children
    if (cleanLayer.children && cleanLayer.children.length > 0) {
      cleanLayer.children = detachComponentFromLayersRecursive(cleanLayer.children, componentId);
    }

    return cleanLayer;
  });
}
