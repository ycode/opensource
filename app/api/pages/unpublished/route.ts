import { NextRequest, NextResponse } from 'next/server';
import { getUnpublishedPages } from '@/lib/repositories/pageRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/pages/unpublished
 * Get all unpublished pages
 */
export async function GET(request: NextRequest) {
  try {
    const pages = await getUnpublishedPages();
    
    return noCache({ data: pages });
  } catch (error) {
    console.error('Error fetching unpublished pages:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch unpublished pages' },
      500
    );
  }
}
