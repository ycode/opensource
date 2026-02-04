import { NextRequest, NextResponse } from 'next/server';
import { getFieldById, updateField, deleteField } from '@/lib/repositories/collectionFieldRepository';
import { isValidFieldType, VALID_FIELD_TYPES } from '@/lib/collection-field-utils';
import { getItemsByCollectionId } from '@/lib/repositories/collectionItemRepository';
import { deleteTranslationsInBulk } from '@/lib/repositories/translationRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /ycode/api/collections/[id]/fields/[field_id]
 * Get field by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; field_id: string }> }
) {
  try {
    const { field_id } = await params;
    const fieldId = field_id; // UUID string, no parsing needed

    const field = await getFieldById(fieldId);

    if (!field) {
      return noCache({ error: 'Field not found' }, 404);
    }

    return noCache({ data: field });
  } catch (error) {
    console.error('Error fetching field:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch field' },
      500
    );
  }
}

/**
 * PUT /ycode/api/collections/[id]/fields/[field_id]
 * Update field
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; field_id: string }> }
) {
  try {
    const { field_id } = await params;
    const fieldId = field_id; // UUID string, no parsing needed

    const body = await request.json();

    // Validate field type if provided
    if (body.type && !isValidFieldType(body.type)) {
      return noCache(
        { error: `Invalid field type. Must be one of: ${VALID_FIELD_TYPES.join(', ')}` },
        400
      );
    }

    const field = await updateField(fieldId, body);

    return noCache({ data: field });
  } catch (error) {
    console.error('Error updating field:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to update field' },
      500
    );
  }
}

/**
 * DELETE /ycode/api/collections/[id]/fields/[field_id]
 * Delete field (soft delete) and all associated translations
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; field_id: string }> }
) {
  try {
    const { id, field_id } = await params;
    const collectionId = id;
    const fieldId = field_id; // UUID string, no parsing needed

    // Check if field is built-in before deleting
    const field = await getFieldById(fieldId);

    if (!field) {
      return noCache({ error: 'Field not found' }, 404);
    }

    if (field.key) {
      return noCache({ error: 'Cannot delete built-in fields' }, 400);
    }

    // Get all items in this collection to delete translations for this field
    const { items } = await getItemsByCollectionId(collectionId, false);

    // Delete translations for this field across all items in a single query
    if (items.length > 0) {
      const itemIds = items.map(item => item.id);
      const contentKey = field.key ? `field:key:${field.key}` : `field:id:${fieldId}`;
      await deleteTranslationsInBulk('cms', itemIds, [contentKey]);
    }

    await deleteField(fieldId);

    return noCache({ data: { success: true } }, 200);
  } catch (error) {
    console.error('Error deleting field:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to delete field' },
      500
    );
  }
}
