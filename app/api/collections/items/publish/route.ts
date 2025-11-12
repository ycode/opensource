import { NextRequest, NextResponse } from 'next/server';
import { publishValues } from '@/lib/repositories/collectionItemValueRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/collections/items/publish
 * Publish individual collection items by their IDs
 * Copies draft values to published values for each specified item
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
        // Copy draft values to published values
        await publishValues(itemId);
        publishedCount++;
      } catch (error) {
        console.error(`Error publishing item ${itemId}:`, error);
        // Continue with other items
      }
    }
    
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


