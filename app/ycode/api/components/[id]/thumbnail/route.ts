import { NextRequest, NextResponse } from 'next/server';
import { uploadThumbnail, deleteThumbnail } from '@/lib/thumbnail-upload';
import { updateComponentThumbnail } from '@/lib/repositories/componentRepository';

/**
 * POST /ycode/api/components/[id]/thumbnail
 * Upload a component thumbnail image (converted to WebP server-side)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const formData = await request.formData();
    const file = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload as WebP to Supabase Storage
    const thumbnailUrl = await uploadThumbnail(id, buffer);

    // Update component record in database
    await updateComponentThumbnail(id, thumbnailUrl);

    return NextResponse.json({ data: { thumbnail_url: thumbnailUrl } });
  } catch (error) {
    console.error('Error uploading component thumbnail:', error);
    return NextResponse.json(
      { error: 'Failed to upload thumbnail' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /ycode/api/components/[id]/thumbnail
 * Remove a component thumbnail
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Remove from storage
    await deleteThumbnail(id);

    // Clear thumbnail URL in database
    await updateComponentThumbnail(id, null);

    return NextResponse.json({ data: { thumbnail_url: null } });
  } catch (error) {
    console.error('Error deleting component thumbnail:', error);
    return NextResponse.json(
      { error: 'Failed to delete thumbnail' },
      { status: 500 }
    );
  }
}
