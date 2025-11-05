import { NextRequest, NextResponse } from 'next/server';
import {
  getStyleById,
  updateStyle,
  deleteStyle,
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
 * Delete a layer style
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteStyle(id);
    return NextResponse.json({ message: 'Layer style deleted successfully' });
  } catch (error) {
    console.error('Error deleting layer style:', error);
    return NextResponse.json(
      { error: 'Failed to delete layer style' },
      { status: 500 }
    );
  }
}

