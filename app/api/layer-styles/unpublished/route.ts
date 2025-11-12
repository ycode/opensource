import { NextRequest, NextResponse } from 'next/server';
import { getUnpublishedLayerStyles } from '@/lib/repositories/layerStyleRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/layer-styles/unpublished
 * Get all unpublished layer styles (never published or changed since last publish)
 */
export async function GET(request: NextRequest) {
  try {
    const styles = await getUnpublishedLayerStyles();
    
    return noCache({ data: styles });
  } catch (error) {
    console.error('Error fetching unpublished layer styles:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch unpublished layer styles' },
      500
    );
  }
}

