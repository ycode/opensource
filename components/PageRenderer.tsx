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
 * Handles layer resolution and CSS injection
 *
 * Note: This is a Server Component. The <style> tag is automatically
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

  return (
    <>
      {/* Inject CSS directly - Next.js hoists this to <head> during SSR */}
      {generatedCss && (
        <style
          id="ycode-styles"
          dangerouslySetInnerHTML={{ __html: generatedCss }}
        />
      )}

      <div className="min-h-screen bg-white">
        <LayerRenderer
          layers={resolvedLayers}
          isEditMode={false}
          isPublished={page.is_published}
        />
      </div>
    </>
  );
}

