import { NextRequest, NextResponse } from 'next/server';
import { getAllPages, createPage } from '@/lib/repositories/pageRepository';
import { upsertDraft } from '@/lib/repositories/pageVersionRepository';

/**
 * GET /api/pages
 * 
 * Get all pages
 */
export async function GET() {
  try {
    const pages = await getAllPages();

    return NextResponse.json({
      data: pages,
    });
  } catch (error) {
    console.error('Failed to fetch pages:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch pages' },
      { status: 500 }
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
      return NextResponse.json(
        { error: 'Title and slug are required' },
        { status: 400 }
      );
    }

    // Create page
    const page = await createPage({
      title,
      slug,
      status,
      published_version_id,
    });

    // Create initial empty draft
    await upsertDraft(page.id, []);

    return NextResponse.json({
      data: page,
    });
  } catch (error) {
    console.error('Failed to create page:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create page' },
      { status: 500 }
    );
  }
}

