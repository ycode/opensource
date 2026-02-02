import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, unauthorizedResponse } from '../auth';
import { getAllCollections } from '@/lib/repositories/collectionRepository';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /ycode/api/v1/collections
 * List all published collections
 * 
 * Response format:
 * {
 *   "collections": [
 *     {
 *       "id": "uuid",
 *       "displayName": "Blog Posts",
 *       "singularName": "Blog Post",
 *       "slug": "blog-posts"
 *     }
 *   ]
 * }
 */
export async function GET(request: NextRequest) {
  // Validate API key
  const authResult = await validateApiKey(request);
  if (!authResult.valid) {
    return unauthorizedResponse(authResult.error!);
  }

  try {
    // Always get published collections
    const collections = await getAllCollections({ is_published: true, deleted: false });

    // Transform to public API format
    const publicCollections = collections.map(collection => ({
      id: collection.id,
      displayName: collection.name,
      singularName: collection.name.replace(/s$/, ''),
      slug: collection.name.toLowerCase().replace(/\s+/g, '-'),
    }));

    return NextResponse.json({
      collections: publicCollections,
    });
  } catch (error) {
    console.error('Error fetching collections:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch collections', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
