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
        {/* Debug: Show if no layers */}
        {resolvedLayers.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-red-500">No layers to render</p>
          </div>
        )}

        {/* Debug: Show if body is empty */}
        {resolvedLayers.length > 0 && resolvedLayers[0].id === 'body' && (!resolvedLayers[0].children || resolvedLayers[0].children.length === 0) && (
          <div className="p-8 text-center border-4 border-blue-500">
            <p className="text-blue-500 font-bold">PageRenderer is working!</p>
            <p className="text-gray-600">Body layer exists but has no children</p>
            <p className="text-sm text-gray-500 mt-2">Add content in the editor to see it here</p>
          </div>
        )}

        <LayerRenderer
          layers={resolvedLayers}
          isEditMode={false}
          isPublished={page.is_published}
        />
      </div>
    </>
  );
}

