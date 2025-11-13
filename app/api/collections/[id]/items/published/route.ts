import { NextRequest, NextResponse } from 'next/server';
import { getItemsWithValues } from '@/lib/repositories/collectionItemRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/collections/[id]/items/published
 * Get all published items with their published values for a collection
 * This endpoint is meant for public pages to fetch published content
 * An item is considered published if it has published values
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collectionId = parseInt(id, 10);
    
    if (isNaN(collectionId)) {
      return noCache({ error: 'Invalid collection ID' }, 400);
    }
    
    // Get items with published values
    // This automatically filters to only items that have published values
    const { items: publishedItems } = await getItemsWithValues(collectionId, undefined, true);
    
    // Filter out items with no values (edge case)
    const itemsWithValues = publishedItems.filter(item => 
      Object.keys(item.values).length > 0
    );
    
    return noCache({ data: itemsWithValues });
  } catch (error) {
    console.error('Error fetching published collection items:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch published items' },
      500
    );
  }
}

