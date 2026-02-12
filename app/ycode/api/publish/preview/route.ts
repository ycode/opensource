import { NextRequest } from 'next/server';
import { getUnpublishedPages } from '@/lib/repositories/pageRepository';
import { getAllUnpublishedItemsWithValues } from '@/lib/repositories/collectionItemRepository';
import { getUnpublishedComponents } from '@/lib/repositories/componentRepository';
import { getUnpublishedLayerStyles } from '@/lib/repositories/layerStyleRepository';
import { getAllCollections } from '@/lib/repositories/collectionRepository';
import { noCache } from '@/lib/api-response';
import type { Page, Collection, Component, LayerStyle, CollectionItemWithValues } from '@/types';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface PublishPreviewResponse {
  pages: Page[];
  collectionsWithItems: Array<{ collection: Collection; items: CollectionItemWithValues[] }>;
  components: Component[];
  layerStyles: LayerStyle[];
}

/**
 * GET /ycode/api/publish/preview
 * Get all unpublished items across all entity types in a single request.
 * Replaces 5+ sequential API calls with one parallel server-side load.
 */
export async function GET(request: NextRequest) {
  try {
    // Run all queries in parallel
    const [pages, collectionItemsByCollection, components, layerStyles, allCollections] = await Promise.all([
      getUnpublishedPages(),
      getAllUnpublishedItemsWithValues(),
      getUnpublishedComponents(),
      getUnpublishedLayerStyles(),
      getAllCollections(),
    ]);

    // Build collection lookup for names
    const collectionMap = new Map<string, Collection>();
    for (const c of allCollections) {
      collectionMap.set(c.id, c);
    }

    // Attach collection metadata to items
    const collectionsWithItems = collectionItemsByCollection
      .map(({ collection_id, items }) => {
        const collection = collectionMap.get(collection_id);
        if (!collection) return null;
        return { collection, items };
      })
      .filter((c): c is { collection: Collection; items: CollectionItemWithValues[] } => c !== null);

    return noCache({
      data: { pages, collectionsWithItems, components, layerStyles } satisfies PublishPreviewResponse,
    });
  } catch (error) {
    console.error('Error fetching publish preview:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch publish preview' },
      500
    );
  }
}
