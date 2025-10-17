import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

/**
 * Vercel Cache Invalidation Endpoint
 * 
 * Handles full cache invalidation
 */

export async function POST(request: NextRequest) {
  try {
    // Invalidate all pages
    revalidatePath('/', 'layout');

    return NextResponse.json({
      success: true,
      message: 'All cache invalidated',
    });
  } catch (error) {
    console.error('Cache invalidation error:', error);
    
    return NextResponse.json(
      { error: 'Failed to invalidate cache' },
      { status: 500 }
    );
  }
}
