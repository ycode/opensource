import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await getSupabaseAdmin();
    
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { data: components, error } = await supabase
      .from('components')
      .select('*');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      components: components?.map(c => ({
        id: c.id,
        name: c.name,
        layers: c.layers,
        layersType: typeof c.layers,
        layersIsArray: Array.isArray(c.layers),
        layersLength: Array.isArray(c.layers) ? c.layers.length : 'N/A'
      }))
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

