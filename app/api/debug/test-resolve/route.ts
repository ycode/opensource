import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveComponents } from '@/lib/resolve-components';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await getSupabaseAdmin();
    
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Get all components
    const { data: components } = await supabase
      .from('components')
      .select('*');

    // Get the first page's published layers
    const { data: pages } = await supabase
      .from('pages')
      .select('*')
      .eq('is_published', true)
      .limit(1);

    if (!pages || pages.length === 0) {
      return NextResponse.json({ error: 'No published pages found' }, { status: 404 });
    }

    const { data: pageLayers } = await supabase
      .from('page_layers')
      .select('*')
      .eq('page_id', pages[0].id)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!pageLayers) {
      return NextResponse.json({ error: 'No page layers found' }, { status: 404 });
    }

    console.log('=== BEFORE RESOLUTION ===');
    console.log('Components:', JSON.stringify(components, null, 2));
    console.log('Page layers:', JSON.stringify(pageLayers.layers, null, 2));

    // Resolve components
    const resolvedLayers = resolveComponents(pageLayers.layers || [], components || []);

    console.log('=== AFTER RESOLUTION ===');
    console.log('Resolved layers:', JSON.stringify(resolvedLayers, null, 2));

    return NextResponse.json({ 
      components: components || [],
      originalLayers: pageLayers.layers || [],
      resolvedLayers
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
