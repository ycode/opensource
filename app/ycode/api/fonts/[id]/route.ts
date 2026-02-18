import { NextRequest } from 'next/server';
import { noCache } from '@/lib/api-response';
import { getFontById, updateFont, deleteFont } from '@/lib/repositories/fontRepository';

/**
 * GET /ycode/api/fonts/[id]
 * Get a single font by ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const font = await getFontById(id);

    if (!font) {
      return noCache({ error: 'Font not found' }, 404);
    }

    return noCache({ data: font });
  } catch (error) {
    console.error('Failed to fetch font:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch font' },
      500
    );
  }
}

/**
 * PUT /ycode/api/fonts/[id]
 * Update a font
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const font = await updateFont(id, {
      name: body.name,
      family: body.family,
      variants: body.variants,
      weights: body.weights,
      category: body.category,
    });

    return noCache({ data: font });
  } catch (error) {
    console.error('Failed to update font:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to update font' },
      500
    );
  }
}

/**
 * DELETE /ycode/api/fonts/[id]
 * Soft-delete a font
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteFont(id);
    return noCache({ data: null });
  } catch (error) {
    console.error('Failed to delete font:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to delete font' },
      500
    );
  }
}
