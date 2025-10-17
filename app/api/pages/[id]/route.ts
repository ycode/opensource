import { NextRequest, NextResponse } from 'next/server';
import { getPageById, updatePage, deletePage } from '@/lib/repositories/pageRepository';

/**
 * GET /api/pages/[id]
 * 
 * Get a specific page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const page = await getPageById(id);

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

/**
 * PUT /api/pages/[id]
 * 
 * Update a page
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, slug, status, published_version_id } = body;

    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title;
    if (slug !== undefined) updates.slug = slug;
    if (status !== undefined) updates.status = status;
    if (published_version_id !== undefined) updates.published_version_id = published_version_id;

    const page = await updatePage(id, updates);

    return NextResponse.json({
      data: page,
    });
  } catch (error) {
    console.error('Failed to update page:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update page' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/pages/[id]
 * 
 * Delete a page
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deletePage(id);

    return NextResponse.json({
      success: true,
      message: 'Page deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete page:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete page' },
      { status: 500 }
    );
  }
}

