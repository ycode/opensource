import { NextRequest, NextResponse } from 'next/server';
import { getDraftVersion, upsertDraft } from '@/lib/repositories/pageVersionRepository';
import type { Layer } from '@/types';

/**
 * GET /api/pages/[id]/draft
 * 
 * Get draft version of a page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const draft = await getDraftVersion(id);

    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: draft,
    });
  } catch (error) {
    console.error('Failed to fetch draft:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch draft' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/pages/[id]/draft
 * 
 * Update draft version
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { layers } = body;

    if (!Array.isArray(layers)) {
      return NextResponse.json(
        { error: 'Invalid layers data' },
        { status: 400 }
      );
    }

    const draft = await upsertDraft(id, layers as Layer[]);

    return NextResponse.json({
      data: draft,
    });
  } catch (error) {
    console.error('Failed to update draft:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update draft' },
      { status: 500 }
    );
  }
}

