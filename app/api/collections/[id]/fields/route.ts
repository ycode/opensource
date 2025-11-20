import { NextRequest, NextResponse } from 'next/server';
import { getFieldsByCollectionId, createField } from '@/lib/repositories/collectionFieldRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/collections/[id]/fields
 * Get all fields for a collection (draft version)
 * Query params:
 *  - search: string (optional) - Filter fields by name
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Extract search query parameter
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;

    const filters = search ? { search } : undefined;

    // Always get draft fields in the builder
    const fields = await getFieldsByCollectionId(id, false, filters);

    return noCache({ data: fields });
  } catch (error) {
    console.error('Error fetching collection fields:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch fields' },
      500
    );
  }
}

/**
 * POST /api/collections/[id]/fields
 * Create a new field for a collection (draft)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.type) {
      return noCache(
        { error: 'Missing required fields: name, type' },
        400
      );
    }

    // Validate field type
    const validTypes = ['text', 'rich_text', 'number', 'boolean', 'date', 'reference'];
    if (!validTypes.includes(body.type)) {
      return noCache(
        { error: `Invalid field type. Must be one of: ${validTypes.join(', ')}` },
        400
      );
    }

    const field = await createField({
      collection_id: id,
      name: body.name,
      key: body.key || null,
      type: body.type,
      default: body.default || null,
      fillable: body.fillable ?? true,
      order: body.order ?? 0,
      reference_collection_id: body.reference_collection_id || null,
      hidden: body.hidden ?? false,
      data: body.data || {},
      is_published: false, // Always create as draft
    });

    return noCache(
      { data: field },
      201
    );
  } catch (error) {
    console.error('Error creating field:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to create field' },
      500
    );
  }
}
