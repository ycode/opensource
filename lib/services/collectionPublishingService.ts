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
import { getCollectionById, hardDeleteCollection } from '../repositories/collectionRepository';
import { getFieldsByCollectionId } from '../repositories/collectionFieldRepository';
import { getItemsByCollectionId, getItemById } from '../repositories/collectionItemRepository';
import { getValuesByItemId } from '../repositories/collectionItemValueRepository';

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
 * Creates or updates the published version using direct upsert
 */
async function publishCollectionMetadata(collectionId: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Get the draft version
  const draft = await getCollectionById(collectionId, false);
  if (!draft) {
    throw new Error('Draft collection not found');
  }

  // Upsert published version (composite key handles insert/update automatically)
  const { error } = await client
    .from('collections')
    .upsert({
      id: draft.id,
      name: draft.name,
      sorting: draft.sorting,
      order: draft.order,
      is_published: true,
      created_at: draft.created_at,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id,is_published', // Composite primary key
    });

  if (error) {
    throw new Error(`Failed to publish collection: ${error.message}`);
  }

  console.log(`[publishCollectionMetadata] Collection ${collectionId} published`);
}

/**
 * Publish all fields for a collection
 * Fields are always published completely (non-selective)
 * Uses batch upsert for efficiency
 *
 * @returns Number of fields published
 */
async function publishAllFields(collectionId: string): Promise<number> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Get all draft fields
  const draftFields = await getFieldsByCollectionId(collectionId, false);
  console.log(`[publishAllFields] Found ${draftFields.length} draft fields`);

  if (draftFields.length === 0) {
    return 0;
  }

  // Prepare fields for upsert (publish all at once)
  const now = new Date().toISOString();
  const fieldsToUpsert = draftFields.map(field => ({
    id: field.id,
    name: field.name,
    type: field.type,
    default: field.default,
    fillable: field.fillable,
    built_in: field.built_in,
    order: field.order,
    collection_id: field.collection_id,
    reference_collection_id: field.reference_collection_id,
    hidden: field.hidden,
    data: field.data,
    is_published: true,
    created_at: field.created_at,
    updated_at: now,
  }));

  // Batch upsert all fields
  console.log(`[publishAllFields] Upserting ${fieldsToUpsert.length} fields...`);
  const { error } = await client
    .from('collection_fields')
    .upsert(fieldsToUpsert, {
      onConflict: 'id,is_published', // Composite primary key
    });

  if (error) {
    throw new Error(`Failed to publish fields: ${error.message}`);
  }

  console.log(`[publishAllFields] Successfully published ${draftFields.length} fields`);
  return draftFields.length;
}

/**
 * Publish selected items and their values
 * Uses batch upsert for efficiency
 *
 * @param collectionId - Collection UUID
 * @param itemIds - Optional array of item IDs to publish. If omitted, publishes all items that need publishing
 * @returns Counts of published items and values
 */
async function publishSelectedItems(
  collectionId: string,
  itemIds?: string[]
): Promise<{ itemsCount: number; valuesCount: number }> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

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

  if (itemsToPublish.length === 0) {
    return { itemsCount: 0, valuesCount: 0 };
  }

  // Fetch all draft items to publish
  const draftItemsData = await Promise.all(
    itemsToPublish.map(itemId => getItemById(itemId, false))
  );

  const draftItems = draftItemsData.filter((item): item is NonNullable<typeof item> => item !== null);

  if (draftItems.length === 0) {
    return { itemsCount: 0, valuesCount: 0 };
  }

  // Prepare items for batch upsert
  const now = new Date().toISOString();
  const itemsToUpsert = draftItems.map(item => ({
    id: item.id,
    collection_id: item.collection_id,
    manual_order: item.manual_order,
    is_published: true,
    created_at: item.created_at,
    updated_at: now,
  }));

  // Batch upsert all items
  console.log(`[publishSelectedItems] Upserting ${itemsToUpsert.length} items...`);
  const { error: itemsError } = await client
    .from('collection_items')
    .upsert(itemsToUpsert, {
      onConflict: 'id,is_published', // Composite primary key
    });

  if (itemsError) {
    throw new Error(`Failed to publish items: ${itemsError.message}`);
  }

  console.log(`[publishSelectedItems] Successfully published ${draftItems.length} items`);

  // Now publish all values for these items (batch)
  console.log(`[publishSelectedItems] Publishing values for ${draftItems.length} items...`);
  const valuesCount = await publishItemValuesBatch(itemsToPublish);
  console.log(`[publishSelectedItems] Published ${valuesCount} values`);

  return { itemsCount: draftItems.length, valuesCount };
}

/**
 * Publish values for multiple items in batch
 * Uses batch upsert for efficiency
 *
 * @param itemIds - Array of item UUIDs
 * @returns Total number of values published
 */
async function publishItemValuesBatch(itemIds: string[]): Promise<number> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  if (itemIds.length === 0) {
    return 0;
  }

  // Fetch all draft values for all items in parallel
  const allDraftValues = await Promise.all(
    itemIds.map(itemId => getValuesByItemId(itemId, false))
  );

  // Flatten the array
  const draftValues = allDraftValues.flat();

  if (draftValues.length === 0) {
    console.log(`[publishItemValuesBatch] No values to publish`);
    return 0;
  }

  console.log(`[publishItemValuesBatch] Found ${draftValues.length} draft values across ${itemIds.length} items`);

  // Prepare values for batch upsert
  const now = new Date().toISOString();
  const valuesToUpsert = draftValues.map(value => ({
    id: value.id,
    item_id: value.item_id,
    field_id: value.field_id,
    value: value.value,
    is_published: true,
    created_at: value.created_at,
    updated_at: now,
  }));

  // Batch upsert all values
  console.log(`[publishItemValuesBatch] Upserting ${valuesToUpsert.length} values...`);
  const { error } = await client
    .from('collection_item_values')
    .upsert(valuesToUpsert, {
      onConflict: 'id,is_published', // Composite primary key
    });

  if (error) {
    throw new Error(`Failed to publish item values: ${error.message}`);
  }

  console.log(`[publishItemValuesBatch] Successfully published ${draftValues.length} values`);
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
  const draftValues = await getValuesByItemId(itemId, false);
  const publishedValues = await getValuesByItemId(itemId, true);

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
 * Uses batch DELETE for efficiency
 * If a draft item is soft-deleted, permanently remove both draft and published versions
 */
async function cleanupDeletedPublishedItems(collectionId: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Get all items (including soft-deleted) from draft
  const { items: draftItems } = await getItemsByCollectionId(
    collectionId,
    false,
    { deleted: true } // Include deleted items
  );

  // Find soft-deleted items
  const deletedDraftItems = draftItems.filter(item => item.deleted_at !== null);

  if (deletedDraftItems.length === 0) {
    console.log(`[cleanupDeletedPublishedItems] No soft-deleted draft items found`);
    return;
  }

  console.log(`[cleanupDeletedPublishedItems] Found ${deletedDraftItems.length} soft-deleted draft items`);

  // Extract item IDs
  const deletedItemIds = deletedDraftItems.map(item => item.id);

  // Batch hard delete published versions (CASCADE will delete values)
  console.log(`[cleanupDeletedPublishedItems] Batch deleting published items...`);
  const { error: publishedError } = await client
    .from('collection_items')
    .delete()
    .in('id', deletedItemIds)
    .eq('is_published', true);

  if (publishedError) {
    console.error(`[cleanupDeletedPublishedItems] Error deleting published items:`, publishedError);
  } else {
    console.log(`[cleanupDeletedPublishedItems] Deleted published items`);
  }

  // Batch hard delete draft versions (CASCADE will delete values)
  console.log(`[cleanupDeletedPublishedItems] Batch deleting draft items...`);
  const { error: draftError } = await client
    .from('collection_items')
    .delete()
    .in('id', deletedItemIds)
    .eq('is_published', false);

  if (draftError) {
    console.error(`[cleanupDeletedPublishedItems] Error deleting draft items:`, draftError);
  } else {
    console.log(`[cleanupDeletedPublishedItems] Deleted draft items`);
  }

  console.log(`[cleanupDeletedPublishedItems] Successfully cleaned up ${deletedDraftItems.length} items`);
}

/**
 * Clean up soft-deleted fields in both draft and published versions
 * Uses batch DELETE for efficiency
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
    .eq('is_published', false)
    .not('deleted_at', 'is', null); // Only get deleted fields

  if (error) {
    console.error(`[cleanupDeletedPublishedFields] Error fetching deleted fields:`, error);
    return;
  }

  if (!deletedDraftFields || deletedDraftFields.length === 0) {
    console.log(`[cleanupDeletedPublishedFields] No soft-deleted draft fields found`);
    return;
  }

  console.log(`[cleanupDeletedPublishedFields] Found ${deletedDraftFields.length} soft-deleted draft fields`);

  // Extract field IDs
  const deletedFieldIds = deletedDraftFields.map(field => field.id);

  // Batch hard delete published versions (CASCADE will delete values)
  console.log(`[cleanupDeletedPublishedFields] Batch deleting published fields...`);
  const { error: publishedError } = await client
    .from('collection_fields')
    .delete()
    .in('id', deletedFieldIds)
    .eq('is_published', true);

  if (publishedError) {
    console.error(`[cleanupDeletedPublishedFields] Error deleting published fields:`, publishedError);
  } else {
    console.log(`[cleanupDeletedPublishedFields] Deleted published fields`);
  }

  // Batch hard delete draft versions (CASCADE will delete values)
  console.log(`[cleanupDeletedPublishedFields] Batch deleting draft fields...`);
  const { error: draftError } = await client
    .from('collection_fields')
    .delete()
    .in('id', deletedFieldIds)
    .eq('is_published', false);

  if (draftError) {
    console.error(`[cleanupDeletedPublishedFields] Error deleting draft fields:`, draftError);
  } else {
    console.log(`[cleanupDeletedPublishedFields] Deleted draft fields`);
  }

  console.log(`[cleanupDeletedPublishedFields] Successfully cleaned up ${deletedDraftFields.length} fields`);
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
 * Uses batch DELETE operations for efficiency
 * Called during publish operations to ensure deleted collections are permanently removed
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

  // Extract collection IDs
  const collectionIds = deletedCollections.map(c => c.id);

  // Batch delete published versions (CASCADE deletes all related data: fields, items, values)
  console.log('[cleanupDeletedCollections] Batch deleting published collections...');
  const { error: publishedError } = await client
    .from('collections')
    .delete()
    .in('id', collectionIds)
    .eq('is_published', true);

  if (publishedError) {
    console.error('[cleanupDeletedCollections] Error deleting published collections:', publishedError);
  } else {
    console.log('[cleanupDeletedCollections] Deleted published collections');
  }

  // Batch delete draft versions (CASCADE deletes all related data: fields, items, values)
  console.log('[cleanupDeletedCollections] Batch deleting draft collections...');
  const { error: draftError } = await client
    .from('collections')
    .delete()
    .in('id', collectionIds)
    .eq('is_published', false);

  if (draftError) {
    console.error('[cleanupDeletedCollections] Error deleting draft collections:', draftError);
  } else {
    console.log('[cleanupDeletedCollections] Deleted draft collections');
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
