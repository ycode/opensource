import { NextRequest } from 'next/server';
import { getUnpublishedPagesCount } from '@/lib/repositories/pageRepository';
import { getTotalPublishableItemsCount } from '@/lib/repositories/collectionItemRepository';
import { getUnpublishedCollections } from '@/lib/repositories/collectionRepository';
import { getUnpublishedComponents } from '@/lib/repositories/componentRepository';
import { getUnpublishedLayerStyles } from '@/lib/repositories/layerStyleRepository';
import { getUnpublishedAssets } from '@/lib/repositories/assetRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface PublishPreviewCounts {
  pages: number;
  collections: number;
  collectionItems: number;
  components: number;
  layerStyles: number;
  assets: number;
  total: number;
}

/**
 * GET /ycode/api/publish/preview
 * Get counts of all unpublished items per entity type in a single request.
 */
export async function GET(request: NextRequest) {
  try {
    const [pages, collections, collectionItems, components, layerStyles, assets] = await Promise.all([
      getUnpublishedPagesCount(),
      getUnpublishedCollections().then(c => c.length),
      getTotalPublishableItemsCount(),
      getUnpublishedComponents().then(c => c.length),
      getUnpublishedLayerStyles().then(s => s.length),
      getUnpublishedAssets().then(a => a.length),
    ]);

    const total = pages + collections + collectionItems + components + layerStyles + assets;

    return noCache({
      data: { pages, collections, collectionItems, components, layerStyles, assets, total } satisfies PublishPreviewCounts,
    });
  } catch (error) {
    console.error('Error fetching publish preview:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch publish preview' },
      500
    );
  }
}
