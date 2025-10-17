import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

/**
 * Vercel Cache Invalidation Endpoint
 * 
 * Handles cache tag invalidation for published pages
 */

export async function POST(request: NextRequest) {
  try {
    const { tags } = await request.json();

    if (!Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'Tags must be an array' },
        { status: 400 }
      );
    }

    // Invalidate each tag
    for (const tag of tags) {
      revalidateTag(tag);
    }

    return NextResponse.json({
      success: true,
      invalidated: tags,
    });
  } catch (error) {
    console.error('Cache invalidation error:', error);
    
    return NextResponse.json(
      { error: 'Failed to invalidate cache' },
      { status: 500 }
    );
  }
}
