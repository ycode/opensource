import { NextRequest, NextResponse } from 'next/server';
import { getDraftVersion, upsertDraft } from '@/lib/repositories/pageVersionRepository';
import type { Layer } from '@/types';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
      return noCache(
        { error: 'Draft not found' },
        404
      );
    }

    return noCache({
      data: draft,
    });
  } catch (error) {
    console.error('Failed to fetch draft:', error);
    
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch draft' },
      500
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
    const { layers, generated_css } = body;

    if (!Array.isArray(layers)) {
      return noCache(
        { error: 'Invalid layers data' },
        400
      );
    }

    const draft = await upsertDraft(id, layers as Layer[], generated_css);

    return noCache({
      data: draft,
    });
  } catch (error) {
    console.error('Failed to update draft:', error);
    
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to update draft' },
      500
    );
  }
}

