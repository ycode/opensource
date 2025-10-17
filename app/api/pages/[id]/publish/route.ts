import { NextRequest, NextResponse } from 'next/server';
import { publishPageVersion } from '@/lib/repositories/pageVersionRepository';
import { getPageById } from '@/lib/repositories/pageRepository';
import { invalidatePage } from '@/lib/services/cacheInvalidationService';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/pages/[id]/publish
 * 
 * Publish a page (creates published version from draft and invalidates cache)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get page to find slug for cache invalidation
    const page = await getPageById(id);
    
    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    // Publish the page version
    const publishedVersion = await publishPageVersion(id);

    // Invalidate cache for this page
    await invalidatePage(page.slug);

    return NextResponse.json({
      data: publishedVersion,
      message: 'Page published successfully',
    });
  } catch (error) {
    console.error('Failed to publish page:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish page' },
      { status: 500 }
    );
  }
}

