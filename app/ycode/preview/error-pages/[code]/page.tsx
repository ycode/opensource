import LayerRenderer from '@/components/layers/LayerRenderer';
import { fetchErrorPage } from '@/lib/page-fetcher';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import { generatePageMetadata } from '@/lib/page-utils';
import type { Metadata } from 'next';

interface ErrorPagePreviewProps {
  params: Promise<{ code: string }>;
}

/**
 * Preview route for error pages
 * Accessible at /ycode/preview/error-pages/404, /ycode/preview/error-pages/500, etc.
 */
export default async function ErrorPagePreview({ params }: ErrorPagePreviewProps) {
  const { code } = await params;
  const errorCode = parseInt(code, 10);

  // Fetch the error page (draft version for preview)
  const pageData = await fetchErrorPage(errorCode, false);

  if (!pageData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center max-w-md px-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Invalid error page
          </h1>
          <p className="text-gray-600 mb-6">
            The {errorCode} error page cannot be customized.
          </p>
        </div>
      </div>
    );
  }

  // Get the draft CSS
  const generatedCss = await getSettingByKey('draft_css');

  return (
    <>
      {generatedCss && (
        <style
          id="ycode-styles"
          dangerouslySetInnerHTML={{ __html: generatedCss }}
        />
      )}

      <div className="min-h-screen bg-white">
        <LayerRenderer
          layers={pageData.pageLayers.layers || []}
          isEditMode={false}
          isPublished={false}
        />
      </div>
    </>
  );
}

// Generate metadata
export async function generateMetadata({ params }: ErrorPagePreviewProps): Promise<Metadata> {
  const { code } = await params;
  const errorCode = parseInt(code, 10);

  // Fetch error page to get SEO settings
  const pageData = await fetchErrorPage(errorCode, false);

  if (!pageData) {
    return {
      title: `[Preview] ${errorCode} error page`,
      description: `Preview of ${errorCode} error page`,
    };
  }

  return generatePageMetadata(pageData.page, {
    isPreview: true,
  });
}

