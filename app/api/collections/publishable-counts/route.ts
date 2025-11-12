import { NextRequest, NextResponse } from 'next/server';
import { getPublishableCountsByCollection } from '@/lib/repositories/collectionItemRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/collections/publishable-counts
 * Get counts of items with "Ready for Publish" status for all collections
 */
export async function GET(request: NextRequest) {
  try {
    const counts = await getPublishableCountsByCollection();
    
    return noCache({ data: counts });
  } catch (error) {
    console.error('Error fetching publishable counts:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch publishable counts' },
      500
    );
  }
}



