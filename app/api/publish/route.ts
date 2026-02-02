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
import { Setting } from '@/types';

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
  },
  published_at_setting: Setting;
}

/**
 * POST /api/publish
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
    };

    // Determine if we're publishing all or specific items
    const isPublishingAll = publishAll && !folderIds && !pageIds && !collectionIds && !collectionItemIds && !componentIds && !layerStyleIds;

    // Publish folders first (pages depend on them)
    // Pass pageIds to collect ancestor folders automatically
    const foldersResult = await publishFolders(
      isPublishingAll ? [] : (folderIds || []),
      pageIds
    );
    result.changes.folders = foldersResult.count;

    // Publish pages
    if (pageIds && pageIds.length > 0) {
      // Publish specific pages
      const pagesResult = await publishPages(pageIds);
      result.changes.pages = pagesResult.count;
    } else if (isPublishingAll) {
      // Publish all unpublished pages
      const unpublishedPages = await getAllDraftPages();
      if (unpublishedPages.length > 0) {
        const allPageIds = unpublishedPages.map(p => p.id);
        const pagesResult = await publishPages(allPageIds);
        result.changes.pages = pagesResult.count;
      }
    }

    // Publish collections with items
    if ((collectionIds && collectionIds.length > 0) || (collectionItemIds && collectionItemIds.length > 0)) {
      const collectionPublishes: Array<{ collectionId: string; itemIds: string[] }> = [];

      // Handle specific collection IDs (publish all items in these collections)
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

      // Handle specific collection item IDs (group by collection)
      if (collectionItemIds && collectionItemIds.length > 0) {
        const itemsByCollection = await groupItemsByCollection(collectionItemIds);

        // Add to collectionPublishes
        itemsByCollection.forEach((itemIds, collectionId) => {
          // Check if this collection already exists in collectionPublishes
          const existing = collectionPublishes.find(cp => cp.collectionId === collectionId);
          if (existing) {
            // Merge item IDs (avoid duplicates)
            const combined = new Set([...existing.itemIds, ...itemIds]);
            existing.itemIds = Array.from(combined);
          } else {
            collectionPublishes.push({ collectionId, itemIds });
          }
        });
      }

      // Publish all grouped collections
      if (collectionPublishes.length > 0) {
        for (const collectionPublish of collectionPublishes) {
          const publishResult = await publishCollectionWithItems({
            collectionId: collectionPublish.collectionId,
            itemIds: collectionPublish.itemIds,
          });
          result.changes.collectionItems += publishResult.published?.itemsCount || 0;
        }
      }
    } else if (isPublishingAll) {
      // Publish all unpublished collection items
      const allCollections = await getAllCollections({ is_published: false });

      for (const collection of allCollections) {
        const { items } = await getItemsByCollectionId(collection.id, false);
        if (items.length > 0) {
          const publishResult = await publishCollectionWithItems({
            collectionId: collection.id,
            itemIds: items.map((item: any) => item.id),
          });
          result.changes.collectionItems += publishResult.published?.itemsCount || 0;
        }
      }
    }

    // Publish components
    if (componentIds && componentIds.length > 0) {
      // Publish specific components
      const componentsResult = await publishComponents(componentIds);
      result.changes.components = componentsResult.count;
    } else if (isPublishingAll) {
      // Publish all unpublished components
      const unpublishedComponents = await getUnpublishedComponents();
      if (unpublishedComponents.length > 0) {
        const allComponentIds = unpublishedComponents.map((c: any) => c.id);
        const componentsResult = await publishComponents(allComponentIds);
        result.changes.components = componentsResult.count;
      }
    }

    // Publish layer styles
    if (layerStyleIds && layerStyleIds.length > 0) {
      // Publish specific layer styles
      const stylesResult = await publishLayerStyles(layerStyleIds);
      result.changes.layerStyles = stylesResult.count;
    } else if (isPublishingAll) {
      // Publish all unpublished layer styles
      const unpublishedStyles = await getUnpublishedLayerStyles();
      if (unpublishedStyles.length > 0) {
        const allStyleIds = unpublishedStyles.map((s: any) => s.id);
        const stylesResult = await publishLayerStyles(allStyleIds);
        result.changes.layerStyles = stylesResult.count;
      }
    }

    // Always publish asset folders first (assets reference them via foreign key)
    // First, hard delete asset folders that were soft-deleted in drafts
    try {
      const deleteFoldersResult = await hardDeleteSoftDeletedAssetFolders();
      result.changes.assetFoldersDeleted = deleteFoldersResult.count;
    } catch (assetFoldersDeleteError) {
      console.error('Failed to delete soft-deleted asset folders:', assetFoldersDeleteError);
      // Don't fail the entire publish if folder deletion fails
    }

    // Then publish all unpublished asset folders
    try {
      const unpublishedFolders = await getUnpublishedAssetFolders();
      if (unpublishedFolders.length > 0) {
        const allFolderIds = unpublishedFolders.map((f: any) => f.id);
        const foldersResult = await publishAssetFolders(allFolderIds);
        result.changes.assetFolders = foldersResult.count;
      }
    } catch (assetFoldersPublishError) {
      console.error('Failed to publish asset folders:', assetFoldersPublishError);
      // Don't fail the entire publish if folder publishing fails
    }

    // Now publish assets (after folders are published)
    // First, hard delete assets that were soft-deleted in drafts
    try {
      const deleteResult = await hardDeleteSoftDeletedAssets();
      result.changes.assetsDeleted = deleteResult.count;
    } catch (assetsDeleteError) {
      console.error('Failed to delete soft-deleted assets:', assetsDeleteError);
      // Don't fail the entire publish if asset deletion fails
    }

    // Then publish all unpublished assets
    try {
      const unpublishedAssets = await getUnpublishedAssets();
      if (unpublishedAssets.length > 0) {
        const allAssetIds = unpublishedAssets.map((a: any) => a.id);
        const assetsResult = await publishAssets(allAssetIds);
        result.changes.assets = assetsResult.count;
      }
    } catch (assetsPublishError) {
      console.error('Failed to publish assets:', assetsPublishError);
      // Don't fail the entire publish if asset publishing fails
    }

    // Publish locales and translations
    if (publishLocales) {
      try {
        const localisationResult = await publishLocalisation();
        result.changes.locales = localisationResult.locales;
        result.changes.translations = localisationResult.translations;
      } catch (localesError) {
        console.error('Failed to publish locales/translations:', localesError);
        // Don't fail the entire publish if localization fails
      }
    }

    // Copy draft CSS to published CSS
    try {
      result.changes.css = await publishCSS();
    } catch (cssError) {
      console.error('Failed to publish CSS:', cssError);
      // Don't fail the entire publish if CSS fails
    }

    // Clear cache
    try {
      await clearAllCache();
    } catch (cacheError) {
      console.error('Failed to clear cache:', cacheError);
    }

    // Save published timestamp to settings
    try {
      result.published_at_setting = await savePublishedAt(publishedAt);
    } catch (settingsError) {
      console.error('Failed to save published_at timestamp:', settingsError);
    }

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
    console.error('Failed to publish:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to publish' },
      500
    );
  }
}
