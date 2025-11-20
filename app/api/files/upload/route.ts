import { NextRequest, NextResponse } from 'next/server';
import { uploadFile } from '@/lib/file-upload';
import { isAssetOfType, ASSET_CATEGORIES } from '@/lib/asset-utils';

/**
 * POST /api/files/upload
 * Upload a file to Supabase Storage and create Asset record
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const customName = formData.get('name') as string | null;
    const source = formData.get('source') as string | null;
    const category = formData.get('category') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!source) {
      return NextResponse.json(
        { error: 'Source is required' },
        { status: 400 }
      );
    }

    if (category === ASSET_CATEGORIES.IMAGES && !isAssetOfType(file.type, ASSET_CATEGORIES.IMAGES)) {
      return NextResponse.json(
        { error: 'Only image files are allowed' },
        { status: 400 }
      );
    }

    if (category === ASSET_CATEGORIES.VIDEOS && !isAssetOfType(file.type, ASSET_CATEGORIES.VIDEOS)) {
      return NextResponse.json(
        { error: 'Only video files are allowed' },
        { status: 400 }
      );
    }

    if (category === ASSET_CATEGORIES.AUDIO && !isAssetOfType(file.type, ASSET_CATEGORIES.AUDIO)) {
      return NextResponse.json(
        { error: 'Only audio files are allowed' },
        { status: 400 }
      );
    }

    if (category === ASSET_CATEGORIES.DOCUMENTS && !isAssetOfType(file.type, ASSET_CATEGORIES.DOCUMENTS)) {
      return NextResponse.json(
        { error: 'Only document files are allowed (PDF, Word, Excel, PowerPoint, Text)' },
        { status: 400 }
      );
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size must be less than 50MB' },
        { status: 400 }
      );
    }

    const asset = await uploadFile(file, source, customName || undefined);

    if (!asset) {
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: asset }, { status: 200 });
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}
