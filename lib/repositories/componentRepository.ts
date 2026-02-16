/**
 * Component Repository
 *
 * Data access layer for components (reusable layer trees)
 * Components are stored globally and can be instanced across pages
 * Supports draft/published workflow with content hash-based change detection
 */

import { getSupabaseAdmin } from '@/lib/supabase-server';
import type { Component, Layer } from '@/types';
import { generateComponentContentHash } from '../hash-utils';
import { deleteTranslationsInBulk, markTranslationsIncomplete } from '@/lib/repositories/translationRepository';
import { extractLayerContentMap } from '../localisation-utils';

/**
 * Input data for creating a new component
 */
export interface CreateComponentData {
  name: string;
  layers: Layer[];
  variables?: any[]; // Component variables for exposed properties
}

/**
 * Get all components (draft by default, excludes soft deleted)
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
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch components: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single component by ID (draft by default, excludes soft deleted)
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
    .is('deleted_at', null)
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
 * Get multiple components by IDs (drafts by default, excludes soft deleted)
 * Returns a map of component ID to component for quick lookup
 */
export async function getComponentsByIds(
  ids: string[],
  isPublished: boolean = false
): Promise<Record<string, Component>> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  if (ids.length === 0) {
    return {};
  }

  const { data, error } = await client
    .from('components')
    .select('*')
    .in('id', ids)
    .eq('is_published', isPublished)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch components: ${error.message}`);
  }

  // Convert array to map for O(1) lookup
  const componentMap: Record<string, Component> = {};
  data?.forEach(component => {
    componentMap[component.id] = component;
  });

  return componentMap;
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

  const insertData: any = {
    name: componentData.name,
    layers: componentData.layers,
    content_hash: contentHash,
    is_published: false,
  };
  
  // Include variables if provided
  if (componentData.variables?.length) {
    insertData.variables = componentData.variables;
  }

  const { data, error } = await client
    .from('components')
    .insert(insertData)
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
  updates: Partial<Pick<Component, 'name' | 'layers' | 'variables'>>
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

  // Detect removed and changed layer content if layers are being updated
  if (updates.layers !== undefined) {
    const oldContentMap = extractLayerContentMap(current.layers || [], 'component', id);
    const newContentMap = extractLayerContentMap(updates.layers, 'component', id);

    // Find removed keys (exist in old but not in new)
    const removedKeys = Object.keys(oldContentMap).filter(key => !(key in newContentMap));

    // Find changed keys (exist in both but value differs)
    const changedKeys = Object.keys(newContentMap).filter(
      key => key in oldContentMap && oldContentMap[key] !== newContentMap[key]
    );

    // Delete translations for removed content
    if (removedKeys.length > 0) {
      await deleteTranslationsInBulk('component', id, removedKeys);
    }

    // Mark translations as incomplete for changed content
    if (changedKeys.length > 0) {
      await markTranslationsIncomplete('component', id, changedKeys);
    }
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

  // Batch fetch all draft components (excluding soft deleted)
  const { data: draftComponents, error: fetchError } = await client
    .from('components')
    .select('*')
    .in('id', componentIds)
    .eq('is_published', false)
    .is('deleted_at', null);

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
 * Get all unpublished components (excludes soft deleted)
 * A component needs publishing if:
 * - It has is_published: false (never published), OR
 * - Its draft content_hash differs from published content_hash (needs republishing)
 */
export async function getUnpublishedComponents(): Promise<Component[]> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Get all draft components (excluding soft deleted)
  const { data: draftComponents, error } = await client
    .from('components')
    .select('*')
    .eq('is_published', false)
    .is('deleted_at', null)
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
 * Affected entity info returned when deleting a component
 */
export interface AffectedEntity {
  type: 'page' | 'component';
  id: string;
  name: string;
  pageId?: string; // For page_layers, this is the page_id
  previousLayers: Layer[];
  newLayers: Layer[];
}

/**
 * Result of soft deleting a component
 */
export interface SoftDeleteResult {
  component: Component;
  affectedEntities: AffectedEntity[];
}

/**
 * Find all pages and components that use a specific component
 */
export async function findEntitiesUsingComponent(componentId: string): Promise<AffectedEntity[]> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const affectedEntities: AffectedEntity[] = [];

  // Find all page_layers records that contain this component
  const { data: pageLayersRecords, error: pageError } = await client
    .from('page_layers')
    .select('id, page_id, layers, is_published')
    .is('deleted_at', null)
    .eq('is_published', false); // Only draft versions

  if (pageError) {
    throw new Error(`Failed to fetch page layers: ${pageError.message}`);
  }

  // Get page names for better UX
  const pageIds = pageLayersRecords?.map(r => r.page_id).filter(Boolean) || [];
  let pageNames: Record<string, string> = {};
  if (pageIds.length > 0) {
    const { data: pages } = await client
      .from('pages')
      .select('id, name')
      .in('id', pageIds);
    pageNames = (pages || []).reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {});
  }

  // Check each page_layers record
  for (const record of pageLayersRecords || []) {
    if (layersContainComponent(record.layers || [], componentId)) {
      const newLayers = await detachComponentFromLayersRecursive(record.layers || [], componentId);
      affectedEntities.push({
        type: 'page',
        id: record.id,
        pageId: record.page_id,
        name: pageNames[record.page_id] || 'Unknown Page',
        previousLayers: record.layers || [],
        newLayers,
      });
    }
  }

  // Find all components (draft versions) that contain this component
  const { data: componentRecords, error: compError } = await client
    .from('components')
    .select('id, name, layers')
    .is('deleted_at', null)
    .eq('is_published', false)
    .neq('id', componentId); // Exclude the component being deleted

  if (compError) {
    throw new Error(`Failed to fetch components: ${compError.message}`);
  }

  // Check each component
  for (const record of componentRecords || []) {
    if (layersContainComponent(record.layers || [], componentId)) {
      const newLayers = await detachComponentFromLayersRecursive(record.layers || [], componentId);
      affectedEntities.push({
        type: 'component',
        id: record.id,
        name: record.name,
        previousLayers: record.layers || [],
        newLayers,
      });
    }
  }

  return affectedEntities;
}

/**
 * Check if layers contain a reference to a specific component
 */
function layersContainComponent(layers: Layer[], componentId: string): boolean {
  for (const layer of layers) {
    if (layer.componentId === componentId) {
      return true;
    }
    if (layer.children && layersContainComponent(layer.children, componentId)) {
      return true;
    }
  }
  return false;
}

/**
 * Soft delete a component and detach it from all layers
 * Returns the deleted component and affected entities for undo/redo
 */
export async function softDeleteComponent(id: string): Promise<SoftDeleteResult> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Get the component before deleting
  const { data: component, error: fetchError } = await client
    .from('components')
    .select('*')
    .eq('id', id)
    .eq('is_published', false)
    .is('deleted_at', null)
    .single();

  if (fetchError || !component) {
    throw new Error('Component not found');
  }

  // Find all affected entities
  const affectedEntities = await findEntitiesUsingComponent(id);

  // Detach component from all affected page_layers
  for (const entity of affectedEntities) {
    if (entity.type === 'page') {
      const { error: updateError } = await client
        .from('page_layers')
        .update({
          layers: entity.newLayers,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entity.id);

      if (updateError) {
        console.error(`Failed to update page_layers ${entity.id}:`, updateError);
      }
    } else if (entity.type === 'component') {
      const { error: updateError } = await client
        .from('components')
        .update({
          layers: entity.newLayers,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entity.id)
        .eq('is_published', false);

      if (updateError) {
        console.error(`Failed to update component ${entity.id}:`, updateError);
      }
    }
  }

  // Soft delete the component (both draft and published versions)
  const deletedAt = new Date().toISOString();
  const { error: deleteError } = await client
    .from('components')
    .update({ deleted_at: deletedAt })
    .eq('id', id);

  if (deleteError) {
    throw new Error(`Failed to soft delete component: ${deleteError.message}`);
  }

  return {
    component: { ...component, deleted_at: deletedAt },
    affectedEntities,
  };
}

/**
 * Restore a soft-deleted component
 */
export async function restoreComponent(id: string): Promise<Component> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { data, error } = await client
    .from('components')
    .update({ deleted_at: null })
    .eq('id', id)
    .eq('is_published', false)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to restore component: ${error.message}`);
  }

  return data;
}

/**
 * Hard delete a component (permanent, use with caution)
 */
export async function deleteComponent(id: string): Promise<void> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { error } = await client
    .from('components')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete component: ${error.message}`);
  }
}

/**
 * Update a component's thumbnail URL (draft only)
 */
export async function updateComponentThumbnail(id: string, thumbnailUrl: string | null): Promise<void> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { error } = await client
    .from('components')
    .update({ thumbnail_url: thumbnailUrl })
    .eq('id', id)
    .eq('is_published', false);

  if (error) {
    throw new Error(`Failed to update component thumbnail: ${error.message}`);
  }
}

/**
 * Helper function to recursively remove componentId from layers
 */
/**
 * Detach component from layers - async wrapper that fetches component data
 * Uses the shared utility function from component-utils.ts
 */
async function detachComponentFromLayersRecursive(layers: Layer[], componentId: string): Promise<Layer[]> {
  const { detachComponentFromLayers } = await import('../component-utils');

  // Get the component data to extract its layers
  const component = await getComponentById(componentId);

  // Use the shared utility function
  return detachComponentFromLayers(layers, componentId, component || undefined);
}
