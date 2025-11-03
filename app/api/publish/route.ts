import { NextRequest, NextResponse } from 'next/server';
import { publishAllPages } from '@/lib/services/publishingService';
import { invalidatePage } from '@/lib/services/cacheInvalidationService';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/publish
 *
 * Publish all draft records (pages and their layers)
 * Optimized with batch queries
 * Draft records remain unchanged
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[Publish] Starting publish all pages...');

    // Publish all draft pages and their layers
    const result = await publishAllPages();

    console.log('[Publish] Published:', {
      total: result.published.length,
      created: result.created,
      updated: result.updated,
      unchanged: result.unchanged,
    });

    // Invalidate cache for all published pages
    const invalidations = result.published.map(({ page }) =>
      invalidatePage(page.slug)
    );
    await Promise.all(invalidations);

    return noCache({
      data: result,
      message: `Published ${result.published.length} page(s) successfully`,
    });
  } catch (error) {
    console.error('Failed to publish pages:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to publish pages' },
      500
    );
  }
}

