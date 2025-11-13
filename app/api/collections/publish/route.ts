import { NextRequest, NextResponse } from 'next/server';
import { getItemsByCollectionId } from '@/lib/repositories/collectionItemRepository';
import { publishValues, getValuesByItemId } from '@/lib/repositories/collectionItemValueRepository';
import { noCache } from '@/lib/api-response';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/collections/publish
 * Publish unpublished items in specified collections
 * Copies draft values to published values
 * An item needs publishing if:
 * - It has no published values (never published), OR
 * - Its draft values differ from published values (needs republishing)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collection_ids } = body;
    
    if (!Array.isArray(collection_ids)) {
      return noCache({ error: 'collection_ids must be an array' }, 400);
    }
    
    const publishedCounts: Record<number, number> = {};
    const client = await getSupabaseAdmin();
    
    if (!client) {
      return noCache({ error: 'Supabase not configured' }, 500);
    }
    
    // For each collection, find items that need publishing
    for (const collectionId of collection_ids) {
      try {
        // Get all items for this collection
        const { items } = await getItemsByCollectionId(collectionId);
        
        let publishedCount = 0;
        
        // Check each item to see if it needs publishing
        for (const item of items) {
          // Get draft values
          const { data: draftValues } = await client
            .from('collection_item_values')
            .select('field_id, value')
            .eq('item_id', item.id)
            .eq('is_published', false)
            .is('deleted_at', null);
          
          // Get published values
          const { data: publishedValuesData } = await client
            .from('collection_item_values')
            .select('field_id, value')
            .eq('item_id', item.id)
            .eq('is_published', true)
            .is('deleted_at', null);
          
          let needsPublishing = false;
          
          // If no published values, needs first-time publish
          if (!publishedValuesData || publishedValuesData.length === 0) {
            needsPublishing = true;
          } else {
            // Check if draft differs from published
            needsPublishing = hasChanges(draftValues || [], publishedValuesData);
          }
          
          if (needsPublishing) {
            // Copy draft values to published values
            await publishValues(item.id);
            publishedCount++;
          }
        }
        
        publishedCounts[collectionId] = publishedCount;
      } catch (error) {
        console.error(`Error publishing collection ${collectionId}:`, error);
        publishedCounts[collectionId] = 0;
      }
    }
    
    return noCache({ 
      data: { published: publishedCounts } 
    });
  } catch (error) {
    console.error('Error publishing collections:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to publish collections' },
      500
    );
  }
}

/**
 * Helper to check if draft values differ from published values
 */
function hasChanges(
  draftValues: Array<{ field_id: number; value: string | null }>,
  publishedValues: Array<{ field_id: number; value: string | null }>
): boolean {
  // Create maps for easy comparison
  const draftMap = new Map(draftValues.map(v => [v.field_id, v.value]));
  const publishedMap = new Map(publishedValues.map(v => [v.field_id, v.value]));
  
  // Check if number of fields differs
  if (draftMap.size !== publishedMap.size) {
    return true;
  }
  
  // Check if any draft value differs from published
  for (const [fieldId, draftValue] of draftMap) {
    const publishedValue = publishedMap.get(fieldId);
    
    // Field doesn't exist in published or value differs
    if (publishedValue === undefined || draftValue !== publishedValue) {
      return true;
    }
  }
  
  return false;
}


