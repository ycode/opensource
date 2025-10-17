import { NextRequest, NextResponse } from 'next/server';
import { getPublishedVersion } from '@/lib/repositories/pageVersionRepository';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/pages/[id]/published
 * 
 * Get published version of a page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const published = await getPublishedVersion(id);

    if (!published) {
      return NextResponse.json(
        { error: 'Published version not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: published,
    });
  } catch (error) {
    console.error('Failed to fetch published version:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch published version' },
      { status: 500 }
    );
  }
}

