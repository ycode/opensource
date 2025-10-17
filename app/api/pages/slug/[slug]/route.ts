import { NextRequest, NextResponse } from 'next/server';
import { getPageBySlug } from '@/lib/repositories/pageRepository';
import { getPublishedVersion } from '@/lib/repositories/pageVersionRepository';

/**
 * GET /api/pages/slug/[slug]
 * 
 * Get a page by slug
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const page = await getPageBySlug(slug);

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: page,
    });
  } catch (error) {
    console.error('Failed to fetch page:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch page' },
      { status: 500 }
    );
  }
}

