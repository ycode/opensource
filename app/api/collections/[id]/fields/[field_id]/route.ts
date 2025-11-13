import { NextRequest, NextResponse } from 'next/server';
import { getFieldById, updateField, deleteField } from '@/lib/repositories/collectionFieldRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/collections/[id]/fields/[field_id]
 * Get field by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; field_id: string }> }
) {
  try {
    const { field_id } = await params;
    const fieldId = parseInt(field_id, 10);
    
    if (isNaN(fieldId)) {
      return noCache({ error: 'Invalid field ID' }, 400);
    }
    
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
 * PUT /api/collections/[id]/fields/[field_id]
 * Update field
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; field_id: string }> }
) {
  try {
    const { field_id } = await params;
    const fieldId = parseInt(field_id, 10);
    
    if (isNaN(fieldId)) {
      return noCache({ error: 'Invalid field ID' }, 400);
    }
    
    const body = await request.json();
    
    // Validate field type if provided
    if (body.type) {
      const validTypes = ['text', 'rich_text', 'number', 'boolean', 'date', 'reference'];
      if (!validTypes.includes(body.type)) {
        return noCache(
          { error: `Invalid field type. Must be one of: ${validTypes.join(', ')}` },
          400
        );
      }
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
 * DELETE /api/collections/[id]/fields/[field_id]
 * Delete field (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; field_id: string }> }
) {
  try {
    const { field_id } = await params;
    const fieldId = parseInt(field_id, 10);
    
    if (isNaN(fieldId)) {
      return noCache({ error: 'Invalid field ID' }, 400);
    }
    
    // Check if field is built-in before deleting
    const field = await getFieldById(fieldId);
    
    if (!field) {
      return noCache({ error: 'Field not found' }, 404);
    }
    
    if (field.built_in) {
      return noCache({ error: 'Cannot delete built-in fields' }, 400);
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

