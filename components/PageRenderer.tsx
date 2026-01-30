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
          fieldsByFieldId={
            collectionFields.length > 0
              ? Object.fromEntries(collectionFields.map((f) => [f.id, { type: f.type }]))
              : undefined
          }
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
