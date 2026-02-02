import { NextRequest } from 'next/server';
import { duplicateItem } from '@/lib/repositories/collectionItemRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /ycode/api/collections/[id]/items/[item_id]/duplicate
 *
 * Duplicate a collection item with its draft values
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; item_id: string }> }
) {
  try {
    const { item_id } = await params;
    const itemId = item_id;

    const newItem = await duplicateItem(itemId);

    return noCache(
      { data: newItem },
      201
    );
  } catch (error) {
    console.error('[POST /ycode/api/collections/[id]/items/[item_id]/duplicate] Error:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to duplicate item' },
      500
    );
  }
}
