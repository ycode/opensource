'use client';

import { useEffect, useState } from 'react';
import LayerRenderer from '@/components/layers/LayerRenderer';
import type { PageData } from '@/lib/page-fetcher';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error boundary for preview pages
 * Shows custom 500 error page (draft version) if available
 */
export default function Error({ error, reset }: ErrorProps) {
  const [errorPageData, setErrorPageData] = useState<PageData | null>(null);
  const [generatedCss, setGeneratedCss] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Log the error
    console.error('Preview page error:', error);

    // Fetch custom 500 error page (draft version)
    async function fetchErrorPage() {
      try {
        const response = await fetch('/api/error-page?code=500&published=false');
        if (response.ok) {
          const data = await response.json();
          setErrorPageData(data.pageData);
          setGeneratedCss(data.css || '');
        }
      } catch (err) {
        console.error('Failed to fetch custom 500 page:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchErrorPage();
  }, [error]);

  if (isLoading) return null;

  // If custom error page exists, render it
  if (errorPageData) {
    const customCodeHead = errorPageData.page.settings?.custom_code?.head || '';
    const customCodeBody = errorPageData.page.settings?.custom_code?.body || '';

    return (
      <>
        {generatedCss && (
          <style
            id="ycode-styles"
            dangerouslySetInnerHTML={{ __html: generatedCss }}
          />
        )}
        {customCodeHead && (
          <div dangerouslySetInnerHTML={{ __html: customCodeHead }} />
        )}
        <div className="min-h-screen bg-white">
          <LayerRenderer
            layers={errorPageData.pageLayers.layers || []}
            isEditMode={false}
            isPublished={false}
            pageCollectionItemData={errorPageData.collectionItem?.values || undefined}
          />
        </div>
        {customCodeBody && (
          <div dangerouslySetInnerHTML={{ __html: customCodeBody }} />
        )}
      </>
    );
  }

  // Fallback to default error page
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center max-w-md px-4">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">500</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Preview Error</h2>
        <p className="text-gray-600 mb-8">
          An error occurred while rendering the preview. Please check your page configuration.
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
