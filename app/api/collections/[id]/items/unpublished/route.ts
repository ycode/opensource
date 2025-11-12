import { NextRequest, NextResponse } from 'next/server';
import { getItemsWithValues } from '@/lib/repositories/collectionItemRepository';
import { noCache } from '@/lib/api-response';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/collections/[id]/items/unpublished
 * Get all unpublished (changed) items for a collection
 * An item is unpublished if its draft values differ from published values
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
    
    const client = await getSupabaseAdmin();
    
    if (!client) {
      return noCache({ error: 'Supabase not configured' }, 500);
    }
    
    // Get all items with their draft values
    const items = await getItemsWithValues(collectionId, undefined, false);
    
    const unpublishedItems = [];
    
    // Check each item to see if it needs publishing
    for (const item of items) {
      // Get draft values
      const { data: draftValues, error: draftError } = await client
        .from('collection_item_values')
        .select('field_id, value')
        .eq('item_id', item.id)
        .eq('is_published', false)
        .is('deleted_at', null);
      
      if (draftError) {
        console.error(`Error fetching draft values for item ${item.id}:`, draftError);
        continue;
      }
      
      // Get published values
      const { data: publishedValues, error: publishedError } = await client
        .from('collection_item_values')
        .select('field_id, value')
        .eq('item_id', item.id)
        .eq('is_published', true)
        .is('deleted_at', null);
      
      if (publishedError) {
        console.error(`Error fetching published values for item ${item.id}:`, publishedError);
        continue;
      }
      
      // If no published values, item is unpublished
      if (!publishedValues || publishedValues.length === 0) {
        unpublishedItems.push(item);
        continue;
      }
      
      // Check if draft differs from published
      const isDifferent = hasChanges(draftValues || [], publishedValues);
      
      if (isDifferent) {
        unpublishedItems.push(item);
      }
    }
    
    return noCache({ data: unpublishedItems });
  } catch (error) {
    console.error('Error fetching unpublished collection items:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch unpublished items' },
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


