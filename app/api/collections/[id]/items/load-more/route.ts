import { NextRequest } from 'next/server';
import { getItemsWithValues } from '@/lib/repositories/collectionItemRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';
import { getAllPages } from '@/lib/repositories/pageRepository';
import { getAllPageFolders } from '@/lib/repositories/pageFolderRepository';
import { renderCollectionItemsToHtml, loadTranslationsForLocale } from '@/lib/page-fetcher';
import { noCache } from '@/lib/api-response';
import type { Layer, Page, PageFolder } from '@/types';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/collections/[id]/items/load-more
 * Get paginated collection items for "Load More" functionality
 * Returns pre-rendered HTML for client-side appending
 *
 * Body (JSON):
 * - offset: number of items to skip (default: 0)
 * - limit: number of items to fetch (default: 10)
 * - itemIds: array of item IDs to filter by (for multi-reference fields)
 * - layerTemplate: Layer[] - the layer template to render items with
 * - collectionLayerId: string - the collection layer ID for unique item IDs
 * - published: whether to fetch published items (default: true for public pages)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collectionId = id;

    // Parse request body
    const body = await request.json();
    const {
      offset = 0,
      limit = 10,
      itemIds,
      layerTemplate,
      collectionLayerId,
      published = true,
      localeCode,
    } = body;

    // Validate required fields
    if (!layerTemplate || !Array.isArray(layerTemplate)) {
      return noCache(
        { error: 'layerTemplate is required and must be an array' },
        400
      );
    }

    if (!collectionLayerId) {
      return noCache(
        { error: 'collectionLayerId is required' },
        400
      );
    }

    // Build filters
    const filters: {
      offset?: number;
      limit?: number;
      itemIds?: string[];
    } = {
      offset: isNaN(offset) ? 0 : Math.max(0, offset),
      limit: isNaN(limit) || limit < 1 ? 10 : Math.min(limit, 100), // Cap at 100
    };

    if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
      filters.itemIds = itemIds;
    }

    // Fetch items with values
    const { items, total } = await getItemsWithValues(
      collectionId,
      published,
      filters
    );

    // Build collection item slugs from the items we're rendering
    const collectionItemSlugs: Record<string, string> = {};

    // Get the slug field for this collection
    const collectionFields = await getFieldsByCollectionId(collectionId, published);
    const slugField = collectionFields.find(f => f.key === 'slug');

    // Extract slug values from items
    if (slugField) {
      for (const item of items) {
        if (item.values[slugField.id]) {
          collectionItemSlugs[item.id] = item.values[slugField.id];
        }
      }
    }

    // Fetch pages and folders for link resolution using repository functions
    const [pages, folders] = await Promise.all([
      getAllPages(),
      getAllPageFolders(),
    ]);

    // Load locale and translations if locale code is provided
    let locale = null;
    let translations: Record<string, any> | undefined;
    if (localeCode) {
      const localeData = await loadTranslationsForLocale(localeCode, published);
      locale = localeData.locale;
      translations = localeData.translations;
    }

    // Render items to HTML using the provided template
    const html = await renderCollectionItemsToHtml(
      items,
      layerTemplate as Layer[],
      collectionId,
      collectionLayerId,
      published,
      pages,
      folders,
      collectionItemSlugs,
      locale,
      translations
    );

    return noCache({
      data: {
        items,
        html,
        total,
        offset: filters.offset,
        limit: filters.limit,
        hasMore: (filters.offset || 0) + items.length < total,
      }
    });
  } catch (error) {
    console.error('Error fetching collection items for load-more:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch items' },
      500
    );
  }
}

/**
 * GET /api/collections/[id]/items/load-more
 * Legacy endpoint - returns raw data without rendering
 * Kept for backward compatibility
 *
 * Query params:
 * - offset: number of items to skip (default: 0)
 * - limit: number of items to fetch (default: 10)
 * - itemIds: comma-separated list of item IDs to filter by (for multi-reference fields)
 * - published: whether to fetch published items (default: true for public pages)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const collectionId = id;

    const { searchParams } = new URL(request.url);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const itemIdsParam = searchParams.get('itemIds');
    const isPublished = searchParams.get('published') !== 'false';

    // Parse itemIds if provided (for multi-reference filtering)
    const itemIds = itemIdsParam ? itemIdsParam.split(',').filter(Boolean) : undefined;

    // Build filters
    const filters: {
      offset?: number;
      limit?: number;
      itemIds?: string[];
    } = {
      offset: isNaN(offset) ? 0 : offset,
      limit: isNaN(limit) || limit < 1 ? 10 : Math.min(limit, 100), // Cap at 100
    };

    if (itemIds && itemIds.length > 0) {
      filters.itemIds = itemIds;
    }

    // Fetch items with values
    const { items, total } = await getItemsWithValues(
      collectionId,
      isPublished,
      filters
    );

    return noCache({
      data: {
        items,
        total,
        offset: filters.offset,
        limit: filters.limit,
        hasMore: (filters.offset || 0) + items.length < total,
      }
    });
  } catch (error) {
    console.error('Error fetching collection items for load-more:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch items' },
      500
    );
  }
}
