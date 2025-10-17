import { NextRequest, NextResponse } from 'next/server';
import { createAsset, uploadFile } from '@/lib/repositories/assetRepository';
import { noCache } from '@/lib/api-response';

/**
 * POST /api/assets/upload
 * 
 * Upload a new asset file to Supabase Storage and create database record
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

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return noCache(
        { error: 'Only image files are allowed' },
        400
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return noCache(
        { error: 'File size must be less than 10MB' },
        400
      );
    }

    // Upload file to Supabase Storage
    const { path, url } = await uploadFile(file);

    // TODO: Extract image dimensions for images
    // This would require a library like 'sharp' or browser-based extraction

    // Create asset record in database
    const asset = await createAsset({
      filename: file.name,
      storage_path: path,
      public_url: url,
      file_size: file.size,
      mime_type: file.type,
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

