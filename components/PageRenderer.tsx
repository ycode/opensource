import AnimationInitializer from '@/components/AnimationInitializer';
import ContentHeightReporter from '@/components/ContentHeightReporter';
import LayerRenderer from '@/components/layers/LayerRenderer';
import { resolveComponents } from '@/lib/resolve-components';
import { resolveCustomCodePlaceholders } from '@/lib/resolve-cms-variables';
import { generateInitialAnimationCSS } from '@/lib/animation-utils';
import type { Layer, Component, Page, CollectionItemWithValues, CollectionField } from '@/types';

interface PageRendererProps {
  page: Page;
  layers: Layer[];
  components: Component[];
  generatedCss?: string;
  collectionItem?: CollectionItemWithValues;
  collectionFields?: CollectionField[];
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

export default function PageRenderer({
  page,
  layers,
  components,
  generatedCss,
  collectionItem,
  collectionFields = [],
}: PageRendererProps) {
  // Resolve component instances in the layer tree before rendering
  const resolvedLayers = resolveComponents(layers || [], components);

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
  const { css: initialAnimationCSS, hiddenLayerIds } = generateInitialAnimationCSS(resolvedLayers);

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
          pageCollectionItemData={collectionItem?.values || undefined}
          hiddenLayerIds={hiddenLayerIds}
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
