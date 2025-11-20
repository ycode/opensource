import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  try {
    const supabase = await getSupabaseAdmin();
    
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Get all components
    const { data: components, error: fetchError } = await supabase
      .from('components')
      .select('*');

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const fixed = [];

    // Fix each component
    for (const component of components || []) {
      // Check if layers is an array with one item that has children
      if (Array.isArray(component.layers) && 
          component.layers.length === 1 && 
          component.layers[0].children) {
        
        const oldLayers = component.layers;
        const newLayers = component.layers[0].children;
        
        // Update the component with the children only
        const { error: updateError } = await supabase
          .from('components')
          .update({ layers: newLayers })
          .eq('id', component.id);
        
        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }
        
        fixed.push({
          id: component.id,
          name: component.name,
          oldLayersCount: oldLayers.length,
          newLayersCount: newLayers.length
        });
      }
    }

    return NextResponse.json({ 
      message: 'Components fixed',
      fixed
    });
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
