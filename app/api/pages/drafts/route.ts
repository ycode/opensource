import { NextResponse } from 'next/server';
import { getAllDraftLayers } from '@/lib/repositories/pageLayersRepository';

/**
 * GET /api/pages/drafts
 * Get all draft (non-published) page layers in one query
 */
export async function GET() {
  try {
    const drafts = await getAllDraftLayers();

    return NextResponse.json({ data: drafts });
  } catch (error) {
    console.error('Error fetching drafts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500 }
    );
  }
}

