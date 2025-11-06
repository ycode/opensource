/**
 * Component Repository
 * 
 * Data access layer for components (reusable layer trees)
 * Components are stored globally and can be instanced across pages
 */

import { getSupabaseAdmin } from '../supabase-server';
import type { Component, Layer } from '@/types';

/**
 * Get all components
 */
export async function getAllComponents(): Promise<Component[]> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }
  
  const { data, error } = await client
    .from('components')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to fetch components: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Get a single component by ID
 */
export async function getComponentById(id: string): Promise<Component | null> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }
  
  const { data, error } = await client
    .from('components')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch component: ${error.message}`);
  }
  
  return data;
}

/**
 * Create a new component
 */
export async function createComponent(
  componentData: Omit<Component, 'id' | 'created_at' | 'updated_at'>
): Promise<Component> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }
  
  const { data, error } = await client
    .from('components')
    .insert({
      name: componentData.name,
      layers: componentData.layers,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create component: ${error.message}`);
  }
  
  return data;
}

/**
 * Update a component
 */
export async function updateComponent(
  id: string,
  updates: Partial<Pick<Component, 'name' | 'layers'>>
): Promise<Component> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }
  
  const { data, error } = await client
    .from('components')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update component: ${error.message}`);
  }
  
  return data;
}

/**
 * Delete a component and detach it from all layers in all page versions
 */
export async function deleteComponent(id: string): Promise<void> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }
  
  // First, get all page versions that might contain layers with this component
  const { data: versions, error: fetchError } = await client
    .from('page_versions')
    .select('id, layers');
  
  if (fetchError) {
    throw new Error(`Failed to fetch page versions: ${fetchError.message}`);
  }
  
  // Detach component from layers in each version
  if (versions && versions.length > 0) {
    const updates = versions
      .map(version => {
        const updatedLayers = detachComponentFromLayersRecursive(version.layers || [], id);
        // Only update if layers actually changed
        if (JSON.stringify(updatedLayers) !== JSON.stringify(version.layers)) {
          return { id: version.id, layers: updatedLayers };
        }
        return null;
      })
      .filter(Boolean);
    
    // Batch update all affected versions
    for (const update of updates) {
      if (update) {
        const { error: updateError } = await client
          .from('page_versions')
          .update({ layers: update.layers })
          .eq('id', update.id);
        
        if (updateError) {
          console.error(`Failed to update version ${update.id}:`, updateError);
        }
      }
    }
  }
  
  // Finally, delete the component
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

