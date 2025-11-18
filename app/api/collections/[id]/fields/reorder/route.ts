import { NextRequest, NextResponse } from 'next/server';
import { reorderFields } from '@/lib/repositories/collectionFieldRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * PUT /api/collections/[id]/fields/reorder
 * Reorder fields for a collection
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collectionId = id;

    const body = await request.json();
    const { field_ids } = body;

    if (!Array.isArray(field_ids)) {
      return noCache({ error: 'field_ids must be an array' }, 400);
    }

    // Reorder draft fields (is_published = false)
    await reorderFields(collectionId, false, field_ids);

    return noCache({ data: { success: true } });
  } catch (error) {
    console.error('Error reordering fields:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to reorder fields' },
      500
    );
  }
}







