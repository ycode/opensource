import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /ycode/api/collections/[id]/items/reorder
 * Bulk update manual_order for multiple items
 * Used for drag and drop reordering
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collectionId = parseInt(id, 10);
    
    if (isNaN(collectionId)) {
      return noCache({ error: 'Invalid collection ID' }, 400);
    }
    
    const body = await request.json();
    const { updates } = body;
    
    if (!Array.isArray(updates)) {
      return noCache({ error: 'updates must be an array' }, 400);
    }
    
    if (updates.length === 0) {
      return noCache({ error: 'updates cannot be empty' }, 400);
    }
    
    // Validate updates format
    for (const update of updates) {
      if (typeof update.id !== 'number' || typeof update.manual_order !== 'number') {
        return noCache({ error: 'Each update must have id and manual_order as numbers' }, 400);
      }
    }
    
    const client = await getSupabaseAdmin();
    
    if (!client) {
      return noCache({ error: 'Supabase not configured' }, 500);
    }
    
    // Update each item's manual_order
    const updatePromises = updates.map(({ id, manual_order }) =>
      client
        .from('collection_items')
        .update({
          manual_order,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('collection_id', collectionId)
    );
    
    const results = await Promise.all(updatePromises);
    
    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Errors updating manual_order:', errors);
      return noCache({ error: 'Failed to update some items' }, 500);
    }
    
    return noCache({ data: { updated: updates.length } }, 200);
  } catch (error) {
    console.error('Error reordering items:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to reorder items' },
      500
    );
  }
}
