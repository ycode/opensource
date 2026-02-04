import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse } from '../../../../auth';
import { getCollectionById } from '@/lib/repositories/collectionRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';
import { getItemWithValues, deleteItem } from '@/lib/repositories/collectionItemRepository';
import { setValues } from '@/lib/repositories/collectionItemValueRepository';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { transformItemToPublicWithRefs, parseFieldProjections } from '../../../../reference-resolver';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /ycode/api/v1/collections/{collection_id}/items/{item_id}
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

    // Parse field projections from query params
    const { searchParams } = new URL(request.url);
    const fieldProjections = parseFieldProjections(searchParams);
    const hasProjections = Object.keys(fieldProjections).length > 0;

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

    // Get published fields for reference resolution
    const fields = await getFieldsByCollectionId(collection_id, true);

    // Transform with resolved references and optional field projections
    const response = await transformItemToPublicWithRefs(
      item, 
      fields, 
      true,
      hasProjections ? fieldProjections : undefined,
      hasProjections ? collection.name : undefined
    );
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching collection item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch collection item', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PUT /ycode/api/v1/collections/{collection_id}/items/{item_id}
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

    // Parse field projections from query params (for response filtering)
    const { searchParams } = new URL(request.url);
    const fieldProjections = parseFieldProjections(searchParams);
    const hasProjections = Object.keys(fieldProjections).length > 0;

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

    // Get published fields for mapping slugs to IDs
    const fields = await getFieldsByCollectionId(collection_id, true);
    const fieldSlugToId: Record<string, string> = {};
    
    // Identify protected fields (cannot be modified by user)
    const protectedFieldKeys = ['id', 'created_at', 'updated_at'];
    const protectedFieldIds = new Set(
      fields.filter(f => f.key && protectedFieldKeys.includes(f.key)).map(f => f.id)
    );
    
    fields.forEach(field => {
      const slug = field.key || field.name.toLowerCase().replace(/\s+/g, '-');
      fieldSlugToId[slug] = field.id;
    });

    // For PUT, we clear existing values and set new ones (except protected fields)
    const valuesToSet: Record<string, string | null> = {};
    
    // First, set all NON-protected fields to null (to clear them)
    for (const field of fields) {
      if (!protectedFieldIds.has(field.id)) {
        valuesToSet[field.id] = null;
      }
    }
    
    // Then set the provided values (case-insensitive matching, exclude protected fields)
    for (const [key, value] of Object.entries(body)) {
      const slug = key.toLowerCase().replace(/\s+/g, '-');
      const fieldId = fieldSlugToId[slug];
      if (fieldId && !protectedFieldIds.has(fieldId)) {
        valuesToSet[fieldId] = value as string | null;
      }
    }

    // Auto-update updated_at timestamp if field exists
    const updatedAtField = fields.find(f => f.key === 'updated_at');
    if (updatedAtField) {
      valuesToSet[updatedAtField.id] = new Date().toISOString();
    }

    // Update the item's updated_at timestamp for both draft and published
    const client = await getSupabaseAdmin();
    if (client) {
      await client
        .from('collection_items')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', item_id)
        .in('is_published', [true, false]);
    }

    // Set the values for both published and draft
    await setValues(item_id, valuesToSet, true);
    await setValues(item_id, valuesToSet, false);

    // Get updated item and transform with resolved references
    const updatedItem = await getItemWithValues(item_id, true);
    const response = await transformItemToPublicWithRefs(
      updatedItem!, 
      fields, 
      true,
      hasProjections ? fieldProjections : undefined,
      hasProjections ? collection.name : undefined
    );
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating collection item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update collection item', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /ycode/api/v1/collections/{collection_id}/items/{item_id}
 * Partial update - only updates provided fields, keeps others unchanged
 * 
 * Request body (field values directly, no wrapper):
 * {
 *   "Name": "Updated Name"
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

    // Parse field projections from query params (for response filtering)
    const { searchParams } = new URL(request.url);
    const fieldProjections = parseFieldProjections(searchParams);
    const hasProjections = Object.keys(fieldProjections).length > 0;

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

    // Get published fields for mapping slugs to IDs
    const fields = await getFieldsByCollectionId(collection_id, true);
    const fieldSlugToId: Record<string, string> = {};
    
    // Identify protected fields (cannot be modified by user)
    const protectedFieldKeys = ['id', 'created_at', 'updated_at'];
    const protectedFieldIds = new Set(
      fields.filter(f => f.key && protectedFieldKeys.includes(f.key)).map(f => f.id)
    );
    
    fields.forEach(field => {
      const slug = field.key || field.name.toLowerCase().replace(/\s+/g, '-');
      fieldSlugToId[slug] = field.id;
    });

    // For PATCH, we only update provided fields (case-insensitive matching, exclude protected fields)
    const valuesToSet: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(body)) {
      const slug = key.toLowerCase().replace(/\s+/g, '-');
      const fieldId = fieldSlugToId[slug];
      if (fieldId && !protectedFieldIds.has(fieldId)) {
        valuesToSet[fieldId] = value as string | null;
      }
    }

    // Auto-update updated_at timestamp if field exists
    const updatedAtField = fields.find(f => f.key === 'updated_at');
    if (updatedAtField) {
      valuesToSet[updatedAtField.id] = new Date().toISOString();
    }

    // Update the item's updated_at timestamp for both draft and published
    const client = await getSupabaseAdmin();
    if (client) {
      await client
        .from('collection_items')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', item_id)
        .in('is_published', [true, false]);
    }

    // Set the values for both published and draft
    if (Object.keys(valuesToSet).length > 0) {
      await setValues(item_id, valuesToSet, true);
      await setValues(item_id, valuesToSet, false);
    }

    // Get updated item and transform with resolved references
    const updatedItem = await getItemWithValues(item_id, true);
    const response = await transformItemToPublicWithRefs(
      updatedItem!, 
      fields, 
      true,
      hasProjections ? fieldProjections : undefined,
      hasProjections ? collection.name : undefined
    );
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error patching collection item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to patch collection item', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /ycode/api/v1/collections/{collection_id}/items/{item_id}
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
    await deleteItem(item_id, true);
    await deleteItem(item_id, false);

    return NextResponse.json({
      deleted: true,
      _id: item_id,
    });
  } catch (error) {
    console.error('Error deleting collection item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete collection item', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
