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
    console.log('[GET /api/pages] Starting request');
    console.log('[GET /api/pages] Vercel env:', process.env.VERCEL);
    console.log('[GET /api/pages] Supabase URL set:', !!process.env.SUPABASE_URL);
    console.log('[GET /api/pages] Supabase Anon Key set:', !!process.env.SUPABASE_ANON_KEY);
    console.log('[GET /api/pages] Supabase Service Role Key set:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const pages = await getAllPages();
    
            console.log('[GET /api/pages] Found pages:', pages.length);

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
    console.log('[POST /api/pages] Starting request');
    const body = await request.json();
    console.log('[POST /api/pages] Request body:', body);
    
    const { title, slug, status = 'draft', published_version_id = null } = body;

    // Validate required fields
    if (!title || !slug) {
      console.error('[POST /api/pages] Validation failed: missing title or slug');
      return noCache(
        { error: 'Title and slug are required' },
        400
      );
    }

    console.log('[POST /api/pages] Creating page:', { title, slug, status });
    
    // Create page
    const page = await createPage({
      title,
      slug,
      status,
      published_version_id,
    });

    console.log('[POST /api/pages] Page created:', page.id);

    // Create initial draft with Body container
    const bodyLayer = {
      id: 'body',
      type: 'container' as const,
      classes: '',
      children: [],
      locked: true,
    };

    console.log('[POST /api/pages] Creating initial draft with Body layer...');
    await upsertDraft(page.id, [bodyLayer]);
    console.log('[POST /api/pages] Draft created successfully');

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

