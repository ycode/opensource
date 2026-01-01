import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse } from '../../../auth';
import { getCollectionById } from '@/lib/repositories/collectionRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';
import { getItemsWithValues, createItem, getMaxIdValue } from '@/lib/repositories/collectionItemRepository';
import { setValues } from '@/lib/repositories/collectionItemValueRepository';

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
 * GET /api/v1/collections/{collection_id}/items
 * List all published items in a collection with pagination, filtering, and sorting
 * 
 * Query Parameters:
 * - page: number (default: 1) - Page number
 * - per_page: number (default: 100) - Items per page
 * - limit: number - Limit total number of records (alternative to pagination)
 * - sort_by: string - Field slug to sort by
 * - order_by: string (asc|desc, default: asc) - Sort order
 * - filter[field_slug]: string - Filter by exact field value
 * 
 * Response format:
 * {
 *   "items": [
 *     { "id": "...", "name": "...", "slug": "...", ... }
 *   ],
 *   "pagination": { "page": 1, "per_page": 100, "total": 50 }
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ collection_id: string }> }
) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return unauthorizedResponse(authResult.error!);
  }

  try {
    const { collection_id } = await params;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page');
    const perPageParam = searchParams.get('per_page');
    const limitParam = searchParams.get('limit');
    const sortByParam = searchParams.get('sort_by');
    const orderByParam = searchParams.get('order_by');
    
    // Pagination
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1;
    const perPage = perPageParam ? parseInt(perPageParam, 10) : 100;
    const limit = limitParam ? parseInt(limitParam, 10) : perPage;
    const offset = (page - 1) * perPage;

    // Verify collection exists (published)
    const collection = await getCollectionById(collection_id, true);
    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get published fields for mapping
    const fields = await getFieldsByCollectionId(collection_id, true);
    const fieldIdToName: Record<string, string> = {};  // For output (exact field names)
    const fieldSlugToId: Record<string, string> = {};  // For input (case-insensitive matching)
    fields.forEach(field => {
      const slug = (field.key || field.name).toLowerCase().replace(/\s+/g, '-');
      fieldIdToName[field.id] = field.name;  // Exact field name for output
      fieldSlugToId[slug] = field.id;
    });

    // Get published items with values
    let { items, total } = await getItemsWithValues(collection_id, true, {
      limit: limitParam ? limit : perPage,
      offset,
      deleted: false,
    });

    // Apply client-side filtering (filter[field_slug]=value)
    const filterParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      const match = key.match(/^filter\[(.+)\]$/);
      if (match) {
        filterParams[match[1]] = value;
      }
    });

    if (Object.keys(filterParams).length > 0) {
      items = items.filter(item => {
        for (const [slug, filterValue] of Object.entries(filterParams)) {
          const fieldId = fieldSlugToId[slug];
          if (fieldId) {
            const itemValue = item.values[fieldId];
            if (itemValue !== filterValue) {
              return false;
            }
          }
        }
        return true;
      });
      total = items.length;
    }

    // Apply sorting
    if (sortByParam) {
      const sortFieldId = fieldSlugToId[sortByParam];
      if (sortFieldId) {
        const order = orderByParam === 'desc' ? -1 : 1;
        items.sort((a, b) => {
          const aVal = a.values[sortFieldId] || '';
          const bVal = b.values[sortFieldId] || '';
          return aVal.localeCompare(bVal) * order;
        });
      }
    }

    // Transform items to public format (flattened)
    const publicItems = items.map(item => transformItemToPublic(item, fieldIdToName));

    return NextResponse.json({
      items: publicItems,
      pagination: {
        page,
        per_page: perPage,
        total,
      },
    });
  } catch (error) {
    console.error('Error fetching collection items:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch collection items', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/collections/{collection_id}/items
 * Create a new published item in a collection
 * 
 * Request body (field values directly, no wrapper):
 * {
 *   "name": "My Blog Post",
 *   "slug": "my-blog-post",
 *   "content": "..."
 * }
 * 
 * Response: created item with all field values (flattened)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ collection_id: string }> }
) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return unauthorizedResponse(authResult.error!);
  }

  try {
    const { collection_id } = await params;

    // Verify collection exists (published)
    const collection = await getCollectionById(collection_id, true);
    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found', code: 'NOT_FOUND' },
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
    
    // Protected field keys that cannot be set by user
    const protectedKeys = new Set(['id', 'created_at', 'updated_at']);
    
    fields.forEach(field => {
      const slug = (field.key || field.name).toLowerCase().replace(/\s+/g, '-');
      fieldSlugToId[slug] = field.id;
      fieldIdToName[field.id] = field.name;  // Exact field name for output
    });

    // Map field slugs to IDs (case-insensitive matching, excluding protected fields)
    const valuesToSet: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(body)) {
      const slug = key.toLowerCase().replace(/\s+/g, '-');
      const fieldId = fieldSlugToId[slug];
      if (fieldId) {
        // Find the field to check if it's protected
        const field = fields.find(f => f.id === fieldId);
        if (field && protectedKeys.has(field.key || '')) {
          // Skip protected fields - they are auto-generated
          continue;
        }
        valuesToSet[fieldId] = value as string | null;
      }
    }

    // Auto-generate ID field if exists
    const idField = fields.find(f => f.key === 'id');
    if (idField) {
      const maxId = await getMaxIdValue(collection_id, true);
      valuesToSet[idField.id] = String(maxId + 1);
    }

    // Auto-generate timestamps if fields exist
    const now = new Date().toISOString();
    const createdAtField = fields.find(f => f.key === 'created_at');
    if (createdAtField) {
      valuesToSet[createdAtField.id] = now;
    }
    const updatedAtField = fields.find(f => f.key === 'updated_at');
    if (updatedAtField) {
      valuesToSet[updatedAtField.id] = now;
    }

    // Create both draft and published items with the same ID
    // First create the draft item (this generates the ID)
    const item = await createItem({
      collection_id,
      is_published: false,
    });

    // Set values on draft first
    if (Object.keys(valuesToSet).length > 0) {
      await setValues(item.id, valuesToSet, false);
    }

    // Now create the published version with the same ID
    const { getSupabaseAdmin } = await import('@/lib/supabase-server');
    const { getValuesByItemId } = await import('@/lib/repositories/collectionItemValueRepository');
    const client = await getSupabaseAdmin();

    if (client) {
      // Insert published item with same ID
      await client
        .from('collection_items')
        .insert({
          id: item.id,
          collection_id,
          manual_order: item.manual_order,
          is_published: true,
          created_at: item.created_at,
          updated_at: item.updated_at,
        });

      // Copy draft values to published with SAME IDs (matching publishValues pattern)
      if (Object.keys(valuesToSet).length > 0) {
        const draftValues = await getValuesByItemId(item.id, false);
        const now = new Date().toISOString();
        
        const publishedValues = draftValues.map(value => ({
          id: value.id,  // Same ID as draft
          item_id: value.item_id,
          field_id: value.field_id,
          value: value.value,
          is_published: true,
          created_at: value.created_at,
          updated_at: now,
        }));

        await client
          .from('collection_item_values')
          .insert(publishedValues);
      }
    }

    // Build flattened response (_id + field values with exact names)
    const response: Record<string, any> = {
      _id: item.id,  // Database UUID for API operations
    };

    for (const [fieldId, value] of Object.entries(valuesToSet)) {
      const fieldName = fieldIdToName[fieldId];
      if (fieldName && value !== null) {
        response[fieldName] = value;
      }
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating collection item:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create collection item', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
