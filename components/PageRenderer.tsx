import LayerRenderer from '@/components/layers/LayerRenderer';
import PageHead from '@/components/PageHead';
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
      {/* Inject minified CSS into <head> if available */}
      {generatedCss && <PageHead css={generatedCss} />}

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

