import { NextRequest, NextResponse } from 'next/server';
import { getPageById } from '@/lib/repositories/pageRepository';
import { getItemWithValues } from '@/lib/repositories/collectionItemRepository';

/**
 * GET /api/pages/[id]/collection-item?itemId=xxx
 * Fetches a specific collection item for a dynamic page
 * Requires itemId query parameter since pages don't store a fixed item_id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pageId } = await params;
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json(
        { error: 'itemId query parameter is required' },
        { status: 400 }
      );
    }

    // Get the page
    const page = await getPageById(pageId);

    if (!page) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    // Check if page is dynamic and has collection binding
    if (!page.is_dynamic || !page.settings?.cms?.collection_id) {
      return NextResponse.json(
        { error: 'Page is not a dynamic page or has no collection binding' },
        { status: 400 }
      );
    }

    // Fetch the collection item with values
    const item = await getItemWithValues(itemId, false); // Draft version

    if (!item) {
      return NextResponse.json(
        { error: 'Collection item not found' },
        { status: 404 }
      );
    }

    // Verify the item belongs to the correct collection
    if (item.collection_id !== page.settings.cms.collection_id) {
      return NextResponse.json(
        { error: 'Collection item does not belong to page collection' },
        { status: 400 }
      );
    }

    return NextResponse.json({ data: item });
  } catch (error) {
    console.error('Error fetching page collection item:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
