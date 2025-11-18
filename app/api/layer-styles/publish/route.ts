import { NextRequest, NextResponse } from 'next/server';
import { publishLayerStyles } from '@/lib/repositories/layerStyleRepository';
import { cleanupDeletedCollections } from '@/lib/services/collectionPublishingService';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/layer-styles/publish
 * Publish specified layer styles - uses batch upsert for efficiency
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { style_ids } = body;

    if (!Array.isArray(style_ids)) {
      return noCache({ error: 'style_ids must be an array' }, 400);
    }

    // Use batch publish function
    const result = await publishLayerStyles(style_ids);

    // Clean up any soft-deleted collections
    await cleanupDeletedCollections();

    return noCache({
      data: { count: result.count }
    });
  } catch (error) {
    console.error('Error publishing layer styles:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to publish layer styles' },
      500
    );
  }
}

