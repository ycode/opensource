import { NextRequest, NextResponse } from 'next/server';
import { publishCollectionWithItems } from '@/lib/services/collectionPublishingService';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/collections/[id]/publish
 * Publish a single collection with optional item selection
 * 
 * Body: {
 *   itemIds?: string[]; // Optional: specific items to publish
 * }
 * 
 * Response: {
 *   data: {
 *     success: boolean;
 *     published: {
 *       collection: boolean;
 *       fieldsCount: number;
 *       itemsCount: number;
 *       valuesCount: number;
 *     };
 *     errors?: string[];
 *   }
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collectionId = id;
    
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { itemIds } = body;
    
    // Validate itemIds if provided
    if (itemIds !== undefined && !Array.isArray(itemIds)) {
      return noCache({ error: 'itemIds must be an array' }, 400);
    }
    
    // Publish the collection
    const result = await publishCollectionWithItems({
      collectionId,
      itemIds,
    });
    
    // Return appropriate status based on result
    if (result.success) {
      return noCache({ data: result });
    } else {
      return noCache(
        { 
          error: result.errors?.[0] || 'Failed to publish collection',
          details: result 
        },
        500
      );
    }
  } catch (error) {
    console.error('Error in publish endpoint:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to publish collection' },
      500
    );
  }
}

