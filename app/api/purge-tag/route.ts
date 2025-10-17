import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { noCache } from '@/lib/api-response';

/**
 * Vercel Cache Invalidation Endpoint
 * 
 * Handles cache tag invalidation for published pages
 */

export async function POST(request: NextRequest) {
  try {
    const { tags } = await request.json();

    if (!Array.isArray(tags)) {
      return noCache(
        { error: 'Tags must be an array' },
        400
      );
    }

    // Invalidate each tag
    for (const tag of tags) {
      revalidateTag(tag);
    }

    return noCache({
      success: true,
      invalidated: tags,
    });
  } catch (error) {
    console.error('Cache invalidation error:', error);
    
    return noCache(
      { error: 'Failed to invalidate cache' },
      500
    );
  }
}
