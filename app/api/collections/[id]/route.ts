import { NextRequest, NextResponse } from 'next/server';
import { getCollectionById, updateCollection, deleteCollection } from '@/lib/repositories/collectionRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/collections/[id]
 * Get collection by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collectionId = parseInt(id, 10);
    
    if (isNaN(collectionId)) {
      return noCache({ error: 'Invalid collection ID' }, 400);
    }
    
    const collection = await getCollectionById(collectionId);
    
    if (!collection) {
      return noCache({ error: 'Collection not found' }, 404);
    }
    
    return noCache({ data: collection });
  } catch (error) {
    console.error('Error fetching collection:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch collection' },
      500
    );
  }
}

/**
 * PUT /api/collections/[id]
 * Update collection
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collectionId = parseInt(id, 10);
    
    if (isNaN(collectionId)) {
      return noCache({ error: 'Invalid collection ID' }, 400);
    }
    
    const body = await request.json();
    
    const collection = await updateCollection(collectionId, body);
    
    return noCache({ data: collection });
  } catch (error) {
    console.error('Error updating collection:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to update collection' },
      500
    );
  }
}

/**
 * DELETE /api/collections/[id]
 * Delete collection (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collectionId = parseInt(id, 10);
    
    if (isNaN(collectionId)) {
      return noCache({ error: 'Invalid collection ID' }, 400);
    }
    
    await deleteCollection(collectionId);
    
    return noCache({ data: null }, 204);
  } catch (error) {
    console.error('Error deleting collection:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to delete collection' },
      500
    );
  }
}







