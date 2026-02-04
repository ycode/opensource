import { NextRequest, NextResponse } from 'next/server';
import { getTopItemsWithValuesPerCollection } from '@/lib/repositories/collectionItemRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /ycode/api/collections/items/batch
 * Get top N items with values for multiple collections in 2 optimized queries
 * Body: { collectionIds: string[], limit?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collectionIds, limit = 10 } = body;

    if (!collectionIds || !Array.isArray(collectionIds)) {
      return noCache({ error: 'collectionIds must be an array' }, 400);
    }

    if (collectionIds.length === 0) {
      return noCache({ data: {} });
    }

    // Always get draft items in the builder
    const result = await getTopItemsWithValuesPerCollection(collectionIds, false, limit);

    return noCache({ data: result });
  } catch (error) {
    console.error('Error fetching batch items:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch batch items' },
      500
    );
  }
}
