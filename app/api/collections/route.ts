import { NextRequest, NextResponse } from 'next/server';
import { getAllCollections, createCollection } from '@/lib/repositories/collectionRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/collections
 * Get all collections
 */
export async function GET() {
  try {
    const collections = await getAllCollections({ deleted: false });
    
    return noCache({
      data: collections,
    });
  } catch (error) {
    console.error('Error fetching collections:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch collections' },
      500
    );
  }
}

/**
 * POST /api/collections
 * Create a new collection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.collection_name) {
      return noCache(
        { error: 'Missing required fields: name, collection_name' },
        400
      );
    }
    
    const collection = await createCollection({
      name: body.name,
      collection_name: body.collection_name,
      sorting: body.sorting || null,
      order: body.order || null,
      status: body.status || 'draft',
    });
    
    return noCache(
      { data: collection },
      201
    );
  } catch (error) {
    console.error('Error creating collection:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to create collection' },
      500
    );
  }
}


