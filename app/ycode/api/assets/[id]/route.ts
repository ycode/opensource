import { NextRequest, NextResponse } from 'next/server';
import { getAssetById, updateAsset, deleteAsset } from '@/lib/repositories/assetRepository';
import { noCache } from '@/lib/api-response';
import { cleanSvgContent, isValidSvg } from '@/lib/file-upload';
import { cleanupAssetReferences } from '@/lib/asset-usage-utils';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /ycode/api/assets/[id]
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
 * PUT /ycode/api/assets/[id]
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
    if (body.asset_folder_id !== undefined && body.asset_folder_id !== null && typeof body.asset_folder_id !== 'string') {
      return noCache({ error: 'Invalid asset_folder_id' }, 400);
    }
    if (body.content !== undefined && body.content !== null && typeof body.content !== 'string') {
      return noCache({ error: 'Invalid content field' }, 400);
    }

    // Validate and clean SVG content if provided
    const updateData: { filename?: string; asset_folder_id?: string | null; content?: string | null } = {};
    if (body.filename !== undefined) {
      updateData.filename = body.filename;
    }
    if (body.asset_folder_id !== undefined) {
      updateData.asset_folder_id = body.asset_folder_id;
    }
    if (body.content !== undefined) {
      // Validate SVG content before cleaning
      if (body.content !== null && !isValidSvg(body.content)) {
        return noCache(
          { error: 'Invalid SVG code. Please provide a valid SVG element.' },
          400
        );
      }

      // Clean SVG content if provided
      updateData.content = body.content ? cleanSvgContent(body.content) : body.content;

      // Validate cleaned SVG content
      if (updateData.content && !isValidSvg(updateData.content)) {
        return noCache(
          { error: 'SVG code is invalid after cleaning. Please check your SVG structure.' },
          400
        );
      }
    }

    if (Object.keys(updateData).length === 0) {
      return noCache({ error: 'No valid fields to update' }, 400);
    }

    // Update the asset
    const updatedAsset = await updateAsset(id, updateData);

    return noCache(
      { data: updatedAsset },
      200
    );
  } catch (error) {
    console.error('[PUT /ycode/api/assets/[id]] Error:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to update asset' },
      500
    );
  }
}

/**
 * DELETE /ycode/api/assets/[id]
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

    // Clean up all references to this asset in pages, components, and CMS items
    const cleanupResult = await cleanupAssetReferences(id);
    console.log(`[DELETE /ycode/api/assets/${id}] Cleaned up references:`, cleanupResult);

    // Delete the asset (removes from storage and database)
    await deleteAsset(id);

    return noCache(
      { data: { success: true, cleanup: cleanupResult } },
      200
    );
  } catch (error) {
    console.error('[DELETE /ycode/api/assets/[id]] Error:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to delete asset' },
      500
    );
  }
}
