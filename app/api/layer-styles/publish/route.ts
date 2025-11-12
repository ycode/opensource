import { NextRequest, NextResponse } from 'next/server';
import { publishLayerStyle } from '@/lib/repositories/layerStyleRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/layer-styles/publish
 * Publish specified layer styles
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { style_ids } = body;
    
    if (!Array.isArray(style_ids)) {
      return noCache({ error: 'style_ids must be an array' }, 400);
    }
    
    let publishedCount = 0;
    
    // Publish each style
    for (const styleId of style_ids) {
      try {
        await publishLayerStyle(styleId);
        publishedCount++;
      } catch (error) {
        console.error(`Error publishing layer style ${styleId}:`, error);
        // Continue with other styles
      }
    }
    
    return noCache({ 
      data: { count: publishedCount } 
    });
  } catch (error) {
    console.error('Error publishing layer styles:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to publish layer styles' },
      500
    );
  }
}

