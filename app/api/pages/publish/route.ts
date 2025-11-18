import { NextRequest, NextResponse } from 'next/server';
import { publishPages } from '@/lib/services/pageService';
import { cleanupDeletedCollections } from '@/lib/services/collectionPublishingService';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/pages/publish
 * Publish specified pages - creates/updates separate published versions while keeping drafts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { page_ids } = body;
    
    if (!Array.isArray(page_ids)) {
      return noCache({ error: 'page_ids must be an array' }, 400);
    }
    
    // Use the proper publishing service that creates separate published records
    const result = await publishPages(page_ids);
    
    // Clean up any soft-deleted collections
    await cleanupDeletedCollections();
    
    return noCache({ 
      data: { count: result.count } 
    });
  } catch (error) {
    console.error('Error publishing pages:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to publish pages' },
      500
    );
  }
}


