import { NextRequest, NextResponse } from 'next/server';
import { publishCollections, cleanupDeletedCollections } from '@/lib/services/collectionPublishingService';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/collections/publish
 * Batch publish multiple collections with optional item selection
 * 
 * Body: {
 *   publishes: Array<{
 *     collectionId: string;
 *     itemIds?: string[]; // Optional per collection
 *   }>;
 * }
 * 
 * OR (legacy format for backward compatibility):
 * Body: {
 *   collection_ids: string[];
 * }
 * 
 * Response: {
 *   data: {
 *     results: Array<{
 *       success: boolean;
 *       collectionId: string;
 *       published: {
 *         collection: boolean;
 *         fieldsCount: number;
 *         itemsCount: number;
 *         valuesCount: number;
 *       };
 *       errors?: string[];
 *     }>;
 *     summary: {
 *       total: number;
 *       succeeded: number;
 *       failed: number;
 *     };
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Support both new and legacy formats
    let publishes;
    
    if (body.publishes && Array.isArray(body.publishes)) {
      // New format: explicit publishes array
      publishes = body.publishes;
      
      // Validate structure
      for (const publish of publishes) {
        if (!publish.collectionId || typeof publish.collectionId !== 'string') {
          return noCache({ error: 'Each publish must have a collectionId' }, 400);
        }
        if (publish.itemIds !== undefined && !Array.isArray(publish.itemIds)) {
          return noCache({ error: 'itemIds must be an array if provided' }, 400);
        }
      }
    } else if (body.collection_ids && Array.isArray(body.collection_ids)) {
      // Legacy format: just collection IDs (publish all items)
      publishes = body.collection_ids.map((id: string) => ({
        collectionId: id,
      }));
    } else {
      return noCache({ 
        error: 'Request must include either "publishes" or "collection_ids" array' 
      }, 400);
    }
    
    // Execute batch publish
    const result = await publishCollections({ publishes });
    
    // Clean up any soft-deleted collections
    await cleanupDeletedCollections();
    
    // For legacy format, also include a "published" counts object
    const publishedCounts: Record<string, number> = {};
    for (const publishResult of result.results) {
      publishedCounts[publishResult.collectionId] = publishResult.published.itemsCount;
    }
    
    return noCache({ 
      data: {
        ...result,
        // Include legacy format for backward compatibility
        published: publishedCounts,
      }
    });
  } catch (error) {
    console.error('Error publishing collections:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to publish collections' },
      500
    );
  }
}
