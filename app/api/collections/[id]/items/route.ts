import { NextRequest, NextResponse } from 'next/server';
import { getItemsWithValues, createItem, getItemWithValues } from '@/lib/repositories/collectionItemRepository';
import { setValuesByFieldName } from '@/lib/repositories/collectionItemValueRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/collections/[id]/items
 * Get all items with values for a collection (draft version)
 * Query params:
 *  - search: string (optional) - Filter items by searching across all field values
 *  - page: number (optional, default: 1) - Page number
 *  - limit: number (optional, default: 25) - Items per page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Build filters object
    const filters = {
      ...(search ? { search } : {}),
      limit,
      offset,
    };
    
    // Always get draft items in the builder
    const { items, total } = await getItemsWithValues(id, false, filters);
    
    return noCache({ 
      data: {
        items,
        total,
        page,
        limit,
      }
    });
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
 * Create a new item with field values (draft)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const body = await request.json();
    
    // Extract item data and values
    const { values, ...itemData } = body;
    
    // Create the item (draft)
    const item = await createItem({
      collection_id: id,
      manual_order: itemData.manual_order ?? 0,
      is_published: false, // Always create as draft
    });
    
    // Calculate auto-incrementing ID based on item count
    const { total } = await getItemsWithValues(id, false);
    const autoIncrementId = total;
    
    // Get current timestamp for created_at and updated_at
    const now = new Date().toISOString();
    
    // Set field values if provided, and add auto-generated fields
    const valuesWithAutoFields = {
      ...values,
      id: autoIncrementId.toString(), // Auto-incrementing ID
      created_at: now,
      updated_at: now,
    };
    
    if (valuesWithAutoFields && typeof valuesWithAutoFields === 'object') {
      await setValuesByFieldName(
        item.id,
        id,
        valuesWithAutoFields,
        {},
        false // Create draft values
      );
    }
    
    // Get item with values
    const itemWithValues = await getItemWithValues(item.id, false);
    
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
