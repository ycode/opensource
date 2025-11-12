import { NextRequest, NextResponse } from 'next/server';
import { getFieldsByCollectionId, createField } from '@/lib/repositories/collectionFieldRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/collections/[id]/fields
 * Get all fields for a collection
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
    
    const fields = await getFieldsByCollectionId(collectionId);
    
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
 * Create a new field for a collection
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
    
    // Validate required fields
    if (!body.name || !body.field_name || !body.type) {
      return noCache(
        { error: 'Missing required fields: name, field_name, type' },
        400
      );
    }
    
    // Validate field type
    const validTypes = ['text', 'number', 'boolean', 'date', 'reference'];
    if (!validTypes.includes(body.type)) {
      return noCache(
        { error: `Invalid field type. Must be one of: ${validTypes.join(', ')}` },
        400
      );
    }
    
    const field = await createField({
      collection_id: collectionId,
      name: body.name,
      field_name: body.field_name,
      type: body.type,
      default: body.default || null,
      fillable: body.fillable ?? true,
      built_in: body.built_in ?? false,
      order: body.order ?? 0,
      reference_collection_id: body.reference_collection_id || null,
      hidden: body.hidden ?? false,
      data: body.data || {},
      status: body.status || 'draft',
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


