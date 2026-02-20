import { NextRequest, NextResponse } from 'next/server';
import { publishValues } from '@/lib/repositories/collectionItemValueRepository';
import { hardDeleteItem, getItemById } from '@/lib/repositories/collectionItemRepository';
import { getCollectionById } from '@/lib/repositories/collectionRepository';
import { cleanupDeletedCollections } from '@/lib/services/collectionService';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /ycode/api/collections/items/publish
 * Publish individual collection items by their IDs
 * - For normal items: Copies draft values to published values
 * - For deleted items (deleted_at set): Hard deletes the item and all values
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_ids } = body;
    
    if (!Array.isArray(item_ids)) {
      return noCache({ error: 'item_ids must be an array' }, 400);
    }
    
    let publishedCount = 0;
    
    // Publish each item
    for (const itemId of item_ids) {
      try {
        // Check if item is marked as deleted
        const item = await getItemById(itemId);
        
        if (!item) {
          continue; // Item doesn't exist
        }
        
        if (item.deleted_at) {
          // Hard delete the item and all its values (CASCADE)
          await hardDeleteItem(itemId);
          publishedCount++;
        } else {
          // Block publishing if the collection hasn't been published
          const publishedCollection = await getCollectionById(item.collection_id, true);
          if (!publishedCollection) {
            console.warn(`Skipping item ${itemId}: collection ${item.collection_id} is not published`);
            continue;
          }
          // Normal publish: copy draft values to published
          await publishValues(itemId);
          publishedCount++;
        }
      } catch (error) {
        console.error(`Error publishing item ${itemId}:`, error);
        // Continue with other items
      }
    }
    
    // Clean up any soft-deleted collections
    await cleanupDeletedCollections();
    
    return noCache({ 
      data: { count: publishedCount } 
    });
  } catch (error) {
    console.error('Error publishing collection items:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to publish items' },
      500
    );
  }
}
