/**
 * Collection Publishing Service
 * 
 * Dedicated service for publishing collections using composite key architecture.
 * Provides transactional publishing with rollback capability.
 * 
 * Key Features:
 * - Collections & Fields: Always published completely
 * - Items: Selective publishing (user can choose specific items)
 * - Values: Published automatically with their items
 * - Transactional: All-or-nothing approach with error handling
 */

import { withTransaction } from '../database/transaction';
import { getSupabaseAdmin } from '../supabase-server';
import {
  getCollectionById,
  publishCollection,
  hardDeleteCollection,
} from '../repositories/collectionRepository';
import {
  getFieldsByCollectionId,
  getFieldById,
  publishField,
  hardDeleteField,
} from '../repositories/collectionFieldRepository';
import {
  getItemsByCollectionId,
  getItemById,
  publishItem,
  hardDeleteItem,
} from '../repositories/collectionItemRepository';
import {
  getValuesByItemId,
  publishValues,
} from '../repositories/collectionItemValueRepository';

/**
 * Options for publishing a collection
 */
export interface PublishCollectionOptions {
  collectionId: string;
  itemIds?: string[]; // Optional: specific items to publish. If omitted, publish all
}

/**
 * Result of a collection publishing operation
 */
export interface PublishCollectionResult {
  success: boolean;
  collectionId: string;
  published: {
    collection: boolean;
    fieldsCount: number;
    itemsCount: number;
    valuesCount: number;
  };
  errors?: string[];
}

/**
 * Batch publishing options
 */
export interface BatchPublishOptions {
  publishes: PublishCollectionOptions[];
}

/**
 * Batch publishing result
 */
export interface BatchPublishResult {
  results: PublishCollectionResult[];
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

/**
 * Main entry point: Publish a single collection with optional item selection
 * 
 * @param options - Publishing options
 * @returns Publishing result with counts and status
 * 
 * @example
 * // Publish entire collection (all items)
 * const result = await publishCollection({ collectionId: 'abc-123' });
 * 
 * // Publish collection with specific items only
 * const result = await publishCollection({
 *   collectionId: 'abc-123',
 *   itemIds: ['item-1', 'item-2', 'item-3']
 * });
 */
export async function publishCollectionWithItems(
  options: PublishCollectionOptions
): Promise<PublishCollectionResult> {
  const { collectionId, itemIds } = options;
  
  const result: PublishCollectionResult = {
    success: false,
    collectionId,
    published: {
      collection: false,
      fieldsCount: 0,
      itemsCount: 0,
      valuesCount: 0,
    },
    errors: [],
  };
  
  try {
    console.log(`[Publishing] Starting publish for collection ${collectionId}`);
    
    // Check if the draft collection is soft-deleted (include deleted collections in query)
    const draftCollection = await getCollectionById(collectionId, false, true);
    
    // If draft is deleted, clean up both draft and published versions
    if (draftCollection && draftCollection.deleted_at) {
      console.log(`[Publishing] Collection ${collectionId} is soft-deleted, cleaning up...`);
      await cleanupDeletedCollection(collectionId);
      result.success = true;
      console.log(`[Publishing] ✅ Deleted collection ${collectionId} cleaned up successfully`);
      return result;
    }
    
    // Validate the request
    await validatePublishRequest(collectionId, itemIds);
    console.log(`[Publishing] Validation passed`);
    
    // Execute publishing within transaction context
    await withTransaction(async () => {
      // Step 1: Publish collection metadata
      console.log(`[Publishing] Step 1: Publishing collection metadata...`);
      await publishCollectionMetadata(collectionId);
      result.published.collection = true;
      console.log(`[Publishing] Step 1: Collection metadata published ✓`);
      
      // Step 2: Publish all fields
      console.log(`[Publishing] Step 2: Publishing fields...`);
      const fieldsCount = await publishAllFields(collectionId);
      result.published.fieldsCount = fieldsCount;
      console.log(`[Publishing] Step 2: ${fieldsCount} fields published ✓`);
      
      // Step 3: Publish selected items
      console.log(`[Publishing] Step 3: Publishing items...`);
      const { itemsCount, valuesCount } = await publishSelectedItems(
        collectionId,
        itemIds
      );
      result.published.itemsCount = itemsCount;
      result.published.valuesCount = valuesCount;
      console.log(`[Publishing] Step 3: ${itemsCount} items, ${valuesCount} values published ✓`);
      
      // Step 4: Clean up soft-deleted items in published version
      console.log(`[Publishing] Step 4: Cleaning up deleted items and fields...`);
      await cleanupDeletedPublishedItems(collectionId);
      await cleanupDeletedPublishedFields(collectionId);
      console.log(`[Publishing] Step 4: Cleanup complete ✓`);
    });
    
    result.success = true;
    console.log(`[Publishing] ✅ Publishing completed successfully for collection ${collectionId}`);
  } catch (error) {
    result.success = false;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.errors = [errorMessage];
    console.error(`[Publishing] ❌ Error publishing collection ${collectionId}:`, error);
  }
  
  return result;
}

/**
 * Batch publish multiple collections
 * 
 * @param options - Batch publishing options
 * @returns Batch result with summary
 * 
 * @example
 * const result = await publishCollections({
 *   publishes: [
 *     { collectionId: 'abc-123' }, // All items
 *     { collectionId: 'def-456', itemIds: ['item-x'] } // Specific item
 *   ]
 * });
 */
export async function publishCollections(
  options: BatchPublishOptions
): Promise<BatchPublishResult> {
  const results: PublishCollectionResult[] = [];
  
  // Publish each collection sequentially to avoid conflicts
  for (const publishOptions of options.publishes) {
    const result = await publishCollectionWithItems(publishOptions);
    results.push(result);
  }
  
  // Calculate summary
  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  return {
    results,
    summary: {
      total: results.length,
      succeeded,
      failed,
    },
  };
}

/**
 * Validate publishing request
 * Ensures collection exists and item IDs are valid
 */
async function validatePublishRequest(
  collectionId: string,
  itemIds?: string[]
): Promise<void> {
  // Check if draft collection exists
  const draftCollection = await getCollectionById(collectionId, false);
  if (!draftCollection) {
    throw new Error(`Draft collection ${collectionId} not found`);
  }
  
  // If specific item IDs provided, validate they exist
  if (itemIds && itemIds.length > 0) {
    for (const itemId of itemIds) {
      const item = await getItemById(itemId, false);
      if (!item) {
        throw new Error(`Draft item ${itemId} not found`);
      }
      if (item.collection_id !== collectionId) {
        throw new Error(`Item ${itemId} does not belong to collection ${collectionId}`);
      }
    }
  }
}

/**
 * Publish collection metadata
 * Creates or updates the published version
 */
async function publishCollectionMetadata(collectionId: string): Promise<void> {
  console.log(`[publishCollectionMetadata] Publishing collection ${collectionId}...`);
  const result = await publishCollection(collectionId);
  console.log(`[publishCollectionMetadata] Result:`, result);
}

/**
 * Publish all fields for a collection
 * Fields are always published completely (non-selective)
 * 
 * @returns Number of fields published
 */
async function publishAllFields(collectionId: string): Promise<number> {
  // Get all draft fields
  const draftFields = await getFieldsByCollectionId(collectionId, false);
  console.log(`[publishAllFields] Found ${draftFields.length} draft fields`);
  
  // Publish each field
  for (const field of draftFields) {
    console.log(`[publishAllFields] Publishing field ${field.id} (${field.field_name})...`);
    const result = await publishField(field.id);
    console.log(`[publishAllFields] Field published:`, result);
  }
  
  return draftFields.length;
}

/**
 * Publish selected items and their values
 * 
 * @param collectionId - Collection UUID
 * @param itemIds - Optional array of item IDs to publish. If omitted, publishes all items that need publishing
 * @returns Counts of published items and values
 */
async function publishSelectedItems(
  collectionId: string,
  itemIds?: string[]
): Promise<{ itemsCount: number; valuesCount: number }> {
  let itemsToPublish: string[];
  
  if (itemIds && itemIds.length > 0) {
    // Publish specific items
    itemsToPublish = itemIds;
    console.log(`[publishSelectedItems] Publishing ${itemIds.length} specific items`);
  } else {
    // Publish all items that need publishing
    itemsToPublish = await getUnpublishedItemIds(collectionId);
    console.log(`[publishSelectedItems] Found ${itemsToPublish.length} unpublished items`);
  }
  
  let itemsCount = 0;
  let valuesCount = 0;
  
  // Publish each item and its values
  for (const itemId of itemsToPublish) {
    console.log(`[publishSelectedItems] Publishing item ${itemId}...`);
    
    // Publish item metadata
    const itemResult = await publishItem(itemId);
    console.log(`[publishSelectedItems] Item published:`, itemResult);
    itemsCount++;
    
    // Publish all values for this item
    console.log(`[publishSelectedItems] Publishing values for item ${itemId}...`);
    const publishedValuesCount = await publishItemValues(itemId);
    console.log(`[publishSelectedItems] ${publishedValuesCount} values published`);
    valuesCount += publishedValuesCount;
  }
  
  return { itemsCount, valuesCount };
}

/**
 * Publish values for a specific item
 * 
 * @param itemId - Item UUID
 * @returns Number of values published
 */
async function publishItemValues(itemId: string): Promise<number> {
  // Get draft values for this item
  const draftValues = await getValuesByItemId(itemId, false, false);
  console.log(`[publishItemValues] Found ${draftValues.length} draft values for item ${itemId}`);
  
  // Publish all values
  const count = await publishValues(itemId);
  console.log(`[publishItemValues] publishValues returned count: ${count}`);
  
  return draftValues.length;
}

/**
 * Get list of item IDs that need publishing
 * An item needs publishing if:
 * - Published version doesn't exist, OR
 * - Draft data differs from published data
 */
async function getUnpublishedItemIds(collectionId: string): Promise<string[]> {
  // Get all draft items for this collection
  const { items: draftItems } = await getItemsByCollectionId(collectionId, false);
  
  const unpublishedItemIds: string[] = [];
  
  for (const draftItem of draftItems) {
    // Check if published version exists
    const publishedItem = await getItemById(draftItem.id, true);
    
    if (!publishedItem) {
      // Never published
      unpublishedItemIds.push(draftItem.id);
      continue;
    }
    
    // Check if draft differs from published (metadata)
    const metadataChanged = 
      draftItem.r_id !== publishedItem.r_id ||
      draftItem.manual_order !== publishedItem.manual_order;
    
    if (metadataChanged) {
      unpublishedItemIds.push(draftItem.id);
      continue;
    }
    
    // Check if values differ
    const valuesChanged = await hasValueChanges(draftItem.id);
    if (valuesChanged) {
      unpublishedItemIds.push(draftItem.id);
    }
  }
  
  return unpublishedItemIds;
}

/**
 * Check if draft values differ from published values
 */
async function hasValueChanges(itemId: string): Promise<boolean> {
  const draftValues = await getValuesByItemId(itemId, false, false);
  const publishedValues = await getValuesByItemId(itemId, true, true);
  
  // Create maps for comparison
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

/**
 * Clean up soft-deleted items in both draft and published versions
 * If a draft item is soft-deleted, permanently remove both draft and published versions
 */
async function cleanupDeletedPublishedItems(collectionId: string): Promise<void> {
  // Get all items (including soft-deleted) from draft
  const { items: draftItems } = await getItemsByCollectionId(
    collectionId,
    false,
    { deleted: true } // Include deleted items
  );
  
  // Find soft-deleted items
  const deletedDraftItems = draftItems.filter(item => item.deleted_at !== null);
  
  console.log(`[cleanupDeletedPublishedItems] Found ${deletedDraftItems.length} soft-deleted draft items`);
  
  // Hard delete both published and draft versions
  for (const deletedItem of deletedDraftItems) {
    try {
      // Check if published version exists
      const publishedItem = await getItemById(deletedItem.id, true);
      
      if (publishedItem) {
        // Hard delete the published version (CASCADE will delete values)
        console.log(`[cleanupDeletedPublishedItems] Hard deleting published item ${deletedItem.id}`);
        await hardDeleteItem(deletedItem.id, true);
      }
      
      // Also hard delete the draft version (CASCADE will delete values)
      console.log(`[cleanupDeletedPublishedItems] Hard deleting draft item ${deletedItem.id}`);
      await hardDeleteItem(deletedItem.id, false);
    } catch (error) {
      // Log but don't fail the entire publish operation
      console.error(`Failed to cleanup item ${deletedItem.id}:`, error);
    }
  }
}

/**
 * Clean up soft-deleted fields in both draft and published versions
 * If a draft field is soft-deleted, permanently remove both draft and published versions
 * This also removes all associated collection_item_values via CASCADE
 */
async function cleanupDeletedPublishedFields(collectionId: string): Promise<void> {
  // Get all fields (including soft-deleted) from draft by querying directly
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  // Query for soft-deleted draft fields
  const { data: deletedDraftFields, error } = await client
    .from('collection_fields')
    .select('*')
    .eq('collection_id', collectionId)
    .eq('collection_is_published', false)
    .eq('is_published', false)
    .not('deleted_at', 'is', null); // Only get deleted fields
  
  if (error) {
    console.error(`Error fetching deleted fields:`, error);
    return;
  }
  
  if (!deletedDraftFields || deletedDraftFields.length === 0) {
    console.log(`[cleanupDeletedPublishedFields] No soft-deleted draft fields found`);
    return;
  }
  
  console.log(`[cleanupDeletedPublishedFields] Found ${deletedDraftFields.length} soft-deleted draft fields`);
  
  // Hard delete both published and draft versions
  for (const deletedField of deletedDraftFields) {
    try {
      // Check if published version exists
      const publishedField = await getFieldById(deletedField.id, true);
      
      if (publishedField) {
        // Hard delete the published version (CASCADE will delete values)
        console.log(`[cleanupDeletedPublishedFields] Hard deleting published field ${deletedField.id}`);
        await hardDeleteField(deletedField.id, true);
      }
      
      // Also hard delete the draft version (CASCADE will delete values)
      console.log(`[cleanupDeletedPublishedFields] Hard deleting draft field ${deletedField.id}`);
      await hardDeleteField(deletedField.id, false);
    } catch (error) {
      // Log but don't fail the entire publish operation
      console.error(`Failed to cleanup field ${deletedField.id}:`, error);
    }
  }
}

/**
 * Clean up a soft-deleted collection and all its related data
 * Hard deletes both draft and published versions of the collection
 * CASCADE constraints will automatically delete all related fields, items, and values
 */
async function cleanupDeletedCollection(collectionId: string): Promise<void> {
  console.log(`[cleanupDeletedCollection] Starting cleanup for collection ${collectionId}`);
  
  try {
    // Check if published version exists
    const publishedCollection = await getCollectionById(collectionId, true);
    
    if (publishedCollection) {
      // Hard delete the published version (CASCADE will delete all related data)
      console.log(`[cleanupDeletedCollection] Hard deleting published collection ${collectionId}`);
      await hardDeleteCollection(collectionId, true);
    }
    
    // Hard delete the draft version (CASCADE will delete all related data)
    console.log(`[cleanupDeletedCollection] Hard deleting draft collection ${collectionId}`);
    await hardDeleteCollection(collectionId, false);
    
    console.log(`[cleanupDeletedCollection] Successfully cleaned up collection ${collectionId}`);
  } catch (error) {
    console.error(`[cleanupDeletedCollection] Failed to cleanup collection ${collectionId}:`, error);
    throw error;
  }
}

/**
 * Clean up all soft-deleted collections
 * Called during the main publish flow to ensure deleted collections are permanently removed
 */
export async function cleanupDeletedCollections(): Promise<void> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase not configured');
  }
  
  console.log('[cleanupDeletedCollections] Finding soft-deleted collections...');
  
  // Find all soft-deleted draft collections
  const { data: deletedCollections, error } = await client
    .from('collections')
    .select('id')
    .eq('is_published', false)
    .not('deleted_at', 'is', null);
  
  if (error) {
    console.error('[cleanupDeletedCollections] Error fetching deleted collections:', error);
    throw new Error(`Failed to fetch deleted collections: ${error.message}`);
  }
  
  if (!deletedCollections || deletedCollections.length === 0) {
    console.log('[cleanupDeletedCollections] No deleted collections found');
    return;
  }
  
  console.log(`[cleanupDeletedCollections] Found ${deletedCollections.length} deleted collection(s) to clean up`);
  
  // Clean up each deleted collection
  for (const collection of deletedCollections) {
    try {
      await cleanupDeletedCollection(collection.id);
    } catch (error) {
      console.error(`[cleanupDeletedCollections] Failed to cleanup collection ${collection.id}:`, error);
      // Continue with other collections even if one fails
    }
  }
  
  console.log(`[cleanupDeletedCollections] Cleanup complete for ${deletedCollections.length} collection(s)`);
}

/**
 * Get count of items needing publishing for a collection
 * Useful for UI indicators
 */
export async function getPublishableCount(collectionId: string): Promise<number> {
  const unpublishedItemIds = await getUnpublishedItemIds(collectionId);
  return unpublishedItemIds.length;
}

/**
 * Get counts of items needing publishing for multiple collections
 * 
 * @param collectionIds - Array of collection UUIDs
 * @returns Map of collection ID to unpublished item count
 */
export async function getPublishableCounts(
  collectionIds: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  
  for (const collectionId of collectionIds) {
    try {
      counts[collectionId] = await getPublishableCount(collectionId);
    } catch (error) {
      console.error(`Error getting publishable count for ${collectionId}:`, error);
      counts[collectionId] = 0;
    }
  }
  
  return counts;
}

/**
 * Check if a collection needs publishing
 * A collection needs publishing if:
 * - Published version doesn't exist, OR
 * - Collection metadata differs, OR
 * - Any fields differ, OR
 * - Any items need publishing
 */
export async function needsPublishing(collectionId: string): Promise<boolean> {
  // Check if published version exists
  const published = await getCollectionById(collectionId, true);
  if (!published) {
    return true;
  }
  
  // Check if collection metadata differs
  const draft = await getCollectionById(collectionId, false);
  if (!draft) {
    return false; // No draft, nothing to publish
  }
  
  const collectionChanged = 
    draft.name !== published.name ||
    JSON.stringify(draft.sorting) !== JSON.stringify(published.sorting) ||
    draft.order !== published.order;
  
  if (collectionChanged) {
    return true;
  }
  
  // Check if any fields need publishing
  const draftFields = await getFieldsByCollectionId(collectionId, false);
  const publishedFields = await getFieldsByCollectionId(collectionId, true);
  
  if (draftFields.length !== publishedFields.length) {
    return true;
  }
  
  // Check if any items need publishing
  const unpublishedCount = await getPublishableCount(collectionId);
  if (unpublishedCount > 0) {
    return true;
  }
  
  return false;
}

