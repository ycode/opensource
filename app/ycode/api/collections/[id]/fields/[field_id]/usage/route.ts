import { NextRequest } from 'next/server';
import { getCollectionFieldUsage } from '@/lib/collection-usage-utils';
import { noCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /ycode/api/collections/[id]/fields/[field_id]/usage
 * Get usage references for a collection field
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; field_id: string }> }
) {
  try {
    const { field_id } = await params;

    if (!field_id) {
      return noCache({ error: 'Field ID is required' }, 400);
    }

    const usage = await getCollectionFieldUsage(field_id);

    return noCache({ data: usage });
  } catch (error) {
    console.error('Error fetching field usage:', error);
    return noCache(
      { error: 'Failed to fetch field usage' },
      500
    );
  }
}
