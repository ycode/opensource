import { NextRequest, NextResponse } from 'next/server';
import { getComponentById, updateComponent, deleteComponent } from '@/lib/repositories/componentRepository';

/**
 * GET /api/components/[id]
 * Get a single component by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const component = await getComponentById(id);
    
    if (!component) {
      return NextResponse.json({ error: 'Component not found' }, { status: 404 });
    }
    
    return NextResponse.json({ data: component });
  } catch (error) {
    console.error('Error fetching component:', error);
    return NextResponse.json(
      { error: 'Failed to fetch component' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/components/[id]
 * Update a component (triggers sync across all instances)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, layers } = body;
    
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (layers !== undefined) updates.layers = layers;
    
    const component = await updateComponent(id, updates);
    
    return NextResponse.json({ data: component });
  } catch (error) {
    console.error('Error updating component:', error);
    return NextResponse.json(
      { error: 'Failed to update component' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/components/[id]
 * Delete a component (detaches from all instances)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteComponent(id);
    
    return NextResponse.json({ message: 'Component deleted successfully' });
  } catch (error) {
    console.error('Error deleting component:', error);
    return NextResponse.json(
      { error: 'Failed to delete component' },
      { status: 500 }
    );
  }
}

