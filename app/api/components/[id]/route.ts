import { NextRequest, NextResponse } from 'next/server';
import {
  getComponentById,
  updateComponent,
  softDeleteComponent,
  restoreComponent,
  findEntitiesUsingComponent,
} from '@/lib/repositories/componentRepository';

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
 * Soft delete a component and detach it from all instances
 * Returns the deleted component and affected entities for undo/redo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Soft delete the component and get affected entities
    const result = await softDeleteComponent(id);

    return NextResponse.json({
      data: {
        component: result.component,
        affectedEntities: result.affectedEntities,
      },
      message: 'Component deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting component:', error);
    return NextResponse.json(
      { error: 'Failed to delete component' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/components/[id]
 * Restore a soft-deleted component or get affected entities preview
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if this is a restore request
    if (body.action === 'restore') {
      const component = await restoreComponent(id);
      return NextResponse.json({ data: component });
    }

    // Check if this is a preview request (get affected entities without deleting)
    if (body.action === 'preview-delete') {
      const affectedEntities = await findEntitiesUsingComponent(id);
      return NextResponse.json({
        data: {
          affectedCount: affectedEntities.length,
          affectedEntities: affectedEntities.map(e => ({
            type: e.type,
            id: e.id,
            name: e.name,
            pageId: e.pageId,
          })),
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error processing component action:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
