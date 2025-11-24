import { getSupabaseAdmin } from '../supabase-server';
import type { CollectionItem, CollectionItemWithValues } from '@/types';
import { randomUUID } from 'crypto';
import { getFieldsByCollectionId } from './collectionFieldRepository';
import { getValuesByFieldId, getValuesByItemIds } from './collectionItemValueRepository';

/**
 * Collection Item Repository
 *
 * Handles CRUD operations for collection items (EAV entities).
 * Items are the actual content entries in a collection.
 * Uses Supabase/PostgreSQL via admin client.
 *
 * NOTE: Uses composite primary key (id, is_published) architecture.
 * References parent collections using FK (collection_id).
 */

export interface QueryFilters {
  deleted?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get top N items per collection for multiple collections in one query
 * Uses window function (ROW_NUMBER() OVER PARTITION BY) for efficient batch loading
 * @param collectionIds - Array of collection UUIDs
 * @param is_published - Filter for draft (false) or published (true) items. Defaults to false (draft).
 * @param limit - Number of items per collection. Defaults to 10.
 */
export async function getTopItemsPerCollection(
  collectionIds: string[],
  is_published: boolean = false,
  limit: number = 10
): Promise<CollectionItem[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  if (collectionIds.length === 0) {
    return [];
  }

  // Use raw SQL with window function to get top N items per collection
  const { data, error } = await client.rpc('get_top_items_per_collection', {
    p_collection_ids: collectionIds,
    p_is_published: is_published,
    p_limit: limit,
  });

  if (error) {
    // Fallback to manual approach if RPC doesn't exist yet
    const { data: manualData, error: manualError } = await client
      .from('collection_items')
      .select('*')
      .in('collection_id', collectionIds)
      .eq('is_published', is_published)
      .is('deleted_at', null)
      .order('collection_id', { ascending: true })
      .order('manual_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(collectionIds.length * limit);

    if (manualError) {
      throw new Error(`Failed to fetch items: ${manualError.message}`);
    }

    // Group by collection and take first N per collection
    const itemsByCollection: Record<string, CollectionItem[]> = {};
    manualData?.forEach(item => {
      if (!itemsByCollection[item.collection_id]) {
        itemsByCollection[item.collection_id] = [];
      }
      if (itemsByCollection[item.collection_id].length < limit) {
        itemsByCollection[item.collection_id].push(item);
      }
    });

    return Object.values(itemsByCollection).flat();
  }

  return data || [];
}

export interface CreateCollectionItemData {
  collection_id: string; // UUID
  manual_order?: number;
  is_published?: boolean;
}

export interface UpdateCollectionItemData {
  manual_order?: number;
}

/**
 * Get all items for a collection with pagination support
 * @param collection_id - Collection UUID
 * @param is_published - Filter for draft (false) or published (true) items. Defaults to false (draft).
 * @param filters - Optional query filters
 */
export async function getItemsByCollectionId(
  collection_id: string,
  is_published: boolean = false,
  filters?: QueryFilters
): Promise<{ items: CollectionItem[], total: number }> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // If search is provided, find matching item IDs from values table
  let matchingItemIds: string[] | null = null;
  if (filters?.search && filters.search.trim()) {
    const searchTerm = `%${filters.search.trim()}%`;

    // Query collection_item_values for matching values (same published state)
    const { data: matchingValues, error: searchError } = await client
      .from('collection_item_values')
      .select('item_id')
      .ilike('value', searchTerm)
      .eq('is_published', is_published)
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
    .eq('collection_id', collection_id)
    .eq('is_published', is_published);
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
    .eq('is_published', is_published)
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
 * @param id - Item UUID
 * @param isPublished - Get draft (false) or published (true) version. Defaults to false (draft).
 */
export async function getItemById(id: string, isPublished: boolean = false): Promise<CollectionItem | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('collection_items')
    .select('*')
    .eq('id', id)
    .eq('is_published', isPublished)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch collection item: ${error.message}`);
  }

  return data;
}

/**
 * Get item with all field values joined
 * Returns item with values as { field_id: value } object
 * @param id - Item UUID
 * @param is_published - Get draft (false) or published (true) values. Defaults to false (draft).
 */
export async function getItemWithValues(id: string, is_published: boolean = false): Promise<CollectionItemWithValues | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Get the item
  const item = await getItemById(id, is_published);
  if (!item) return null;

  // Build query for values
  let valuesQuery = client
    .from('collection_item_values')
    .select('value, field_id')
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

  // Transform to { field_id: value } object
  const values: Record<string, string> = {};
  valuesData?.forEach((row: any) => {
    if (row.field_id) {
      values[row.field_id] = row.value;
    }
  });

  return {
    ...item,
    values,
  };
}

/**
 * Get multiple items with their values
 * @param collection_id - Collection UUID
 * @param is_published - Filter for draft (false) or published (true) items and values. Defaults to false (draft).
 * @param filters - Optional query filters
 */
export async function getItemsWithValues(
  collection_id: string,
  is_published: boolean = false,
  filters?: QueryFilters
): Promise<{ items: CollectionItemWithValues[], total: number }> {
  const { items, total } = await getItemsByCollectionId(collection_id, is_published, filters);
  // Get all items with values in parallel
  // Values use the same is_published status as items
  const itemsWithValues = await Promise.all(
    items.map(item => getItemWithValues(item.id, is_published))
  );

  const filteredItems = itemsWithValues.filter((item): item is CollectionItemWithValues => item !== null);

  return { items: filteredItems, total };
}

/**
 * Get top N items with values for multiple collections in 2 queries
 * Uses optimized batch queries with PARTITION BY and WHERE IN
 * @param collectionIds - Array of collection UUIDs
 * @param is_published - Filter for draft (false) or published (true). Defaults to false (draft).
 * @param limit - Number of items per collection. Defaults to 10.
 */
export async function getTopItemsWithValuesPerCollection(
  collectionIds: string[],
  is_published: boolean = false,
  limit: number = 10
): Promise<Record<string, { items: CollectionItemWithValues[]; total: number }>> {
  if (collectionIds.length === 0) {
    return {};
  }

  // Query 1: Get top N items per collection using window function
  const items = await getTopItemsPerCollection(collectionIds, is_published, limit);

  if (items.length === 0) {
    // Return empty results for all collections
    const result: Record<string, { items: CollectionItemWithValues[]; total: number }> = {};
    collectionIds.forEach(id => {
      result[id] = { items: [], total: 0 };
    });
    return result;
  }

  // Query 2: Get all values for these items in one query
  const itemIds = items.map(item => item.id);
  const valuesByItem = await getValuesByItemIds(itemIds, is_published);

  // Combine items with their values
  const itemsWithValues: CollectionItemWithValues[] = items.map(item => ({
    ...item,
    values: valuesByItem[item.id] || {},
  }));

  // Group by collection_id
  const result: Record<string, { items: CollectionItemWithValues[]; total: number }> = {};

  // Initialize all collections
  collectionIds.forEach(id => {
    result[id] = { items: [], total: 0 };
  });

  // Populate with actual data
  itemsWithValues.forEach(item => {
    if (!result[item.collection_id]) {
      result[item.collection_id] = { items: [], total: 0 };
    }
    result[item.collection_id].items.push(item);
  });

  // Set total to the number of items we got (limited by N)
  Object.keys(result).forEach(collectionId => {
    result[collectionId].total = result[collectionId].items.length;
  });

  return result;
}

/**
 * Get the maximum ID value for the ID field in a collection
 * @param collection_id - Collection UUID
 * @param is_published - Filter for draft (false) or published (true) values. Defaults to false (draft).
 * @returns The maximum numeric ID value, or 0 if no IDs exist
 */
export async function getMaxIdValue(
  collection_id: string,
  is_published: boolean = false
): Promise<number> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Get all fields for the collection
  const fields = await getFieldsByCollectionId(collection_id, is_published);

  // Find the field with key = 'id'
  const idField = fields.find(field => field.key === 'id');

  if (!idField) {
    // No ID field exists, return 0
    return 0;
  }

  // Get all values for the ID field
  const idValues = await getValuesByFieldId(idField.id, is_published);

  if (idValues.length === 0) {
    return 0;
  }

  // Parse all ID values as numbers and find the maximum
  let maxId = 0;
  for (const value of idValues) {
    if (value.value) {
      const numericId = parseInt(value.value, 10);
      if (!isNaN(numericId) && numericId > maxId) {
        maxId = numericId;
      }
    }
  }

  return maxId;
}

/**
 * Create a new item
 */
export async function createItem(itemData: CreateCollectionItemData): Promise<CollectionItem> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const id = randomUUID();
  const isPublished = itemData.is_published ?? false;

  const { data, error } = await client
    .from('collection_items')
    .insert({
      id,
      ...itemData,
      manual_order: itemData.manual_order ?? 0,
      is_published: isPublished,
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
 * @param id - Item UUID
 * @param itemData - Data to update
 * @param isPublished - Which version to update: draft (false) or published (true). Defaults to false (draft).
 */
export async function updateItem(
  id: string,
  itemData: UpdateCollectionItemData,
  isPublished: boolean = false
): Promise<CollectionItem> {
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
    .eq('is_published', isPublished)
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
 * Only deletes the draft version by default.
 * @param id - Item UUID
 * @param isPublished - Which version to delete: draft (false) or published (true). Defaults to false (draft).
 */
export async function deleteItem(id: string, isPublished: boolean = false): Promise<void> {
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
    .eq('is_published', isPublished)
    .is('deleted_at', null);

  if (itemError) {
    throw new Error(`Failed to delete collection item: ${itemError.message}`);
  }

  // Soft delete all collection_item_values for this item (same published state)
  const { error: valuesError } = await client
    .from('collection_item_values')
    .update({
      deleted_at: now,
      updated_at: now,
    })
    .eq('item_id', id)
    .eq('is_published', isPublished)
    .is('deleted_at', null);

  if (valuesError) {
    throw new Error(`Failed to delete collection item values: ${valuesError.message}`);
  }
}

/**
 * Hard delete an item
 * Permanently removes item and all associated collection_item_values via CASCADE
 * Used during publish to permanently remove soft-deleted items
 * @param id - Item UUID
 * @param isPublished - Which version to delete: draft (false) or published (true). Defaults to false (draft).
 */
export async function hardDeleteItem(id: string, isPublished: boolean = false): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await client
    .from('collection_items')
    .delete()
    .eq('id', id)
    .eq('is_published', isPublished);

  if (error) {
    throw new Error(`Failed to hard delete collection item: ${error.message}`);
  }
}

/**
 * Duplicate a collection item with its draft values
 * Creates a copy of the item with a new ID and modified values
 * @param itemId - UUID of the item to duplicate
 * @param isPublished - Whether to duplicate draft (false) or published (true) version. Defaults to false (draft).
 */
export async function duplicateItem(itemId: string, isPublished: boolean = false): Promise<CollectionItemWithValues> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Get the original item with its values
  const originalItem = await getItemWithValues(itemId, isPublished);
  if (!originalItem) {
    throw new Error('Item not found');
  }

  // Get all items in the collection to find existing slugs
  const { items: allItems } = await getItemsWithValues(
    originalItem.collection_id,
    isPublished, // Filter items and values by is_published
    undefined
  );

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

  // Create the new item with a new UUID
  const newId = randomUUID();
  const { data: newItem, error: itemError } = await client
    .from('collection_items')
    .insert({
      id: newId,
      collection_id: originalItem.collection_id,
      manual_order: originalItem.manual_order,
      is_published: isPublished,
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
    .select('id, type')
    .eq('collection_id', originalItem.collection_id)
    .eq('is_published', isPublished)
    .is('deleted_at', null);

  if (fieldsError) {
    throw new Error(`Failed to fetch fields: ${fieldsError.message}`);
  }

  // Create set of valid field IDs
  const validFieldIds = new Set(fields?.map((field: any) => field.id) || []);

  // Create new values for the duplicated item
  const valuesToInsert = Object.entries(newValues)
    .filter(([fieldId]) => validFieldIds.has(fieldId)) // Only include fields that exist
    .map(([fieldId, value]) => ({
      id: randomUUID(),
      item_id: newItem.id,
      field_id: fieldId,
      value: value,
      is_published: isPublished,
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
 * @param collection_id - Collection UUID
 * @param is_published - Filter for draft (false) or published (true) items and values. Defaults to false (draft).
 * @param query - Search query string
 */
export async function searchItems(
  collection_id: string,
  is_published: boolean = false,
  query: string
): Promise<{ items: CollectionItemWithValues[], total: number }> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Get all items for this collection
  const { items, total } = await getItemsByCollectionId(collection_id, is_published);
  if (!query || query.trim() === '') {
    // Return all items with values if no query
    return getItemsWithValues(collection_id, is_published, undefined);
  }

  // Search in item values
  const searchTerm = `%${query.toLowerCase()}%`;

  const { data: matchingValues, error } = await client
    .from('collection_item_values')
    .select('item_id')
    .ilike('value', searchTerm)
    .eq('is_published', is_published)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to search items: ${error.message}`);
  }

  // Get unique item IDs
  const itemIds = [...new Set(matchingValues?.map(v => v.item_id) || [])];

  // Filter items and get with values
  const filteredItems = items.filter(item => itemIds.includes(item.id));

  const itemsWithValues = await Promise.all(
    filteredItems.map(item => getItemWithValues(item.id, is_published))
  ).then(results => results.filter((item): item is CollectionItemWithValues => item !== null));

  return { items: itemsWithValues, total: itemsWithValues.length };
}

/**
 * Publish an item
 * Creates or updates the published version by copying the draft
 * Uses upsert with composite primary key for simplicity
 * @param id - Item UUID
 */
export async function publishItem(id: string): Promise<CollectionItem> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Get the draft version
  const draft = await getItemById(id, false);
  if (!draft) {
    throw new Error('Draft item not found');
  }

  // Upsert published version (composite key handles insert/update automatically)
  const { data, error } = await client
    .from('collection_items')
    .upsert({
      id: draft.id, // Same UUID
      collection_id: draft.collection_id,
      manual_order: draft.manual_order,
      is_published: true,
      created_at: draft.created_at,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id,is_published', // Composite primary key
    }).select()
    .single();

  if (error) {
    throw new Error(`Failed to publish item: ${error.message}`);
  }

  return data;

}

/**
 * Get counts of unpublished items grouped by collection
 * An item is considered unpublished if:
 * - It has no published version (never published), OR
 * - Its draft data differs from published data
 *
 * NOTE: This only checks item metadata, not values. For values, use separate check.
 */
export async function getPublishableCountsByCollection(): Promise<Record<string, number>> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Get all draft collections
  const { data: collections, error: collectionsError } = await client
    .from('collections')
    .select('id')
    .eq('is_published', false)
    .is('deleted_at', null);

  if (collectionsError) {
    throw new Error(`Failed to fetch collections: ${collectionsError.message}`);
  }

  const counts: Record<string, number> = {};

  // For each collection, count items that need publishing
  for (const collection of collections || []) {
    // Get all draft items for this collection
    const { data: draftItems, error: itemsError } = await client
      .from('collection_items')
      .select('id, manual_order')
      .eq('collection_id', collection.id)
      .eq('is_published', false)
      .is('deleted_at', null);

    if (itemsError) {
      console.error(`Error fetching items for collection ${collection.id}:`, itemsError);
      counts[collection.id] = 0;
      continue;
    }

    if (!draftItems || draftItems.length === 0) {
      counts[collection.id] = 0;
      continue;
    }

    // Count items that need publishing
    let unpublishedCount = 0;

    for (const draftItem of draftItems) {
      // Check if published version exists
      const publishedItem = await getItemById(draftItem.id, true);

      if (!publishedItem) {
        // Never published
        unpublishedCount++;
        continue;
      }

      // Check if draft differs from published
      const hasChanges =

        draftItem.manual_order !== publishedItem.manual_order;

      if (hasChanges) {
        unpublishedCount++;
      }
    }

    counts[collection.id] = unpublishedCount;
  }

  return counts;
}
