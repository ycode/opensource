import { NextRequest } from 'next/server';
import { reorderCollections } from '@/lib/repositories/collectionRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PUT /ycode/api/collections/reorder
 * Reorder collections
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { collection_ids } = body;

    if (!Array.isArray(collection_ids)) {
      return noCache({ error: 'collection_ids must be an array' }, 400);
    }

    // Reorder draft collections (is_published = false)
    await reorderCollections(false, collection_ids);

    return noCache({ data: { success: true } });
  } catch (error) {
    console.error('Error reordering collections:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to reorder collections' },
      500
    );
  }
}
