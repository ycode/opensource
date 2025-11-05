import { NextRequest, NextResponse } from 'next/server';
import { getAllPages, createPage } from '@/lib/repositories/pageRepository';
import { upsertDraft } from '@/lib/repositories/pageVersionRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/pages
 * 
 * Get all pages
 */
export async function GET() {
  try {
    
    const pages = await getAllPages();
    

    return noCache({
      data: pages,
    });
  } catch (error) {
    console.error('[GET /api/pages] Error:', error);
    console.error('[GET /api/pages] Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('[GET /api/pages] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch pages' },
      500
    );
  }
}

/**
 * POST /api/pages
 * 
 * Create a new page
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { title, slug, status = 'draft', published_version_id = null } = body;

    // Validate required fields
    if (!title || !slug) {
      console.error('[POST /api/pages] Validation failed: missing title or slug');
      return noCache(
        { error: 'Title and slug are required' },
        400
      );
    }

    
    // Create page
    const page = await createPage({
      title,
      slug,
      status,
      published_version_id,
    });


    // Create initial draft with Body container
    const bodyLayer = {
      id: 'body',
      type: 'container' as const,
      classes: '',
      children: [],
      locked: true,
    };

    await upsertDraft(page.id, [bodyLayer]);

    return noCache({
      data: page,
    });
  } catch (error) {
    console.error('[POST /api/pages] Error:', error);
    console.error('[POST /api/pages] Error message:', error instanceof Error ? error.message : 'Unknown');
    console.error('[POST /api/pages] Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to create page' },
      500
    );
  }
}

