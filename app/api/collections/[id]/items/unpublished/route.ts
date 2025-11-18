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
 * An item is unpublished if:
 * - It has draft values but no published values (new)
 * - Its draft values differ from published values (updated)
 * - It is soft-deleted AND has published values (deleted - needs removal from published)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collectionId = id; // UUID string, no parsing needed
    
    const client = await getSupabaseAdmin();
    
    if (!client) {
      return noCache({ error: 'Supabase not configured' }, 500);
    }
    
    // Get all items including deleted ones (no pagination for unpublished check)
    // Parameters: collection_id, collectionIsPublished, filters, is_published
    const { items } = await getItemsWithValues(
      collectionId,
      false, // collectionIsPublished (draft)
      { deleted: undefined }, // filters (include all deleted states)
      false // is_published (draft values)
    );
    
    const unpublishedItems = [];
    
    // Check each item to see if it needs publishing
    for (const item of items) {
      // If item is deleted, check if it has published values
      if (item.deleted_at) {
        // Get published values to check if item was ever published
        const { data: publishedValues, error: publishedCheckError } = await client
          .from('collection_item_values')
          .select('field_id')
          .eq('item_id', item.id)
          .eq('item_is_published', true)
          .eq('is_published', true)
          .is('deleted_at', null)
          .limit(1);
        
        if (publishedCheckError) {
          console.error(`Error checking published values for item ${item.id}:`, publishedCheckError);
          continue;
        }
        
        // Only show as "deleted" if there are published values to remove
        if (publishedValues && publishedValues.length > 0) {
          unpublishedItems.push({ ...item, publish_status: 'deleted' });
        }
        // If no published values, skip this item (never published, so nothing to delete)
        continue;
      }
      
      // Get draft values
      const { data: draftValues, error: draftError } = await client
        .from('collection_item_values')
        .select('field_id, value')
        .eq('item_id', item.id)
        .eq('item_is_published', false)
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
        .eq('item_is_published', true)
        .eq('is_published', true)
        .is('deleted_at', null);
      
      if (publishedError) {
        console.error(`Error fetching published values for item ${item.id}:`, publishedError);
        continue;
      }
      
      // If no published values, item is new
      if (!publishedValues || publishedValues.length === 0) {
        unpublishedItems.push({ ...item, publish_status: 'new' });
        continue;
      }
      
      // Check if draft differs from published
      const isDifferent = hasChanges(draftValues || [], publishedValues);
      
      if (isDifferent) {
        unpublishedItems.push({ ...item, publish_status: 'updated' });
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
  draftValues: Array<{ field_id: string; value: string | null }>,
  publishedValues: Array<{ field_id: string; value: string | null }>
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


