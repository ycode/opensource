import { NextRequest } from 'next/server';
import { getUnpublishedPagesCount } from '@/lib/repositories/pageRepository';
import { getTotalPublishableItemsCount } from '@/lib/repositories/collectionItemRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /ycode/api/publish-count
 * Get total count of all items needing publishing (pages + collection items).
 * Uses optimized single-query counting for both.
 */
export async function GET(request: NextRequest) {
  try {
    const [pagesCount, itemsCount] = await Promise.all([
      getUnpublishedPagesCount(),
      getTotalPublishableItemsCount(),
    ]);

    return noCache({
      data: { count: pagesCount + itemsCount },
    });
  } catch (error) {
    console.error('Error fetching publish count:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch publish count' },
      500
    );
  }
}
