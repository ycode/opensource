import { NextRequest } from 'next/server';
import { noCache } from '@/lib/api-response';
import { publishPages } from '@/lib/services/pageService';
import { publishCollectionWithItems, groupItemsByCollection } from '@/lib/services/collectionService';
import { publishLocalisation } from '@/lib/services/localisationService';
import { publishFolders } from '@/lib/services/folderService';
import { publishCSS, savePublishedAt } from '@/lib/services/settingsService';
import { clearAllCache } from '@/lib/services/cacheService';
import { getAllDraftPages } from '@/lib/repositories/pageRepository';
import { publishComponents, getUnpublishedComponents } from '@/lib/repositories/componentRepository';
import { publishLayerStyles, getUnpublishedLayerStyles } from '@/lib/repositories/layerStyleRepository';
import { getAllCollections } from '@/lib/repositories/collectionRepository';
import { getItemsByCollectionId } from '@/lib/repositories/collectionItemRepository';
import { publishAssets, getUnpublishedAssets, hardDeleteSoftDeletedAssets } from '@/lib/repositories/assetRepository';
import { publishAssetFolders, getUnpublishedAssetFolders, hardDeleteSoftDeletedAssetFolders } from '@/lib/repositories/assetFolderRepository';
import type { Setting, PublishStats, PublishTableStats } from '@/types';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PublishRequest {
  publishAll?: boolean; // If true and no specific items provided, publish all unpublished items
  folderIds?: string[]; // Publish specific folders
  pageIds?: string[];
  collectionIds?: string[]; // Publish all items in these collections
  collectionItemIds?: string[]; // Publish specific collection items
  componentIds?: string[];
  layerStyleIds?: string[];
  publishLocales?: boolean; // Whether to publish locales/translations (defaults to true)
}

interface PublishResult {
  changes: {
    folders: number;
    pages: number;
    collectionItems: number;
    components: number;
    layerStyles: number;
    assetFolders: number;
    assetFoldersDeleted: number;
    assets: number;
    assetsDeleted: number;
    locales: number;
    translations: number;
    css: boolean;
  };
  published_at_setting: Setting;
  stats: PublishStats;
}

/** Creates an empty table stats object */
function emptyTableStats(): PublishTableStats {
  return { durationMs: 0, added: 0, updated: 0, deleted: 0 };
}

/** Creates an empty stats object */
function createEmptyStats(): PublishStats {
  return {
    totalDurationMs: 0,
    tables: {
      page_folders: emptyTableStats(),
      pages: emptyTableStats(),
      page_layers: emptyTableStats(),
      collections: emptyTableStats(),
      collection_fields: emptyTableStats(),
      collection_items: emptyTableStats(),
      collection_item_values: emptyTableStats(),
      components: emptyTableStats(),
      layer_styles: emptyTableStats(),
      asset_folders: emptyTableStats(),
      assets: emptyTableStats(),
      locales: emptyTableStats(),
      translations: emptyTableStats(),
      css: emptyTableStats(),
    },
  };
}

/**
 * POST /ycode/api/publish
 *
 * Global publish endpoint that can:
 * 1. Publish all unpublished items (publishAll: true)
 * 2. Publish specific selected items (provide IDs)
 *
 * Handles: folders, pages, collection items, components, layer styles, locales, translations, and CSS
 *
 * Publishing order: folders → pages → collections → components → layer styles → locales → CSS
 *
 * For collections, you can provide:
 * - collectionIds: Publish all unpublished items in these collections
 * - collectionItemIds: Publish specific collection items (automatically grouped by collection)
 */
export async function POST(request: NextRequest) {
  const startTime = performance.now();
  const stats = createEmptyStats();

  try {
    const body: PublishRequest = await request.json().catch(() => ({}));

    const {
      publishAll = false,
      folderIds,
      pageIds,
      collectionIds,
      collectionItemIds,
      componentIds,
      layerStyleIds,
      publishLocales = true,
    } = body;

    const publishedAt = new Date().toISOString();

    const result: PublishResult = {
      changes: {
        folders: 0,
        pages: 0,
        collectionItems: 0,
        components: 0,
        layerStyles: 0,
        assetFolders: 0,
        assetFoldersDeleted: 0,
        assets: 0,
        assetsDeleted: 0,
        locales: 0,
        translations: 0,
        css: false,
      },
      published_at_setting: {
        key: 'published_at',
        value: publishedAt,
      } as Setting,
      stats,
    };

    // Determine if we're publishing all or specific items
    const isPublishingAll = publishAll && !folderIds && !pageIds && !collectionIds && !collectionItemIds && !componentIds && !layerStyleIds;

    // Publish folders first (pages depend on them)
    {
      const stepStart = performance.now();
      const foldersResult = await publishFolders(
        isPublishingAll ? [] : (folderIds || []),
        pageIds
      );
      result.changes.folders = foldersResult.count;
      stats.tables.page_folders.durationMs = Math.round(performance.now() - stepStart);
      stats.tables.page_folders.added = foldersResult.count;
    }

    // Publish pages
    {
      if (pageIds && pageIds.length > 0) {
        const pagesResult = await publishPages(pageIds);
        result.changes.pages = pagesResult.count;
        stats.tables.pages.added = pagesResult.count;
        stats.tables.pages.durationMs = pagesResult.timing.pagesDurationMs;
        stats.tables.page_layers.added = pagesResult.timing.layersCount;
        stats.tables.page_layers.durationMs = pagesResult.timing.layersDurationMs;
      } else if (isPublishingAll) {
        const unpublishedPages = await getAllDraftPages();
        if (unpublishedPages.length > 0) {
          const allPageIds = unpublishedPages.map(p => p.id);
          const pagesResult = await publishPages(allPageIds);
          result.changes.pages = pagesResult.count;
          stats.tables.pages.added = pagesResult.count;
          stats.tables.pages.durationMs = pagesResult.timing.pagesDurationMs;
          stats.tables.page_layers.added = pagesResult.timing.layersCount;
          stats.tables.page_layers.durationMs = pagesResult.timing.layersDurationMs;
        }
      }
    }

    // Publish collections with items
    {
      let totalItems = 0;
      let totalValues = 0;
      let totalFields = 0;
      let totalCollections = 0;
      let collectionsMs = 0;
      let fieldsMs = 0;
      let itemsMs = 0;
      let valuesMs = 0;

      if ((collectionIds && collectionIds.length > 0) || (collectionItemIds && collectionItemIds.length > 0)) {
        const collectionPublishes: Array<{ collectionId: string; itemIds: string[] }> = [];

        if (collectionIds && collectionIds.length > 0) {
          for (const collectionId of collectionIds) {
            const { items } = await getItemsByCollectionId(collectionId, false);
            if (items.length > 0) {
              collectionPublishes.push({
                collectionId,
                itemIds: items.map((item: any) => item.id),
              });
            }
          }
        }

        if (collectionItemIds && collectionItemIds.length > 0) {
          const itemsByCollection = await groupItemsByCollection(collectionItemIds);
          itemsByCollection.forEach((itemIds, collectionId) => {
            const existing = collectionPublishes.find(cp => cp.collectionId === collectionId);
            if (existing) {
              const combined = new Set([...existing.itemIds, ...itemIds]);
              existing.itemIds = Array.from(combined);
            } else {
              collectionPublishes.push({ collectionId, itemIds });
            }
          });
        }

        if (collectionPublishes.length > 0) {
          for (const collectionPublish of collectionPublishes) {
            const publishResult = await publishCollectionWithItems({
              collectionId: collectionPublish.collectionId,
              itemIds: collectionPublish.itemIds,
            });
            totalItems += publishResult.published?.itemsCount || 0;
            totalValues += publishResult.published?.valuesCount || 0;
            totalFields += publishResult.published?.fieldsCount || 0;
            if (publishResult.published?.collection) totalCollections++;
            // Accumulate timing
            if (publishResult.timing) {
              collectionsMs += publishResult.timing.collections.durationMs;
              fieldsMs += publishResult.timing.fields.durationMs;
              itemsMs += publishResult.timing.items.durationMs;
              valuesMs += publishResult.timing.values.durationMs;
            }
          }
          result.changes.collectionItems = totalItems;
        }
      } else if (isPublishingAll) {
        const allCollections = await getAllCollections({ is_published: false });

        for (const collection of allCollections) {
          const { items } = await getItemsByCollectionId(collection.id, false);
          if (items.length > 0) {
            const publishResult = await publishCollectionWithItems({
              collectionId: collection.id,
              itemIds: items.map((item: any) => item.id),
            });
            totalItems += publishResult.published?.itemsCount || 0;
            totalValues += publishResult.published?.valuesCount || 0;
            totalFields += publishResult.published?.fieldsCount || 0;
            if (publishResult.published?.collection) totalCollections++;
            // Accumulate timing
            if (publishResult.timing) {
              collectionsMs += publishResult.timing.collections.durationMs;
              fieldsMs += publishResult.timing.fields.durationMs;
              itemsMs += publishResult.timing.items.durationMs;
              valuesMs += publishResult.timing.values.durationMs;
            }
          }
        }
        result.changes.collectionItems = totalItems;
      }

      stats.tables.collections.durationMs = collectionsMs;
      stats.tables.collections.added = totalCollections;
      stats.tables.collection_fields.durationMs = fieldsMs;
      stats.tables.collection_fields.added = totalFields;
      stats.tables.collection_items.durationMs = itemsMs;
      stats.tables.collection_items.added = totalItems;
      stats.tables.collection_item_values.durationMs = valuesMs;
      stats.tables.collection_item_values.added = totalValues;
    }

    // Publish components
    {
      const stepStart = performance.now();
      if (componentIds && componentIds.length > 0) {
        const componentsResult = await publishComponents(componentIds);
        result.changes.components = componentsResult.count;
        stats.tables.components.added = componentsResult.count;
      } else if (isPublishingAll) {
        const unpublishedComponents = await getUnpublishedComponents();
        if (unpublishedComponents.length > 0) {
          const allComponentIds = unpublishedComponents.map((c: any) => c.id);
          const componentsResult = await publishComponents(allComponentIds);
          result.changes.components = componentsResult.count;
          stats.tables.components.added = componentsResult.count;
        }
      }
      stats.tables.components.durationMs = Math.round(performance.now() - stepStart);
    }

    // Publish layer styles
    {
      const stepStart = performance.now();
      if (layerStyleIds && layerStyleIds.length > 0) {
        const stylesResult = await publishLayerStyles(layerStyleIds);
        result.changes.layerStyles = stylesResult.count;
        stats.tables.layer_styles.added = stylesResult.count;
      } else if (isPublishingAll) {
        const unpublishedStyles = await getUnpublishedLayerStyles();
        if (unpublishedStyles.length > 0) {
          const allStyleIds = unpublishedStyles.map((s: any) => s.id);
          const stylesResult = await publishLayerStyles(allStyleIds);
          result.changes.layerStyles = stylesResult.count;
          stats.tables.layer_styles.added = stylesResult.count;
        }
      }
      stats.tables.layer_styles.durationMs = Math.round(performance.now() - stepStart);
    }

    // Only publish assets, asset folders, and localization when doing a full publish
    if (isPublishingAll) {
      // Asset folders
      {
        const stepStart = performance.now();
        try {
          const deleteFoldersResult = await hardDeleteSoftDeletedAssetFolders();
          result.changes.assetFoldersDeleted = deleteFoldersResult.count;
          stats.tables.asset_folders.deleted = deleteFoldersResult.count;
        } catch {
          // Silently handle - non-fatal
        }

        try {
          const unpublishedFolders = await getUnpublishedAssetFolders();
          if (unpublishedFolders.length > 0) {
            const allFolderIds = unpublishedFolders.map((f: any) => f.id);
            const foldersResult = await publishAssetFolders(allFolderIds);
            result.changes.assetFolders = foldersResult.count;
            stats.tables.asset_folders.added = foldersResult.count;
          }
        } catch {
          // Silently handle - non-fatal
        }
        stats.tables.asset_folders.durationMs = Math.round(performance.now() - stepStart);
      }

      // Assets
      {
        const stepStart = performance.now();
        try {
          const deleteResult = await hardDeleteSoftDeletedAssets();
          result.changes.assetsDeleted = deleteResult.count;
          stats.tables.assets.deleted = deleteResult.count;
        } catch {
          // Silently handle - non-fatal
        }

        try {
          const unpublishedAssets = await getUnpublishedAssets();
          if (unpublishedAssets.length > 0) {
            const allAssetIds = unpublishedAssets.map((a: any) => a.id);
            const assetsResult = await publishAssets(allAssetIds);
            result.changes.assets = assetsResult.count;
            stats.tables.assets.added = assetsResult.count;
          }
        } catch {
          // Silently handle - non-fatal
        }
        stats.tables.assets.durationMs = Math.round(performance.now() - stepStart);
      }

      // Locales and translations
      if (publishLocales) {
        try {
          const localisationResult = await publishLocalisation();
          result.changes.locales = localisationResult.locales;
          result.changes.translations = localisationResult.translations;
          stats.tables.locales.added = localisationResult.locales;
          stats.tables.locales.durationMs = localisationResult.timing.localesDurationMs;
          stats.tables.translations.added = localisationResult.translations;
          stats.tables.translations.durationMs = localisationResult.timing.translationsDurationMs;
        } catch {
          // Silently handle - non-fatal
        }
      }
    }

    // Copy draft CSS to published CSS
    {
      const stepStart = performance.now();
      try {
        result.changes.css = await publishCSS();
        stats.tables.css.added = result.changes.css ? 1 : 0;
      } catch {
        // Don't fail the entire publish if CSS fails
      }
      stats.tables.css.durationMs = Math.round(performance.now() - stepStart);
    }

    // Clear cache (not tracked in stats - infrastructure operation)
    try {
      await clearAllCache();
    } catch {
      // Silently handle - non-fatal
    }

    // Save published timestamp to settings
    try {
      result.published_at_setting = await savePublishedAt(publishedAt);
    } catch {
      // Silently handle - non-fatal
    }

    // Calculate total duration
    stats.totalDurationMs = Math.round(performance.now() - startTime);

    // Log stats once
    console.log('[Publish] Stats:', JSON.stringify(stats, null, 2));

    const totalPublished =
      result.changes.folders +
      result.changes.pages +
      result.changes.collectionItems +
      result.changes.components +
      result.changes.layerStyles +
      result.changes.assetFolders +
      result.changes.assets +
      result.changes.locales +
      result.changes.translations;

    return noCache({
      data: result,
      message: `Published a total of ${totalPublished} item(s) successfully`,
    });
  } catch (error) {
    stats.totalDurationMs = Math.round(performance.now() - startTime);
    console.log('[Publish] Failed. Stats:', JSON.stringify(stats, null, 2));

    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to publish' },
      500
    );
  }
}
