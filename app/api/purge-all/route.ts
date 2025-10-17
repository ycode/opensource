import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { noCache } from '@/lib/api-response';

/**
 * Vercel Cache Invalidation Endpoint
 * 
 * Handles full cache invalidation
 */

export async function POST(request: NextRequest) {
  try {
    // Invalidate all pages
    revalidatePath('/', 'layout');

    return noCache({
      success: true,
      message: 'All cache invalidated',
    });
  } catch (error) {
    console.error('Cache invalidation error:', error);
    
    return noCache(
      { error: 'Failed to invalidate cache' },
      500
    );
  }
}
