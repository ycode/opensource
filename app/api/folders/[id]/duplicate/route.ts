import { NextRequest } from 'next/server';
import { duplicatePageFolder } from '@/lib/repositories/pageFolderRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/folders/[id]/duplicate
 *
 * Duplicate a folder
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const newFolder = await duplicatePageFolder(id);

    return noCache(
      { data: newFolder },
      201
    );
  } catch (error) {
    console.error('[POST /api/folders/[id]/duplicate] Error:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to duplicate folder' },
      500
    );
  }
}

