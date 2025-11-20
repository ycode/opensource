import { getSupabaseAdmin } from '../supabase-server';
import type { Collection, CreateCollectionData, UpdateCollectionData } from '@/types';
import { randomUUID } from 'crypto';

/**
 * Collection Repository
 *
 * Handles CRUD operations for collections (content types).
 * Uses Supabase/PostgreSQL via admin client.
 *
 * NOTE: Uses composite primary key (id, is_published) architecture.
 * All queries must specify is_published filter.
 */

export interface QueryFilters {
  is_published?: boolean;
  deleted?: boolean;
}

/**
 * Get all collections
 * @param filters - Optional filters (is_published, deleted)
 * @param filters.is_published - Get draft (false) or published (true) collections. Defaults to false (draft).
 */
export async function getAllCollections(filters?: QueryFilters): Promise<Collection[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const isPublished = filters?.is_published ?? false;

  let query = client
    .from('collections')
    .select(`
      *,
      collection_items!left(id, deleted_at, is_published)
    `)
    .eq('is_published', isPublished)
    .order('order', { ascending: true })
    .order('created_at', { ascending: false });

  // Apply deleted filter
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
    // Count only non-deleted items that match the same is_published state
    const draft_items_count = items.filter((item: any) =>
      item.deleted_at === null && item.is_published === isPublished
    ).length;

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
 * Get collection by ID
 * @param id - Collection UUID
 * @param isPublished - Get draft (false) or published (true) version. Defaults to false (draft).
 * @param includeDeleted - Whether to include soft-deleted collections. Defaults to false.
 */
export async function getCollectionById(
  id: string,
  isPublished: boolean = false,
  includeDeleted: boolean = false
): Promise<Collection | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  let query = client
    .from('collections')
    .select('*')
    .eq('id', id)
    .eq('is_published', isPublished);

  // Filter out deleted unless explicitly requested
  if (!includeDeleted) {
    query = query.is('deleted_at', null);
  }

  const { data, error } = await query.single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch collection: ${error.message}`);
  }

  return data;
}

/**
 * Get collection by name
 * @param name - Collection name
 * @param isPublished - Get draft (false) or published (true) version. Defaults to false (draft).
 */
export async function getCollectionByName(name: string, isPublished: boolean = false): Promise<Collection | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('collections')
    .select('*')
    .eq('name', name)
    .eq('is_published', isPublished)
    .is('deleted_at', null)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch collection: ${error.message}`);
  }

  return data;
}

/**
 * Create a new collection (draft by default)
 */
export async function createCollection(collectionData: CreateCollectionData): Promise<Collection> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const id = randomUUID();
  const isPublished = collectionData.is_published ?? false;

  const { data, error } = await client
    .from('collections')
    .insert({
      id,
      ...collectionData,
      order: collectionData.order ?? 0,
      is_published: isPublished,
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
 * @param id - Collection UUID
 * @param collectionData - Data to update
 * @param isPublished - Which version to update: draft (false) or published (true). Defaults to false (draft).
 */
export async function updateCollection(
  id: string,
  collectionData: UpdateCollectionData,
  isPublished: boolean = false
): Promise<Collection> {
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
    .eq('is_published', isPublished)
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
 * Also cascades soft delete to all related fields, items, and item values
 * @param id - Collection UUID
 * @param isPublished - Which version to delete: draft (false) or published (true). Defaults to false (draft).
 */
export async function deleteCollection(id: string, isPublished: boolean = false): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const now = new Date().toISOString();

  // Soft delete the collection
  const { error: collectionError } = await client
    .from('collections')
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .eq('is_published', isPublished)
    .is('deleted_at', null);

  if (collectionError) {
    throw new Error(`Failed to delete collection: ${collectionError.message}`);
  }

  // Soft delete all related fields
  const { error: fieldsError } = await client
    .from('collection_fields')
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .eq('collection_id', id)
    .eq('is_published', isPublished)
    .is('deleted_at', null);

  if (fieldsError) {
    console.error('Error soft-deleting collection fields:', fieldsError);
  }

  // Soft delete all related items
  const { error: itemsError } = await client
    .from('collection_items')
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .eq('collection_id', id)
    .eq('is_published', isPublished)
    .is('deleted_at', null);

  if (itemsError) {
    console.error('Error soft-deleting collection items:', itemsError);
  }

  // Soft delete all item values (these are linked to items via FK)
  // We need to get all items first to delete their values
  const { data: items } = await client
    .from('collection_items')
    .select('id')
    .eq('collection_id', id)
    .eq('is_published', isPublished);

  if (items && items.length > 0) {
    const itemIds = items.map(item => item.id);

    const { error: valuesError } = await client
      .from('collection_item_values')
      .update({
        deleted_at: now,
        updated_at: now,
      })
      .in('item_id', itemIds)
      .eq('is_published', isPublished)
      .is('deleted_at', null);

    if (valuesError) {
      console.error('Error soft-deleting collection item values:', valuesError);
    }
  }
}

/**
 * Hard delete a collection and all its related data
 * This permanently removes the collection, fields, items, and item values
 * CASCADE constraints will handle the related data deletion
 * @param id - Collection UUID
 * @param isPublished - Which version to delete: draft (false) or published (true). Defaults to false (draft).
 */
export async function hardDeleteCollection(id: string, isPublished: boolean = false): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Hard delete the collection (CASCADE will delete all related data)
  const { error } = await client
    .from('collections')
    .delete()
    .eq('id', id)
    .eq('is_published', isPublished);

  if (error) {
    throw new Error(`Failed to hard delete collection: ${error.message}`);
  }
}

/**
 * Publish a collection
 * Creates or updates the published version by copying the draft
 * Uses upsert with composite primary key for simplicity
 * @param id - Collection UUID
 */
export async function publishCollection(id: string): Promise<Collection> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Get the draft version
  const draft = await getCollectionById(id, false);
  if (!draft) {
    throw new Error('Draft collection not found');
  }

  // Upsert published version (composite key handles insert/update automatically)
  const { data, error } = await client
    .from('collections')
    .upsert({
      id: draft.id, // Same UUID
      name: draft.name,
      sorting: draft.sorting,
      order: draft.order,
      is_published: true,
      created_at: draft.created_at,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id,is_published', // Composite primary key
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to publish collection: ${error.message}`);
  }

  return data;
}

/**
 * Get all unpublished collections
 * A collection needs publishing if:
 * - Published version doesn't exist, OR
 * - Draft data differs from published data
 */
export async function getUnpublishedCollections(): Promise<Collection[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Get all draft collections
  const draftCollections = await getAllCollections({ is_published: false });

  const unpublishedCollections: Collection[] = [];

  for (const draft of draftCollections) {
    // Check if published version exists
    const published = await getCollectionById(draft.id, true);

    if (!published) {
      // Never published
      unpublishedCollections.push(draft);
      continue;
    }

    // Check if draft differs from published
    const hasChanges =
    draft.name !== published.name ||
    JSON.stringify(draft.sorting) !== JSON.stringify(published.sorting) ||
    draft.order !== published.order;

    if (hasChanges) {
      unpublishedCollections.push(draft);
    }
  }

  return unpublishedCollections;
}
