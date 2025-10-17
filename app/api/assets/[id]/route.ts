import { NextRequest, NextResponse } from 'next/server';
import { deleteAsset } from '@/lib/repositories/assetRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * DELETE /api/assets/[id]
 * 
 * Delete an asset
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteAsset(id);

    return noCache({
      success: true,
      message: 'Asset deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete asset:', error);
    
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to delete asset' },
      500
    );
  }
}

