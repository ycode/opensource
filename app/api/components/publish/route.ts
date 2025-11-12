import { NextRequest, NextResponse } from 'next/server';
import { publishComponent } from '@/lib/repositories/componentRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/components/publish
 * Publish specified components
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { component_ids } = body;
    
    if (!Array.isArray(component_ids)) {
      return noCache({ error: 'component_ids must be an array' }, 400);
    }
    
    let publishedCount = 0;
    
    // Publish each component
    for (const componentId of component_ids) {
      try {
        await publishComponent(componentId);
        publishedCount++;
      } catch (error) {
        console.error(`Error publishing component ${componentId}:`, error);
        // Continue with other components
      }
    }
    
    return noCache({ 
      data: { count: publishedCount } 
    });
  } catch (error) {
    console.error('Error publishing components:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to publish components' },
      500
    );
  }
}

