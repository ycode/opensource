import { getSupabaseAdmin } from '../supabase-server';
import type { CollectionItem, CollectionItemWithValues } from '@/types';
import { generateRId } from '../collection-utils';

/**
 * Collection Item Repository
 * 
 * Handles CRUD operations for collection items (EAV entities).
 * Items are the actual content entries in a collection.
 * Uses Supabase/PostgreSQL via admin client.
 */

export interface QueryFilters {
  deleted?: boolean;
}

export interface CreateCollectionItemData {
  r_id?: string;
  collection_id: number;
  manual_order?: number;
}

export interface UpdateCollectionItemData {
  r_id?: string;
  manual_order?: number;
}

/**
 * Get all items for a collection
 */
export async function getItemsByCollectionId(
  collection_id: number,
  filters?: QueryFilters
): Promise<CollectionItem[]> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  let query = client
    .from('collection_items')
    .select('*')
    .eq('collection_id', collection_id)
    .order('manual_order', { ascending: true })
    .order('created_at', { ascending: false });
  
  // Apply filters
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
    throw new Error(`Failed to fetch collection items: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Get item by ID
 */
export async function getItemById(id: number): Promise<CollectionItem | null> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const { data, error } = await client
    .from('collection_items')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch collection item: ${error.message}`);
  }
  
  return data;
}

/**
 * Get item with all field values joined
 * Returns item with values as { field_name: value } object
 * @param id - Item ID
 * @param is_published - Get draft (false) or published (true) values. Defaults to false (draft).
 */
export async function getItemWithValues(id: number, is_published: boolean = false): Promise<CollectionItemWithValues | null> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  // Get the item
  const item = await getItemById(id);
  if (!item) return null;
  
  // Get all values for this item with field information
  const { data: valuesData, error: valuesError } = await client
    .from('collection_item_values')
    .select(`
      value,
      field_id,
      collection_fields!inner (
        field_name
      )
    `)
    .eq('item_id', id)
    .eq('is_published', is_published)
    .is('deleted_at', null);
  
  if (valuesError) {
    throw new Error(`Failed to fetch item values: ${valuesError.message}`);
  }
  
  // Transform to { field_name: value } object
  const values: Record<string, string> = {};
  valuesData?.forEach((row: any) => {
    const fieldName = row.collection_fields?.field_name;
    if (fieldName) {
      values[fieldName] = row.value;
    }
  });
  
  return {
    ...item,
    values,
  };
}

/**
 * Get multiple items with their values
 * @param collection_id - Collection ID
 * @param filters - Optional query filters
 * @param is_published - Get draft (false) or published (true) values. Defaults to false (draft).
 */
export async function getItemsWithValues(
  collection_id: number,
  filters?: QueryFilters,
  is_published: boolean = false
): Promise<CollectionItemWithValues[]> {
  const items = await getItemsByCollectionId(collection_id, filters);
  
  // Get all items with values in parallel
  const itemsWithValues = await Promise.all(
    items.map(item => getItemWithValues(item.id, is_published))
  );
  
  return itemsWithValues.filter((item): item is CollectionItemWithValues => item !== null);
}

/**
 * Create a new item
 */
export async function createItem(itemData: CreateCollectionItemData): Promise<CollectionItem> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const { data, error } = await client
    .from('collection_items')
    .insert({
      ...itemData,
      r_id: itemData.r_id || generateRId(),
      manual_order: itemData.manual_order ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create collection item: ${error.message}`);
  }
  
  return data;
}

/**
 * Update an item
 */
export async function updateItem(id: number, itemData: UpdateCollectionItemData): Promise<CollectionItem> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const { data, error } = await client
    .from('collection_items')
    .update({
      ...itemData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update collection item: ${error.message}`);
  }
  
  return data;
}

/**
 * Delete an item (soft delete)
 */
export async function deleteItem(id: number): Promise<void> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const { error } = await client
    .from('collection_items')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .is('deleted_at', null);
  
  if (error) {
    throw new Error(`Failed to delete collection item: ${error.message}`);
  }
}

/**
 * Search items by field values
 */
export async function searchItems(
  collection_id: number,
  query: string
): Promise<CollectionItemWithValues[]> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  // Get all items for this collection
  const items = await getItemsByCollectionId(collection_id);
  
  if (!query || query.trim() === '') {
    // Return all items with values if no query
    return getItemsWithValues(collection_id);
  }
  
  // Search in item values
  const searchTerm = `%${query.toLowerCase()}%`;
  
  const { data: matchingValues, error } = await client
    .from('collection_item_values')
    .select('item_id')
    .ilike('value', searchTerm)
    .is('deleted_at', null);
  
  if (error) {
    throw new Error(`Failed to search items: ${error.message}`);
  }
  
  // Get unique item IDs
  const itemIds = [...new Set(matchingValues?.map(v => v.item_id) || [])];
  
  // Filter items and get with values
  const filteredItems = items.filter(item => itemIds.includes(item.id));
  
  return Promise.all(
    filteredItems.map(item => getItemWithValues(item.id))
  ).then(results => results.filter((item): item is CollectionItemWithValues => item !== null));
}

/**
 * Get counts of unpublished items grouped by collection
 * An item is considered unpublished if:
 * - It has no published values (never published), OR
 * - Its draft values differ from published values (needs republishing)
 */
export async function getPublishableCountsByCollection(): Promise<Record<number, number>> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  // Get all collections
  const { data: collections, error: collectionsError } = await client
    .from('collections')
    .select('id')
    .is('deleted_at', null);
  
  if (collectionsError) {
    throw new Error(`Failed to fetch collections: ${collectionsError.message}`);
  }
  
  const counts: Record<number, number> = {};
  
  // For each collection, count items that need publishing
  for (const collection of collections || []) {
    // Get all items for this collection
    const { data: items, error: itemsError } = await client
      .from('collection_items')
      .select('id')
      .eq('collection_id', collection.id)
      .is('deleted_at', null);
    
    if (itemsError) {
      console.error(`Error fetching items for collection ${collection.id}:`, itemsError);
      counts[collection.id] = 0;
      continue;
    }
    
    if (!items || items.length === 0) {
      counts[collection.id] = 0;
      continue;
    }
    
    // Count items that need publishing
    let unpublishedCount = 0;
    
    for (const item of items) {
      // Get draft values
      const { data: draftValues, error: draftError } = await client
        .from('collection_item_values')
        .select('field_id, value')
        .eq('item_id', item.id)
        .eq('is_published', false)
        .is('deleted_at', null);
      
      if (draftError) {
        console.error(`Error fetching draft values for item ${item.id}:`, draftError);
        continue;
      }
      
      // Get published values
      const { data: publishedValues, error: publishedError } = await client
        .from('collection_item_values')
        .select('field_id, value')
        .eq('item_id', item.id)
        .eq('is_published', true)
        .is('deleted_at', null);
      
      if (publishedError) {
        console.error(`Error fetching published values for item ${item.id}:`, publishedError);
        continue;
      }
      
      // If no published values, item is unpublished
      if (!publishedValues || publishedValues.length === 0) {
        unpublishedCount++;
        continue;
      }
      
      // Check if draft differs from published
      const isDifferent = hasChanges(draftValues || [], publishedValues);
      
      if (isDifferent) {
        unpublishedCount++;
      }
    }
    
    counts[collection.id] = unpublishedCount;
  }
  
  return counts;
}

/**
 * Helper to check if draft values differ from published values
 */
function hasChanges(
  draftValues: Array<{ field_id: number; value: string | null }>,
  publishedValues: Array<{ field_id: number; value: string | null }>
): boolean {
  // Create maps for easy comparison
  const draftMap = new Map(draftValues.map(v => [v.field_id, v.value]));
  const publishedMap = new Map(publishedValues.map(v => [v.field_id, v.value]));
  
  // Check if number of fields differs
  if (draftMap.size !== publishedMap.size) {
    return true;
  }
  
  // Check if any draft value differs from published
  for (const [fieldId, draftValue] of draftMap) {
    const publishedValue = publishedMap.get(fieldId);
    
    // Field doesn't exist in published or value differs
    if (publishedValue === undefined || draftValue !== publishedValue) {
      return true;
    }
  }
  
  return false;
}

