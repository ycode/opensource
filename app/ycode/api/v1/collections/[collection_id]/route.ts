import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse } from '../../auth';
import { getCollectionById } from '@/lib/repositories/collectionRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /ycode/api/v1/collections/{collection_id}
 * Get a single published collection with its fields
 * 
 * Response format:
 * {
 *   "id": "uuid",
 *   "displayName": "Blog Posts",
 *   "singularName": "Blog Post",
 *   "slug": "blog-posts",
 *   "fields": [
 *     {
 *       "id": "uuid",
 *       "displayName": "Title",
 *       "slug": "title",
 *       "type": "text",
 *       "isRequired": false
 *     }
 *   ]
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

    // Always get published collection
    const collection = await getCollectionById(collection_id, true);

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get published fields for this collection
    const fields = await getFieldsByCollectionId(collection_id, true);

    // Transform fields to public API format
    const publicFields = fields
      .filter(field => !field.hidden)
      .map(field => ({
        id: field.id,
        displayName: field.name,
        slug: field.key || field.name.toLowerCase().replace(/\s+/g, '-'),
        type: field.type,
        isRequired: field.fillable,
        ...(field.data?.validations && { validations: field.data.validations }),
      }));

    return NextResponse.json({
      id: collection.id,
      displayName: collection.name,
      singularName: collection.name.replace(/s$/, ''),
      slug: collection.name.toLowerCase().replace(/\s+/g, '-'),
      fields: publicFields,
    });
  } catch (error) {
    console.error('Error fetching collection:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch collection', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
