import { NextRequest, NextResponse } from 'next/server';
import { publishComponents } from '@/lib/repositories/componentRepository';
import { cleanupDeletedCollections } from '@/lib/services/collectionPublishingService';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/components/publish
 * Publish specified components - uses batch upsert for efficiency
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { component_ids } = body;
    
    if (!Array.isArray(component_ids)) {
      return noCache({ error: 'component_ids must be an array' }, 400);
    }
    
    // Use batch publish function
    const result = await publishComponents(component_ids);
    
    // Clean up any soft-deleted collections
    await cleanupDeletedCollections();
    
    return noCache({ 
      data: { count: result.count } 
    });
  } catch (error) {
    console.error('Error publishing components:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to publish components' },
      500
    );
  }
}

