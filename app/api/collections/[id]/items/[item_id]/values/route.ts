import { NextRequest, NextResponse } from 'next/server';
import { getValuesByItemId } from '@/lib/repositories/collectionItemValueRepository';
import { setValuesByFieldName } from '@/lib/repositories/collectionItemValueRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/collections/[id]/items/[item_id]/values
 * Get all values for an item
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; item_id: string }> }
) {
  try {
    const { item_id } = await params;
    const itemId = parseInt(item_id, 10);
    
    if (isNaN(itemId)) {
      return noCache({ error: 'Invalid item ID' }, 400);
    }
    
    const values = await getValuesByItemId(itemId);
    
    return noCache({ data: values });
  } catch (error) {
    console.error('Error fetching item values:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch values' },
      500
    );
  }
}

/**
 * PUT /api/collections/[id]/items/[item_id]/values
 * Batch update values for an item
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; item_id: string }> }
) {
  try {
    const { id, item_id } = await params;
    const collectionId = id; // UUID string
    const itemId = parseInt(item_id, 10);
    
    if (isNaN(itemId)) {
      return noCache({ error: 'Invalid item ID' }, 400);
    }
    
    const body = await request.json();
    
    if (!body || typeof body !== 'object') {
      return noCache({ error: 'Request body must be an object' }, 400);
    }
    
    // Set values by field name
    await setValuesByFieldName(itemId, collectionId, body, {});
    
    // Get updated values
    const values = await getValuesByItemId(itemId);
    
    return noCache({ data: values });
  } catch (error) {
    console.error('Error updating item values:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to update values' },
      500
    );
  }
}







