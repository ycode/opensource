import { getSupabaseAdmin } from '../supabase-server';
import type { CollectionField, CollectionFieldType } from '@/types';

/**
 * Collection Field Repository
 * 
 * Handles CRUD operations for collection fields (schema definitions).
 * Uses Supabase/PostgreSQL via admin client.
 */

export interface CreateCollectionFieldData {
  name: string;
  field_name: string;
  type: CollectionFieldType;
  default?: string | null;
  fillable?: boolean;
  built_in?: boolean;
  order: number;
  collection_id: string; // UUID
  reference_collection_id?: string | null; // UUID
  hidden?: boolean;
  data?: Record<string, any>;
  status?: 'draft' | 'published';
}

export interface UpdateCollectionFieldData {
  name?: string;
  field_name?: string;
  type?: CollectionFieldType;
  default?: string | null;
  fillable?: boolean;
  built_in?: boolean;
  order?: number;
  reference_collection_id?: string | null; // UUID
  hidden?: boolean;
  data?: Record<string, any>;
  status?: 'draft' | 'published';
}

export interface FieldFilters {
  search?: string;
}

/**
 * Get all fields for a collection with optional search filtering
 */
export async function getFieldsByCollectionId(
  collection_id: string, // UUID
  filters?: FieldFilters
): Promise<CollectionField[]> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  let query = client
    .from('collection_fields')
    .select('*')
    .eq('collection_id', collection_id)
    .is('deleted_at', null)
    .order('order', { ascending: true });
  
  // Apply search filter
  if (filters?.search && filters.search.trim()) {
    const searchTerm = `%${filters.search.trim()}%`;
    query = query.or(`name.ilike.${searchTerm},field_name.ilike.${searchTerm}`);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch collection fields: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Get field by ID
 */
export async function getFieldById(id: number): Promise<CollectionField | null> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const { data, error } = await client
    .from('collection_fields')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch collection field: ${error.message}`);
  }
  
  return data;
}

/**
 * Create a new field
 */
export async function createField(fieldData: CreateCollectionFieldData): Promise<CollectionField> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const { data, error } = await client
    .from('collection_fields')
    .insert({
      ...fieldData,
      fillable: fieldData.fillable ?? true,
      built_in: fieldData.built_in ?? false,
      hidden: fieldData.hidden ?? false,
      data: fieldData.data ?? {},
      status: fieldData.status || 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create collection field: ${error.message}`);
  }
  
  return data;
}

/**
 * Update a field
 */
export async function updateField(id: number, fieldData: UpdateCollectionFieldData): Promise<CollectionField> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const { data, error } = await client
    .from('collection_fields')
    .update({
      ...fieldData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update collection field: ${error.message}`);
  }
  
  return data;
}

/**
 * Delete a field (soft delete)
 */
export async function deleteField(id: number): Promise<void> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const { error } = await client
    .from('collection_fields')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('deleted_at', null);
  
  if (error) {
    throw new Error(`Failed to delete collection field: ${error.message}`);
  }
}

/**
 * Reorder fields
 */
export async function reorderFields(collection_id: string, field_ids: number[]): Promise<void> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  // Update order for each field
  const updates = field_ids.map((field_id, index) => 
    client
      .from('collection_fields')
      .update({ 
        order: index,
        updated_at: new Date().toISOString(),
      })
      .eq('id', field_id)
      .eq('collection_id', collection_id)
      .is('deleted_at', null)
  );
  
  const results = await Promise.all(updates);
  
  // Check for errors
  const errors = results.filter(r => r.error);
  if (errors.length > 0) {
    throw new Error(`Failed to reorder fields: ${errors[0].error?.message}`);
  }
}


