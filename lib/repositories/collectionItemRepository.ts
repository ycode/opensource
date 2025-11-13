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
  search?: string;
  limit?: number;
  offset?: number;
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
 * Get all items for a collection with pagination support
 */
export async function getItemsByCollectionId(
  collection_id: number,
  filters?: QueryFilters
): Promise<{ items: CollectionItem[], total: number }> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  // If search is provided, find matching item IDs from values table
  let matchingItemIds: number[] | null = null;
  if (filters?.search && filters.search.trim()) {
    const searchTerm = `%${filters.search.trim()}%`;
    
    // Query collection_item_values for matching values (draft only)
    const { data: matchingValues, error: searchError } = await client
      .from('collection_item_values')
      .select('item_id')
      .ilike('value', searchTerm)
      .eq('is_published', false)
      .is('deleted_at', null);
    
    if (searchError) {
      throw new Error(`Failed to search items: ${searchError.message}`);
    }
    
    if (matchingValues) {
      // Get unique item IDs
      matchingItemIds = [...new Set(matchingValues.map(v => v.item_id))];
      
      // If no matches found, return early
      if (matchingItemIds.length === 0) {
        return { items: [], total: 0 };
      }
    }
  }
  
  // Build base query for counting
  let countQuery = client
    .from('collection_items')
    .select('*', { count: 'exact', head: true })
    .eq('collection_id', collection_id);
  
  // Apply search filter to count query
  if (matchingItemIds !== null) {
    countQuery = countQuery.in('id', matchingItemIds);
  }
  
  // Apply deleted filter to count query
  if (filters && 'deleted' in filters) {
    if (filters.deleted === false) {
      countQuery = countQuery.is('deleted_at', null);
    } else if (filters.deleted === true) {
      countQuery = countQuery.not('deleted_at', 'is', null);
    }
  } else {
    countQuery = countQuery.is('deleted_at', null);
  }
  
  // Execute count query
  const { count, error: countError } = await countQuery;
  
  if (countError) {
    throw new Error(`Failed to count collection items: ${countError.message}`);
  }
  
  // Build query for fetching items
  let query = client
    .from('collection_items')
    .select('*')
    .eq('collection_id', collection_id)
    .order('manual_order', { ascending: true })
    .order('created_at', { ascending: false });
  
  // Apply search filter if we found matching items
  if (matchingItemIds !== null) {
    query = query.in('id', matchingItemIds);
  }
  
  // Apply filters - only filter deleted_at when explicitly specified
  if (filters && 'deleted' in filters) {
    if (filters.deleted === false) {
      query = query.is('deleted_at', null);
    } else if (filters.deleted === true) {
      query = query.not('deleted_at', 'is', null);
    }
    // If deleted is explicitly undefined, include all items (no filter)
  } else {
    // No filters provided: default to excluding deleted items
    query = query.is('deleted_at', null);
  }
  
  // Apply pagination
  if (filters?.limit !== undefined) {
    query = query.limit(filters.limit);
  }
  if (filters?.offset !== undefined) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 25) - 1);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Failed to fetch collection items: ${error.message}`);
  }
  
  return { items: data || [], total: count || 0 };
}

/**
 * Get item by ID
 * Includes deleted items (deleted_at can be set)
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
  
  // Build query for values
  let valuesQuery = client
    .from('collection_item_values')
    .select(`
      value,
      field_id,
      collection_fields!inner (
        field_name
      )
    `)
    .eq('item_id', id)
    .eq('is_published', is_published);
  
  // If the item itself is deleted, include deleted values (to show name in UI)
  // Otherwise, exclude deleted values
  if (!item.deleted_at) {
    valuesQuery = valuesQuery.is('deleted_at', null);
  }
  
  const { data: valuesData, error: valuesError } = await valuesQuery;
  
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
): Promise<{ items: CollectionItemWithValues[], total: number }> {
  const { items, total } = await getItemsByCollectionId(collection_id, filters);
  
  // Get all items with values in parallel
  const itemsWithValues = await Promise.all(
    items.map(item => getItemWithValues(item.id, is_published))
  );
  
  const filteredItems = itemsWithValues.filter((item): item is CollectionItemWithValues => item !== null);
  
  return { items: filteredItems, total };
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
 * Sets deleted_at timestamp to mark item as deleted in draft
 * Also soft deletes all associated draft collection_item_values
 */
export async function deleteItem(id: number): Promise<void> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const now = new Date().toISOString();
  
  // Soft delete the collection item
  const { error: itemError } = await client
    .from('collection_items')
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .is('deleted_at', null);
  
  if (itemError) {
    throw new Error(`Failed to delete collection item: ${itemError.message}`);
  }
  
  // Soft delete all draft collection_item_values for this item
  const { error: valuesError } = await client
    .from('collection_item_values')
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .eq('item_id', id)
    .eq('is_published', false)
    .is('deleted_at', null);
  
  if (valuesError) {
    throw new Error(`Failed to delete collection item values: ${valuesError.message}`);
  }
}

/**
 * Hard delete an item
 * Permanently removes item and all associated collection_item_values via CASCADE
 * Used during publish to permanently remove soft-deleted items
 */
export async function hardDeleteItem(id: number): Promise<void> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const { error } = await client
    .from('collection_items')
    .delete()
    .eq('id', id);
  
  if (error) {
    throw new Error(`Failed to hard delete collection item: ${error.message}`);
  }
}

/**
 * Duplicate a collection item with its draft values
 * Creates a copy of the item with a new slug and modified name
 * @param itemId - ID of the item to duplicate
 * @returns Promise resolving to the new duplicated item with values
 */
export async function duplicateItem(itemId: number): Promise<CollectionItemWithValues> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  // Get the original item with its draft values
  const originalItem = await getItemWithValues(itemId, false);
  if (!originalItem) {
    throw new Error('Item not found');
  }
  
  // Get all items in the collection to find highest ID and existing slugs
  const { items: allItems } = await getItemsWithValues(originalItem.collection_id, undefined, false);
  
  // Prepare the new values
  const newValues = { ...originalItem.values };
  
  // Auto-increment the ID field
  if (newValues.id) {
    // Find the highest ID among all items
    let highestId = 0;
    allItems.forEach(item => {
      if (item.values.id) {
        const itemId = parseInt(item.values.id, 10);
        if (!isNaN(itemId)) {
          highestId = Math.max(highestId, itemId);
        }
      }
    });
    // Set new auto-incremented ID
    newValues.id = String(highestId + 1);
  }
  
  // Update auto-generated timestamp fields
  const now = new Date().toISOString();
  if (newValues.created_at) {
    newValues.created_at = now;
  }
  if (newValues.updated_at) {
    newValues.updated_at = now;
  }
  
  // Add " (Copy)" to the name field if it exists
  if (newValues.name) {
    newValues.name = `${newValues.name} (Copy)`;
  }
  
  // Generate unique slug if slug field exists
  if (newValues.slug) {
    const originalSlug = newValues.slug;
    
    // Extract base slug (remove trailing numbers like -1, -2)
    const baseSlug = originalSlug.replace(/-\d+$/, '');
    
    // Find all slugs that match the base pattern
    const matchingSlugs = allItems
      .map(item => item.values.slug)
      .filter(slug => slug && (slug === baseSlug || slug.startsWith(`${baseSlug}-`)));
    
    // Extract numbers from matching slugs and find the highest
    let highestNumber = 0;
    matchingSlugs.forEach(slug => {
      if (slug === baseSlug) {
        highestNumber = Math.max(highestNumber, 0);
      } else {
        const match = slug.match(/-(\d+)$/);
        if (match) {
          const num = parseInt(match[1], 10);
          highestNumber = Math.max(highestNumber, num);
        }
      }
    });
    
    // Generate new slug with incremented number
    newValues.slug = `${baseSlug}-${highestNumber + 1}`;
  }
  
  // Create the new item
  const { data: newItem, error: itemError } = await client
    .from('collection_items')
    .insert({
      collection_id: originalItem.collection_id,
      r_id: generateRId(),
      manual_order: originalItem.manual_order,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (itemError) {
    throw new Error(`Failed to create duplicate item: ${itemError.message}`);
  }
  
  // Get field mappings for the collection
  const { data: fields, error: fieldsError } = await client
    .from('collection_fields')
    .select('id, field_name, type')
    .eq('collection_id', originalItem.collection_id)
    .is('deleted_at', null);
  
  if (fieldsError) {
    throw new Error(`Failed to fetch fields: ${fieldsError.message}`);
  }
  
  // Create mapping of field_name -> field_id
  const fieldMap: Record<string, number> = {};
  fields?.forEach((field: any) => {
    fieldMap[field.field_name] = field.id;
  });
  
  // Create new draft values for the duplicated item
  const valuesToInsert = Object.entries(newValues)
    .filter(([fieldName]) => fieldMap[fieldName]) // Only include fields that exist
    .map(([fieldName, value]) => ({
      item_id: newItem.id,
      field_id: fieldMap[fieldName],
      value: value,
      is_published: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  
  if (valuesToInsert.length > 0) {
    const { error: valuesError } = await client
      .from('collection_item_values')
      .insert(valuesToInsert);
    
    if (valuesError) {
      // If values insertion fails, we should still return the item
      // but log the error
      console.error('Failed to duplicate values:', valuesError);
    }
  }
  
  // Return the new item with its values
  return {
    ...newItem,
    values: newValues,
  };
}

/**
 * Search items by field values
 */
export async function searchItems(
  collection_id: number,
  query: string
): Promise<{ items: CollectionItemWithValues[], total: number }> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  // Get all items for this collection
  const { items, total } = await getItemsByCollectionId(collection_id);
  
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
  
  const itemsWithValues = await Promise.all(
    filteredItems.map(item => getItemWithValues(item.id))
  ).then(results => results.filter((item): item is CollectionItemWithValues => item !== null));
  
  return { items: itemsWithValues, total: itemsWithValues.length };
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

