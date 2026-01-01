import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse } from '../../../../auth';
import { getCollectionById } from '@/lib/repositories/collectionRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';
import { getItemWithValues, deleteItem } from '@/lib/repositories/collectionItemRepository';
import { setValues } from '@/lib/repositories/collectionItemValueRepository';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Transform internal item format to public API format
 * Maps field IDs to exact field names and flattens the response
 */
function transformItemToPublic(
  item: any,
  fieldIdToName: Record<string, string>
): any {
  const result: Record<string, any> = {
    _id: item.id,  // Database UUID for API operations
  };
  
  // Flatten field values directly onto the item using exact field names
  for (const [fieldId, value] of Object.entries(item.values || {})) {
    const fieldName = fieldIdToName[fieldId];
    if (fieldName) {
      result[fieldName] = value;
    }
  }

  return result;
}

/**
 * GET /api/v1/collections/{collection_id}/items/{item_id}
 * Get a single published item with all field values (flattened)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ collection_id: string; item_id: string }> }
) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return unauthorizedResponse(authResult.error!);
  }

  try {
    const { collection_id, item_id } = await params;

    // Verify collection exists (published)
    const collection = await getCollectionById(collection_id, true);
    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get the published item with values
    const item = await getItemWithValues(item_id, true);
    if (!item || item.collection_id !== collection_id) {
      return NextResponse.json(
        { error: 'Item not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get published fields for mapping IDs to names
    const fields = await getFieldsByCollectionId(collection_id, true);
    const fieldIdToName: Record<string, string> = {};
    fields.forEach(field => {
      fieldIdToName[field.id] = field.name;  // Exact field name
    });

    return NextResponse.json(transformItemToPublic(item, fieldIdToName));
  } catch (error) {
    console.error('Error fetching collection item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch collection item', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/collections/{collection_id}/items/{item_id}
 * Full update - replaces all field values on published item
 * 
 * Request body (field values directly, no wrapper):
 * {
 *   "name": "Updated Name",
 *   "slug": "updated-slug"
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ collection_id: string; item_id: string }> }
) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return unauthorizedResponse(authResult.error!);
  }

  try {
    const { collection_id, item_id } = await params;

    // Verify collection exists (published)
    const collection = await getCollectionById(collection_id, true);
    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify item exists (published)
    const existingItem = await getItemWithValues(item_id, true);
    if (!existingItem || existingItem.collection_id !== collection_id) {
      return NextResponse.json(
        { error: 'Item not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Parse request body - field values directly (no fieldData wrapper)
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Get published fields for mapping
    const fields = await getFieldsByCollectionId(collection_id, true);
    const fieldSlugToId: Record<string, string> = {};  // For input (case-insensitive matching)
    const fieldIdToName: Record<string, string> = {};  // For output (exact field names)
    
    // Protected field keys that cannot be modified by user
    const protectedKeys = new Set(['id', 'created_at', 'updated_at']);
    
    fields.forEach(field => {
      const slug = (field.key || field.name).toLowerCase().replace(/\s+/g, '-');
      fieldSlugToId[slug] = field.id;
      fieldIdToName[field.id] = field.name;  // Exact field name for output
    });

    // For PUT, we clear existing values and set new ones
    const valuesToSet: Record<string, string | null> = {};
    
    // First, set all existing fields to null (to clear them) - EXCEPT protected fields
    for (const field of fields) {
      if (protectedKeys.has(field.key || '')) {
        // Skip protected fields - don't clear them
        continue;
      }
      valuesToSet[field.id] = null;
    }
    
    // Then set the provided values (case-insensitive matching, excluding protected fields)
    for (const [key, value] of Object.entries(body)) {
      const slug = key.toLowerCase().replace(/\s+/g, '-');
      const fieldId = fieldSlugToId[slug];
      if (fieldId) {
        // Find the field to check if it's protected
        const field = fields.find(f => f.id === fieldId);
        if (field && protectedKeys.has(field.key || '')) {
          // Skip protected fields - they cannot be modified
          continue;
        }
        valuesToSet[fieldId] = value as string | null;
      }
    }

    // Auto-update updated_at timestamp if field exists
    const updatedAtField = fields.find(f => f.key === 'updated_at');
    if (updatedAtField) {
      valuesToSet[updatedAtField.id] = new Date().toISOString();
    }

    // Update the item's updated_at timestamp (both draft and published)
    const client = await getSupabaseAdmin();
    if (client) {
      await client
        .from('collection_items')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', item_id)
        .eq('is_published', true);
      
      await client
        .from('collection_items')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', item_id)
        .eq('is_published', false);
    }

    // Set the values (both draft and published)
    await setValues(item_id, valuesToSet, true);   // Published
    await setValues(item_id, valuesToSet, false);  // Draft

    // Get updated item
    const updatedItem = await getItemWithValues(item_id, true);

    return NextResponse.json(transformItemToPublic(updatedItem, fieldIdToName));
  } catch (error) {
    console.error('Error updating collection item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update collection item', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/collections/{collection_id}/items/{item_id}
 * Partial update - only updates provided fields, keeps others unchanged
 * 
 * Request body (field values directly, no wrapper):
 * {
 *   "name": "Updated Name"
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ collection_id: string; item_id: string }> }
) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return unauthorizedResponse(authResult.error!);
  }

  try {
    const { collection_id, item_id } = await params;

    // Verify collection exists (published)
    const collection = await getCollectionById(collection_id, true);
    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify item exists (published)
    const existingItem = await getItemWithValues(item_id, true);
    if (!existingItem || existingItem.collection_id !== collection_id) {
      return NextResponse.json(
        { error: 'Item not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Parse request body - field values directly (no fieldData wrapper)
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body', code: 'INVALID_REQUEST' },
        { status: 400 }
      );
    }

    // Get published fields for mapping
    const fields = await getFieldsByCollectionId(collection_id, true);
    const fieldSlugToId: Record<string, string> = {};  // For input (case-insensitive matching)
    const fieldIdToName: Record<string, string> = {};  // For output (exact field names)
    
    // Protected field keys that cannot be modified by user
    const protectedKeys = new Set(['id', 'created_at', 'updated_at']);
    
    fields.forEach(field => {
      const slug = (field.key || field.name).toLowerCase().replace(/\s+/g, '-');
      fieldSlugToId[slug] = field.id;
      fieldIdToName[field.id] = field.name;  // Exact field name for output
    });

    // For PATCH, we only update provided fields (case-insensitive matching, excluding protected fields)
    const valuesToSet: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(body)) {
      const slug = key.toLowerCase().replace(/\s+/g, '-');
      const fieldId = fieldSlugToId[slug];
      if (fieldId) {
        // Find the field to check if it's protected
        const field = fields.find(f => f.id === fieldId);
        if (field && protectedKeys.has(field.key || '')) {
          // Skip protected fields - they cannot be modified
          continue;
        }
        valuesToSet[fieldId] = value as string | null;
      }
    }

    // Auto-update updated_at timestamp if field exists
    const updatedAtField = fields.find(f => f.key === 'updated_at');
    if (updatedAtField) {
      valuesToSet[updatedAtField.id] = new Date().toISOString();
    }

    // Update the item's updated_at timestamp (both draft and published)
    const client = await getSupabaseAdmin();
    if (client) {
      await client
        .from('collection_items')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', item_id)
        .eq('is_published', true);
      
      await client
        .from('collection_items')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', item_id)
        .eq('is_published', false);
    }

    // Set the values (both draft and published)
    if (Object.keys(valuesToSet).length > 0) {
      await setValues(item_id, valuesToSet, true);   // Published
      await setValues(item_id, valuesToSet, false);  // Draft
    }

    // Get updated item
    const updatedItem = await getItemWithValues(item_id, true);

    return NextResponse.json(transformItemToPublic(updatedItem, fieldIdToName));
  } catch (error) {
    console.error('Error patching collection item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to patch collection item', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/collections/{collection_id}/items/{item_id}
 * Delete a published item
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ collection_id: string; item_id: string }> }
) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return unauthorizedResponse(authResult.error!);
  }

  try {
    const { collection_id, item_id } = await params;

    // Verify collection exists (published)
    const collection = await getCollectionById(collection_id, true);
    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Verify item exists (published)
    const existingItem = await getItemWithValues(item_id, true);
    if (!existingItem || existingItem.collection_id !== collection_id) {
      return NextResponse.json(
        { error: 'Item not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Delete both published and draft items
    await deleteItem(item_id, true);   // Published
    await deleteItem(item_id, false);  // Draft

    return NextResponse.json({
      deleted: true,
      id: item_id,
    });
  } catch (error) {
    console.error('Error deleting collection item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete collection item', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
