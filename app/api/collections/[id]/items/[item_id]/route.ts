import { NextRequest, NextResponse } from 'next/server';
import { getItemWithValues, updateItem, deleteItem } from '@/lib/repositories/collectionItemRepository';
import { setValuesByFieldName } from '@/lib/repositories/collectionItemValueRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/collections/[id]/items/[item_id]
 * Get item with values by ID
 * Query params:
 * - published=true: Get published values (default: false, returns draft values)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; item_id: string }> }
) {
  try {
    const { item_id } = await params;
    const itemId = item_id; // UUID string, no parsing needed

    // Check for published query param
    const { searchParams } = new URL(request.url);
    const isPublished = searchParams.get('published') === 'true';

    const item = await getItemWithValues(itemId, isPublished);

    if (!item) {
      return noCache({ error: 'Item not found' }, 404);
    }

    return noCache({ data: item });
  } catch (error) {
    console.error('Error fetching item:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch item' },
      500
    );
  }
}

/**
 * PUT /api/collections/[id]/items/[item_id]
 * Update item and its field values
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; item_id: string }> }
) {
  try {
    const { id, item_id } = await params;
    const collectionId = id; // UUID string
    const itemId = item_id; // UUID string

    const body = await request.json();

    // Extract values from body
    const { values, ...itemData } = body;

    // Always update the item's updated_at timestamp in collection_items table
    await updateItem(itemId, {
      ...itemData,
      // updated_at is automatically set in updateItem repository function
    });

    // Update field values if provided, and automatically update "Updated Date" field
    if (values && typeof values === 'object') {
      const now = new Date().toISOString();
      const valuesWithUpdatedDate = {
        ...values,
        updated_at: now, // Auto-update the "Updated Date" collection field
      };
      await setValuesByFieldName(
        itemId,
        collectionId,
        valuesWithUpdatedDate,
        {},
        false // is_published (draft)
      );
    }

    // Get updated item with values
    const updatedItem = await getItemWithValues(itemId, false);

    return noCache({ data: updatedItem });
  } catch (error) {
    console.error('Error updating item:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to update item' },
      500
    );
  }
}

/**
 * DELETE /api/collections/[id]/items/[item_id]
 * Delete item (soft delete)
 * Sets deleted_at timestamp to mark item as deleted in draft
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; item_id: string }> }
) {
  try {
    const { item_id } = await params;
    const itemId = item_id; // UUID string, no parsing needed

    await deleteItem(itemId);

    return noCache({ data: { success: true } }, 200);
  } catch (error) {
    console.error('Error deleting item:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to delete item' },
      500
    );
  }
}
