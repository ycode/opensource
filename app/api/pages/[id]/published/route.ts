import { NextRequest, NextResponse } from 'next/server';
import { getPublishedLayers } from '@/lib/repositories/pageLayersRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/pages/[id]/published
 *
 * Get published version of a page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const published = await getPublishedLayers(id);

    if (!published) {
      return noCache(
        { error: 'Published layers not found' },
        404
      );
    }

    return noCache({
      data: published,
    });
  } catch (error) {
    console.error('Failed to fetch published layers:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch published layers' },
      500
    );
  }
}
