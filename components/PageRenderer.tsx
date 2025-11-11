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

