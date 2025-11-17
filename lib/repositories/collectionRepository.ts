import { getSupabaseAdmin } from '../supabase-server';
import type { Collection } from '@/types';

/**
 * Collection Repository
 * 
 * Handles CRUD operations for collections (content types).
 * Uses Supabase/PostgreSQL via admin client.
 */

export interface QueryFilters {
  status?: 'draft' | 'published';
  deleted?: boolean;
}

export interface CreateCollectionData {
  name: string;
  sorting?: Record<string, any> | null;
  order?: number | null;
  status?: 'draft' | 'published';
}

export interface UpdateCollectionData {
  name?: string;
  sorting?: Record<string, any> | null;
  order?: number | null;
  status?: 'draft' | 'published';
}

/**
 * Get all collections
 */
export async function getAllCollections(filters?: QueryFilters): Promise<Collection[]> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  let query = client
    .from('collections')
    .select(`
      *,
      collection_items!left(id, deleted_at)
    `)
    .order('order', { ascending: true })
    .order('created_at', { ascending: false });
  
  // Apply filters
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  
  if (filters?.deleted === false) {
    query = query.is('deleted_at', null);
  } else if (filters?.deleted === true) {
    query = query.not('deleted_at', 'is', null);
  } else {
    // Default: exclude deleted
    query = query.is('deleted_at', null);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch collections: ${error.message}`);
  }
  
  // Process the data to add draft_items_count
  const collections = (data || []).map((collection: any) => {
    const items = collection.collection_items || [];
    // Count only non-deleted items
    const draft_items_count = items.filter((item: any) => item.deleted_at === null).length;
    
    // Remove the joined data and add the count
    const { collection_items, ...collectionData } = collection;
    return {
      ...collectionData,
      draft_items_count,
    };
  });
  
  return collections;
}

/**
 * Get collection by ID (UUID)
 */
export async function getCollectionById(id: string): Promise<Collection | null> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const { data, error } = await client
    .from('collections')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch collection: ${error.message}`);
  }
  
  return data;
}

/**
 * Get collection by UUID
 */
export async function getCollectionByUuid(uuid: string): Promise<Collection | null> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const { data, error } = await client
    .from('collections')
    .select('*')
    .eq('uuid', uuid)
    .is('deleted_at', null)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch collection: ${error.message}`);
  }
  
  return data;
}

/**
 * Create a new collection
 */
export async function createCollection(collectionData: CreateCollectionData): Promise<Collection> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const { data, error } = await client
    .from('collections')
    .insert({
      ...collectionData,
      status: collectionData.status || 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create collection: ${error.message}`);
  }
  
  return data;
}

/**
 * Update a collection
 */
export async function updateCollection(id: string, collectionData: UpdateCollectionData): Promise<Collection> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const { data, error } = await client
    .from('collections')
    .update({
      ...collectionData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update collection: ${error.message}`);
  }
  
  return data;
}

/**
 * Delete a collection (soft delete)
 */
export async function deleteCollection(id: string): Promise<void> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const { error } = await client
    .from('collections')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('deleted_at', null);
  
  if (error) {
    throw new Error(`Failed to delete collection: ${error.message}`);
  }
}


