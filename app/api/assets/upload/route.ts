import { NextRequest, NextResponse } from 'next/server';
import { createAsset, uploadFile } from '@/lib/repositories/assetRepository';

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
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
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

    return NextResponse.json({
      data: asset,
    });
  } catch (error) {
    console.error('Failed to upload asset:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload asset' },
      { status: 500 }
    );
  }
}

