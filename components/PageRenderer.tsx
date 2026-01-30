import AnimationInitializer from '@/components/AnimationInitializer';
import ContentHeightReporter from '@/components/ContentHeightReporter';
import LayerRenderer from '@/components/LayerRenderer';
import { resolveComponents } from '@/lib/resolve-components';
import { resolveCustomCodePlaceholders } from '@/lib/resolve-cms-variables';
import { generateInitialAnimationCSS, type HiddenLayerInfo } from '@/lib/animation-utils';
import { getAllPages } from '@/lib/repositories/pageRepository';
import { getAllPageFolders } from '@/lib/repositories/pageFolderRepository';
import { getItemWithValues } from '@/lib/repositories/collectionItemRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';
import type { Layer, Component, Page, CollectionItemWithValues, CollectionField, Locale, PageFolder } from '@/types';

interface PageRendererProps {
  page: Page;
  layers: Layer[];
  components: Component[];
  generatedCss?: string;
  collectionItem?: CollectionItemWithValues;
  collectionFields?: CollectionField[];
  locale?: Locale | null;
  availableLocales?: Locale[];
  isPreview?: boolean; // Whether we're in preview mode (use draft data)
  translations?: Record<string, any> | null; // Translations for localized URL generation
}

/**
 * Shared component for rendering published/preview pages
 * Handles layer resolution, CSS injection, and custom code injection
 *
 * Note: This is a Server Component. Script/style tags are automatically
 * hoisted to <head> by Next.js during SSR, eliminating FOUC.
 */
function normalizeRootLayers(layerTree: Layer[]): Layer[] {
  if (!layerTree || layerTree.length === 0) {
    return layerTree;
  }

  const [firstLayer, ...rest] = layerTree;

  if (firstLayer?.id !== 'body') {
    return layerTree;
  }

  return [
    {
      ...firstLayer,
      name: 'div',
      settings: {
        ...firstLayer.settings,
        tag: 'div',
      },
    },
    ...rest,
  ];
}

export default async function PageRenderer({
  page,
  layers,
  components,
  generatedCss,
  collectionItem,
  collectionFields = [],
  locale,
  availableLocales = [],
  isPreview = false,
  translations,
}: PageRendererProps) {
  // Resolve component instances in the layer tree before rendering
  // If components array is empty, they're already resolved server-side
  const resolvedLayers = components.length > 0
    ? resolveComponents(layers || [], components)
    : layers || [];

  // Scan layers for collection_item_ids referenced in link settings
  // Excludes special keywords like 'current-page' and 'current-collection' which are resolved at runtime
  const findCollectionItemIds = (layers: Layer[]): Set<string> => {
    const itemIds = new Set<string>();
    const specialKeywords = ['current-page', 'current-collection'];
    const scan = (layer: Layer) => {
      const itemId = layer.variables?.link?.page?.collection_item_id;
      if (layer.variables?.link?.type === 'page' && itemId && !specialKeywords.includes(itemId)) {
        itemIds.add(itemId);
      }
      if (layer.children) {
        layer.children.forEach(scan);
      }
    };
    layers.forEach(scan);
    return itemIds;
  };

  // Extract collection item slugs from resolved collection layers
  // These are populated by resolveCollectionLayers with `_collectionItemId` and `_collectionItemSlug`
  const extractCollectionItemSlugs = (layers: Layer[]): Record<string, string> => {
    const slugs: Record<string, string> = {};
    const scan = (layer: Layer) => {
      // Check for SSR-resolved collection item with ID and slug
      const itemId = layer._collectionItemId;
      const itemSlug = layer._collectionItemSlug;
      if (itemId && itemSlug) {
        slugs[itemId] = itemSlug;
      }
      if (layer.children) {
        layer.children.forEach(scan);
      }
    };
    layers.forEach(scan);
    return slugs;
  };

  const referencedItemIds = findCollectionItemIds(resolvedLayers);

  // Build collection item slugs map
  const collectionItemSlugs: Record<string, string> = {};

  // Add slugs from resolved collection layers (for 'current-collection' links)
  const resolvedSlugs = extractCollectionItemSlugs(resolvedLayers);
  Object.assign(collectionItemSlugs, resolvedSlugs);

  // Add current page's collection item if available
  if (collectionItem && collectionFields) {
    const slugField = collectionFields.find(f => f.key === 'slug');
    if (slugField && collectionItem.values[slugField.id]) {
      collectionItemSlugs[collectionItem.id] = collectionItem.values[slugField.id];
    }
  }

  // Fetch pages and folders for link resolution using repository functions
  // These are needed to resolve page links to their URLs
  let pages: Page[] = [];
  let folders: PageFolder[] = [];

  try {
    // Use repository functions which work reliably
    [pages, folders] = await Promise.all([
      getAllPages(),
      getAllPageFolders(),
    ]);

    // Fetch collection items if we have references to them
    if (referencedItemIds.size > 0) {
      // Fetch items using repository function which handles EAV properly
      const itemsWithValues = await Promise.all(
        Array.from(referencedItemIds).map(itemId => getItemWithValues(itemId, false))
      );

      // For each item, find its collection's slug field and extract the slug
      for (const item of itemsWithValues) {
        if (!item) continue;

        // Get the slug field for this item's collection
        const fields = await getFieldsByCollectionId(item.collection_id, false);
        const slugField = fields.find(f => f.key === 'slug');

        if (slugField && item.values[slugField.id]) {
          collectionItemSlugs[item.id] = item.values[slugField.id];
        }
      }
    }
  } catch (error) {
    console.error('[PageRenderer] Error fetching link resolution data:', error);
  }

  // Extract custom code from page settings and resolve placeholders for dynamic pages
  const rawCustomCodeHead = page.settings?.custom_code?.head || '';
  const rawCustomCodeBody = page.settings?.custom_code?.body || '';

  const customCodeHead = page.is_dynamic && collectionItem
    ? resolveCustomCodePlaceholders(rawCustomCodeHead, collectionItem, collectionFields)
    : rawCustomCodeHead;

  const customCodeBody = page.is_dynamic && collectionItem
    ? resolveCustomCodePlaceholders(rawCustomCodeBody, collectionItem, collectionFields)
    : rawCustomCodeBody;

  const normalizedLayers = normalizeRootLayers(resolvedLayers);
  const hasLayers = normalizedLayers.length > 0;

  // Generate CSS for initial animation states to prevent flickering
  const { css: initialAnimationCSS, hiddenLayerInfo } = generateInitialAnimationCSS(resolvedLayers);

  // Pre-resolve all asset URLs for SSR (images, videos, audio, icons, and field values)
  // This prevents client-side fetching delays and ensures links/media work immediately
  const collectAssetIds = (layers: Layer[]): Set<string> => {
    const assetIds = new Set<string>();

    const isAssetVar = (v: any): v is { type: 'asset'; data: { asset_id: string } } =>
      v && v.type === 'asset' && v.data?.asset_id;

    const isUuid = (v: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

    // Scan rich text content for asset links in richTextLink marks
    const scanRichTextForAssets = (content: any) => {
      if (!content || typeof content !== 'object') return;

      // Check marks for richTextLink with asset
      if (Array.isArray(content.marks)) {
        for (const mark of content.marks) {
          if (mark.type === 'richTextLink' && mark.attrs?.asset?.id) {
            assetIds.add(mark.attrs.asset.id);
          }
        }
      }

      // Recurse into content arrays
      if (Array.isArray(content.content)) {
        for (const child of content.content) {
          scanRichTextForAssets(child);
        }
      }
      if (Array.isArray(content)) {
        for (const child of content) {
          scanRichTextForAssets(child);
        }
      }
    };

    const scan = (layer: Layer) => {
      // Image source
      if (isAssetVar(layer.variables?.image?.src)) {
        assetIds.add(layer.variables.image.src.data.asset_id);
      }
      // Video source and poster
      if (isAssetVar(layer.variables?.video?.src)) {
        assetIds.add(layer.variables.video.src.data.asset_id);
      }
      if (isAssetVar(layer.variables?.video?.poster)) {
        assetIds.add(layer.variables.video.poster.data.asset_id);
      }
      // Audio source
      if (isAssetVar(layer.variables?.audio?.src)) {
        assetIds.add(layer.variables.audio.src.data.asset_id);
      }
      // Icon source
      if (isAssetVar(layer.variables?.icon?.src)) {
        assetIds.add(layer.variables.icon.src.data.asset_id);
      }

      // Direct asset link (type = 'asset')
      const linkAssetId = layer.variables?.link?.asset?.id;
      if (linkAssetId) {
        assetIds.add(linkAssetId);
      }

      // Rich text links with asset type
      const textVar = layer.variables?.text;
      if (textVar && textVar.type === 'dynamic_rich_text' && (textVar as any).data?.content) {
        scanRichTextForAssets((textVar as any).data.content);
      }

      // Collection item values on resolved collection layers
      if (layer._collectionItemValues) {
        for (const value of Object.values(layer._collectionItemValues)) {
          if (typeof value === 'string' && isUuid(value)) {
            assetIds.add(value);
          }
        }
      }

      if (layer.children) {
        layer.children.forEach(scan);
      }
    };

    layers.forEach(scan);
    return assetIds;
  };

  // Collect asset IDs from layers
  const layerAssetIds = collectAssetIds(resolvedLayers);

  // Also collect from page collection item values (for dynamic pages)
  if (collectionItem) {
    for (const value of Object.values(collectionItem.values)) {
      if (typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        layerAssetIds.add(value);
      }
    }
  }

  // Fetch all assets and build resolved map
  let resolvedAssets: Record<string, string> | undefined;
  if (layerAssetIds.size > 0) {
    try {
      const { getAssetsByIds } = await import('@/lib/repositories/assetRepository');
      const assetMap = await getAssetsByIds(Array.from(layerAssetIds));
      resolvedAssets = {};
      for (const [id, asset] of Object.entries(assetMap)) {
        if (asset.public_url) {
          resolvedAssets[id] = asset.public_url;
        }
      }
    } catch (error) {
      console.error('[PageRenderer] Error fetching assets:', error);
    }
  }

  return (
    <>
      {/* Inject CSS directly - Next.js hoists this to <head> during SSR */}
      {generatedCss && (
        <style
          id="ycode-styles"
          dangerouslySetInnerHTML={{ __html: generatedCss }}
        />
      )}

      {/* Inject initial animation styles to prevent flickering */}
      {initialAnimationCSS && (
        <style
          id="ycode-gsap-initial-styles"
          dangerouslySetInnerHTML={{ __html: initialAnimationCSS }}
        />
      )}

      {/* Inject custom head code - Next.js hoists scripts/styles to <head> */}
      {customCodeHead && (
        <div dangerouslySetInnerHTML={{ __html: customCodeHead }} />
      )}

      <div
        id="ybody"
        className="min-h-screen bg-white"
        data-layer-id="body"
        data-layer-type="div"
        data-is-empty={hasLayers ? 'false' : 'true'}
      >
        <LayerRenderer
          layers={normalizedLayers}
          isEditMode={false}
          isPublished={page.is_published}
          pageCollectionItemId={collectionItem?.id}
          pageCollectionItemData={collectionItem?.values || undefined}
          hiddenLayerInfo={hiddenLayerInfo}
          currentLocale={locale}
          availableLocales={availableLocales}
          pages={pages as any}
          folders={folders as any}
          collectionItemSlugs={collectionItemSlugs}
          isPreview={isPreview}
          translations={translations}
          resolvedAssets={resolvedAssets}
        />
      </div>

      {/* Initialize GSAP animations based on layer interactions */}
      <AnimationInitializer layers={resolvedLayers} />

      {/* Report content height to parent for zoom calculations (preview only) */}
      {!page.is_published && <ContentHeightReporter />}

      {/* Inject custom body code before closing body tag */}
      {customCodeBody && (
        <div dangerouslySetInnerHTML={{ __html: customCodeBody }} />
      )}
    </>
  );
}
