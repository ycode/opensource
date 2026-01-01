import { NextRequest, NextResponse } from 'next/server';
import { getAssetById } from '@/lib/repositories/assetRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/assets/[id]
 * 
 * Get a single asset by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const asset = await getAssetById(id);

    if (!asset) {
      return noCache(
        { error: 'Asset not found' },
        404
      );
    }

    return noCache({
      data: asset,
    });
  } catch (error) {
    console.error('Failed to fetch asset:', error);
    
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch asset' },
      500
    );
  }
}
