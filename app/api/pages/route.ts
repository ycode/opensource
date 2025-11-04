import { NextRequest } from 'next/server';
import { getAllPages, createPage } from '@/lib/repositories/pageRepository';
import { upsertDraftLayers } from '@/lib/repositories/pageLayersRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/pages
 *
 * Get all pages with optional filters
 * Query params: is_published, is_locked, is_index, depth
 *
 * Examples:
 * - /api/pages - Get all draft pages (default)
 * - /api/pages?is_published=true - Get all published pages
 * - /api/pages?is_locked=true&is_index=true&depth=0 - Get homepage (draft)
 * - /api/pages?is_locked=true&is_index=true&depth=0&is_published=true - Get homepage (published)
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[GET /api/pages] Starting request');
    console.log('[GET /api/pages] Vercel env:', process.env.VERCEL);
    console.log('[GET /api/pages] Supabase URL set:', !!process.env.SUPABASE_URL);
    console.log('[GET /api/pages] Supabase Anon Key set:', !!process.env.SUPABASE_ANON_KEY);
    console.log('[GET /api/pages] Supabase Service Role Key set:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const filters: Record<string, any> = {};

    // Default to draft pages if no is_published filter specified
    const isPublished = searchParams.get('is_published');
    if (isPublished !== null) {
      filters.is_published = isPublished === 'true';
    } else {
      // Default: only return draft pages for the builder
      filters.is_published = false;
    }

    // Optional filters
    const isLocked = searchParams.get('is_locked');
    if (isLocked !== null) {
      filters.is_locked = isLocked === 'true';
    }

    const isIndex = searchParams.get('is_index');
    if (isIndex !== null) {
      filters.is_index = isIndex === 'true';
    }

    const depth = searchParams.get('depth');
    if (depth !== null) {
      filters.depth = parseInt(depth, 10);
    }

    console.log('[GET /api/pages] Filters:', filters);

    const pages = await getAllPages(filters);

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

    const { name, slug, is_published = false } = body;

    // Validate required fields
    if (!name || !slug) {
      console.error('[POST /api/pages] Validation failed: missing name or slug');
      return noCache(
        { error: 'Name and slug are required' },
        400
      );
    }

    console.log('[POST /api/pages] Creating page:', { name, slug, is_published });

    // Create page
    const page = await createPage({
      name,
      slug,
      is_published,
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
    await upsertDraftLayers(page.id, [bodyLayer]);
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

