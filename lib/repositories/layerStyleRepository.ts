/**
 * Layer Style Repository
 * 
 * Data access layer for layer styles (reusable design configurations)
 * Layer styles are part of the page draft and get published when the page is published
 */

import { getSupabaseAdmin } from '../supabase-server';
import type { LayerStyle, Layer } from '@/types';

/**
 * Get all layer styles
 */
export async function getAllStyles(): Promise<LayerStyle[]> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }
  
  const { data, error } = await client
    .from('layer_styles')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to fetch layer styles: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Get a single layer style by ID
 */
export async function getStyleById(id: string): Promise<LayerStyle | null> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }
  
  const { data, error } = await client
    .from('layer_styles')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch layer style: ${error.message}`);
  }
  
  return data;
}

/**
 * Create a new layer style
 */
export async function createStyle(
  styleData: Omit<LayerStyle, 'id' | 'created_at' | 'updated_at'>
): Promise<LayerStyle> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }
  
  const { data, error } = await client
    .from('layer_styles')
    .insert({
      name: styleData.name,
      classes: styleData.classes,
      design: styleData.design,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create layer style: ${error.message}`);
  }
  
  return data;
}

/**
 * Update a layer style
 */
export async function updateStyle(
  id: string,
  updates: Partial<Pick<LayerStyle, 'name' | 'classes' | 'design'>>
): Promise<LayerStyle> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }
  
  const { data, error } = await client
    .from('layer_styles')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update layer style: ${error.message}`);
  }
  
  return data;
}

/**
 * Delete a layer style and detach it from all layers in all page versions
 */
export async function deleteStyle(id: string): Promise<void> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }
  
  // First, get all page versions that might contain layers with this style
  const { data: versions, error: fetchError } = await client
    .from('page_versions')
    .select('id, layers');
  
  if (fetchError) {
    throw new Error(`Failed to fetch page versions: ${fetchError.message}`);
  }
  
  // Detach style from layers in each version
  if (versions && versions.length > 0) {
    const updates = versions
      .map(version => {
        const updatedLayers = detachStyleFromLayersRecursive(version.layers || [], id);
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
  
  // Finally, delete the style
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

