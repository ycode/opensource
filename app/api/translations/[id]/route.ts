import { NextRequest, NextResponse } from 'next/server';
import { getTranslationById, updateTranslation, deleteTranslation } from '@/lib/repositories/translationRepository';

/**
 * GET /api/translations/[id]
 * Get a single translation by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const translation = await getTranslationById(id, false);

    if (!translation) {
      return NextResponse.json({ error: 'Translation not found' }, { status: 404 });
    }

    return NextResponse.json({ data: translation });
  } catch (error) {
    console.error('Error fetching translation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch translation' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/translations/[id]
 * Update a translation
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content_value, is_completed } = body;

    const updates: any = {};
    if (content_value !== undefined) updates.content_value = content_value;
    if (is_completed !== undefined) updates.is_completed = is_completed;

    const translation = await updateTranslation(id, updates);

    return NextResponse.json({ data: translation });
  } catch (error) {
    console.error('Error updating translation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update translation' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/translations/[id]
 * Delete a translation (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteTranslation(id);

    return NextResponse.json({ message: 'Translation deleted successfully' });
  } catch (error) {
    console.error('Error deleting translation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete translation' },
      { status: 500 }
    );
  }
}
