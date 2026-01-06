import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, updateAsset, deleteAsset } from '@/lib/repositories/assetRepository';
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

/**
 * PUT /api/assets/[id]
 *
 * Update an asset by ID
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if asset exists
    const asset = await getAssetById(id);
    if (!asset) {
      return noCache(
        { error: 'Asset not found' },
        404
      );
    }

    // Validate fields
    if (body.filename !== undefined && typeof body.filename !== 'string') {
      return noCache(
        { error: 'Invalid filename field' },
        400
      );
    }

    // Update the asset
    const updatedAsset = await updateAsset(id, body);

    return noCache(
      { data: updatedAsset },
      200
    );
  } catch (error) {
    console.error('[PUT /api/assets/[id]] Error:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to update asset' },
      500
    );
  }
}

/**
 * DELETE /api/assets/[id]
 *
 * Delete an asset by ID
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if asset exists
    const asset = await getAssetById(id);
    if (!asset) {
      return noCache(
        { error: 'Asset not found' },
        404
      );
    }

    // Delete the asset (removes from storage and database)
    await deleteAsset(id);

    return noCache(
      { data: { success: true } },
      200
    );
  } catch (error) {
    console.error('[DELETE /api/assets/[id]] Error:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to delete asset' },
      500
    );
  }
}
