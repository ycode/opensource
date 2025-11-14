import LayerRenderer from '@/components/layers/LayerRenderer';
import { resolveComponents } from '@/lib/resolve-components';
import type { Layer, Component, Page } from '@/types';

interface PageRendererProps {
  page: Page;
  layers: Layer[];
  components: Component[];
  generatedCss?: string;
}

/**
 * Shared component for rendering published/preview pages
 * Handles layer resolution, CSS injection, and custom code injection
 *
 * Note: This is a Server Component. Script/style tags are automatically
 * hoisted to <head> by Next.js during SSR, eliminating FOUC.
 */
export default function PageRenderer({
  page,
  layers,
  components,
  generatedCss,
}: PageRendererProps) {
  // Resolve component instances in the layer tree before rendering
  const resolvedLayers = resolveComponents(layers || [], components);

  // Extract custom code from page settings
  const customCodeHead = page.settings?.custom_code?.head || '';
  const customCodeBody = page.settings?.custom_code?.body || '';

  return (
    <>
      {/* Inject CSS directly - Next.js hoists this to <head> during SSR */}
      {generatedCss && (
        <style
          id="ycode-styles"
          dangerouslySetInnerHTML={{ __html: generatedCss }}
        />
      )}

      {/* Inject custom head code - Next.js hoists scripts/styles to <head> */}
      {customCodeHead && (
        <div dangerouslySetInnerHTML={{ __html: customCodeHead }} />
      )}

      <div className="min-h-screen bg-white">
        <LayerRenderer
          layers={resolvedLayers}
          isEditMode={false}
          isPublished={page.is_published}
        />
      </div>

      {/* Inject custom body code before closing body tag */}
      {customCodeBody && (
        <div dangerouslySetInnerHTML={{ __html: customCodeBody }} />
      )}
    </>
  );
}

