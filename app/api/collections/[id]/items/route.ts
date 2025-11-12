import { NextRequest, NextResponse } from 'next/server';
import { getItemsWithValues, createItem } from '@/lib/repositories/collectionItemRepository';
import { setValuesByFieldName } from '@/lib/repositories/collectionItemValueRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/collections/[id]/items
 * Get all items with values for a collection
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
    
    const items = await getItemsWithValues(collectionId);
    
    return noCache({ data: items });
  } catch (error) {
    console.error('Error fetching collection items:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch items' },
      500
    );
  }
}

/**
 * POST /api/collections/[id]/items
 * Create a new item with field values
 */
export async function POST(
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
    
    // Extract item data and values
    const { values, ...itemData } = body;
    
    // Create the item
    const item = await createItem({
      collection_id: collectionId,
      r_id: itemData.r_id,
      manual_order: itemData.manual_order ?? 0,
    });
    
    // Calculate auto-incrementing ID based on item count
    const allItems = await getItemsWithValues(collectionId);
    const autoIncrementId = allItems.length;
    
    // Get current timestamp for created_at and updated_at
    const now = new Date().toISOString(); // Full timestamp format
    
    // Set field values if provided, and add auto-generated fields
    const valuesWithAutoFields = {
      ...values,
      id: autoIncrementId.toString(), // Auto-incrementing ID
      created_at: now, // Auto-generated created date
      updated_at: now, // Auto-generated updated date
    };
    
    if (valuesWithAutoFields && typeof valuesWithAutoFields === 'object') {
      await setValuesByFieldName(item.id, collectionId, valuesWithAutoFields, {});
    }
    
    // Get item with values
    const { getItemWithValues } = await import('@/lib/repositories/collectionItemRepository');
    const itemWithValues = await getItemWithValues(item.id);
    
    return noCache(
      { data: itemWithValues },
      201
    );
  } catch (error) {
    console.error('Error creating item:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to create item' },
      500
    );
  }
}

