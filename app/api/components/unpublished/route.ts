import { NextRequest, NextResponse } from 'next/server';
import { getUnpublishedComponents } from '@/lib/repositories/componentRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/components/unpublished
 * Get all unpublished components (never published or changed since last publish)
 */
export async function GET(request: NextRequest) {
  try {
    const components = await getUnpublishedComponents();
    
    return noCache({ data: components });
  } catch (error) {
    console.error('Error fetching unpublished components:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch unpublished components' },
      500
    );
  }
}

