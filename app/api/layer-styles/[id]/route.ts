import { NextRequest, NextResponse } from 'next/server';
import {
  getStyleById,
  updateStyle,
  softDeleteStyle,
  restoreLayerStyle,
  findEntitiesUsingLayerStyle,
} from '@/lib/repositories/layerStyleRepository';

/**
 * GET /api/layer-styles/[id]
 * Get a single layer style
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const style = await getStyleById(id);

    if (!style) {
      return NextResponse.json(
        { error: 'Layer style not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: style });
  } catch (error) {
    console.error('Error fetching layer style:', error);
    return NextResponse.json(
      { error: 'Failed to fetch layer style' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/layer-styles/[id]
 * Update a layer style's draft version
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const style = await updateStyle(id, {
      name: body.name,
      classes: body.classes,
      design: body.design,
    });

    return NextResponse.json({ data: style });
  } catch (error) {
    console.error('Error updating layer style:', error);
    return NextResponse.json(
      { error: 'Failed to update layer style' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/layer-styles/[id]
 * Soft delete a layer style and detach it from all instances
 * Returns the deleted style and affected entities for undo/redo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Soft delete the style and get affected entities
    const result = await softDeleteStyle(id);

    return NextResponse.json({
      data: {
        layerStyle: result.layerStyle,
        affectedEntities: result.affectedEntities,
      },
      message: 'Layer style deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting layer style:', error);
    return NextResponse.json(
      { error: 'Failed to delete layer style' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/layer-styles/[id]
 * Restore a soft-deleted layer style or get affected entities preview
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
      const layerStyle = await restoreLayerStyle(id);
      return NextResponse.json({ data: layerStyle });
    }

    // Check if this is a preview request (get affected entities without deleting)
    if (body.action === 'preview-delete') {
      const affectedEntities = await findEntitiesUsingLayerStyle(id);
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
    console.error('Error processing layer style action:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
