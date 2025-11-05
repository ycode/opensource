import { NextRequest } from 'next/server';
import { deletePageFolder } from '@/lib/repositories/pageFolderRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * DELETE /api/folders/[id]
 *
 * Delete a folder (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await deletePageFolder(id);

    return noCache(
      { data: { success: true } },
      200
    );
  } catch (error) {
    console.error('[DELETE /api/folders/[id]] Error:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to delete folder' },
      500
    );
  }
}

