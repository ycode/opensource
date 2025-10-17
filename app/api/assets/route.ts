import { NextRequest, NextResponse } from 'next/server';
import { getAllAssets, createAsset, uploadFile } from '@/lib/repositories/assetRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/assets
 * 
 * Get all assets
 */
export async function GET() {
  try {
    const assets = await getAllAssets();

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

    if (!file) {
      return noCache(
        { error: 'No file provided' },
        400
      );
    }

    // Upload file to Supabase Storage
    const { path, url } = await uploadFile(file);

    // Create asset record in database
    const asset = await createAsset({
      filename: file.name,
      storage_path: path,
      public_url: url,
      file_size: file.size,
      mime_type: file.type,
      // TODO: Extract width/height for images
    });

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

