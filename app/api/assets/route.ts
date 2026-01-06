import { NextRequest, NextResponse } from 'next/server';
import { getAllAssets } from '@/lib/repositories/assetRepository';
import { uploadFile } from '@/lib/file-upload';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/assets
 *
 * Get all assets (optionally filtered by folder)
 * Query params:
 * - folderId: string | 'null' - Filter by folder ID (use 'null' for root folder)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderIdParam = searchParams.get('folderId');

    let folderId: string | null | undefined = undefined;
    if (folderIdParam !== null) {
      folderId = folderIdParam === 'null' ? null : folderIdParam;
    }

    const assets = await getAllAssets(folderId);

    return noCache({
      data: assets,
    });
  } catch (error) {
    console.error('Failed to fetch assets:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch assets' },
      500
    );
  }
}

/**
 * POST /api/assets
 *
 * Upload a new asset
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const source = formData.get('source') as string | null;

    if (!file) {
      return noCache(
        { error: 'No file provided' },
        400
      );
    }

    if (!source) {
      return noCache(
        { error: 'Source is required' },
        400
      );
    }

    // Upload file to Supabase Storage and create asset record
    // This automatically extracts dimensions for images
    const asset = await uploadFile(file, source);

    if (!asset) {
      return noCache(
        { error: 'Failed to upload asset' },
        500
      );
    }

    return noCache({
      data: asset,
    });
  } catch (error) {
    console.error('Failed to upload asset:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to upload asset' },
      500
    );
  }
}
