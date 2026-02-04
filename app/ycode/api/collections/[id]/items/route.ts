import { NextRequest, NextResponse } from 'next/server';
import { getItemsWithValues, createItem, getItemWithValues, getMaxIdValue } from '@/lib/repositories/collectionItemRepository';
import { setValuesByFieldName } from '@/lib/repositories/collectionItemValueRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /ycode/api/collections/[id]/items
 * Get all items with values for a collection (draft version)
 * Query params:
 *  - search: string (optional) - Filter items by searching across all field values
 *  - page: number (optional, default: 1) - Page number
 *  - limit: number (optional, default: 25) - Items per page
 *  - sortBy: string (optional) - Field ID to sort by, or 'manual', 'random', 'none'
 *  - sortOrder: 'asc' | 'desc' (optional, default: 'asc') - Sort order
 *  - offset: number (optional) - Number of items to skip
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
    const sortBy = searchParams.get('sortBy') || undefined;
    const sortOrder = (searchParams.get('sortOrder') || 'asc') as 'asc' | 'desc';
    const offsetParam = searchParams.get('offset');

    // Calculate offset (use explicit offset if provided, otherwise calculate from page)
    const offset = offsetParam ? parseInt(offsetParam, 10) : (page - 1) * limit;

    // Build filters object
    const filters = {
      ...(search ? { search } : {}),
      limit,
      offset,
    };

    // Always get draft items in the builder
    const { items, total } = await getItemsWithValues(id, false, filters);

    // Apply sorting if specified (client-side for now since repository doesn't support it)
    let sortedItems = items;
    if (sortBy && sortBy !== 'none') {
      if (sortBy === 'manual') {
        // Sort by manual_order
        sortedItems = [...items].sort((a, b) => {
          return (a.manual_order || 0) - (b.manual_order || 0);
        });
      } else if (sortBy === 'random') {
        // Randomize order
        sortedItems = [...items].sort(() => Math.random() - 0.5);
      } else {
        // Sort by field value
        sortedItems = [...items].sort((a, b) => {
          const aValue = a.values[sortBy] || '';
          const bValue = b.values[sortBy] || '';
          
          // Try numeric comparison
          const aNum = parseFloat(String(aValue));
          const bNum = parseFloat(String(bValue));
          
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
          }
          
          // String comparison
          const comparison = String(aValue).localeCompare(String(bValue));
          return sortOrder === 'asc' ? comparison : -comparison;
        });
      }
    }

    return noCache({
      data: {
        items: sortedItems,
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
 * POST /ycode/api/collections/[id]/items
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
    // Get all fields to map field keys to field IDs
    const fields = await getFieldsByCollectionId(id, false);

    // Find field IDs for built-in fields
    const idField = fields.find(f => f.key === 'id');
    const createdAtField = fields.find(f => f.key === 'created_at');
    const updatedAtField = fields.find(f => f.key === 'updated_at');

    // Calculate auto-incrementing ID based on max ID value + 1
    const maxId = await getMaxIdValue(id, false);
    const autoIncrementId = maxId + 1;
    // Get current timestamp for created_at and updated_at
    const now = new Date().toISOString();

    // Set field values if provided, and add auto-generated fields
    // Use field IDs (UUIDs) as keys, not field keys
    const valuesWithAutoFields: Record<string, any> = {
      ...values,
    };
    // Set auto-incrementing ID if ID field exists
    if (idField) {
      valuesWithAutoFields[idField.id] = autoIncrementId.toString();
    }

    // Set timestamps if fields exist
    if (createdAtField) {
      valuesWithAutoFields[createdAtField.id] = now;
    }
    if (updatedAtField) {
      valuesWithAutoFields[updatedAtField.id] = now;
    }

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
