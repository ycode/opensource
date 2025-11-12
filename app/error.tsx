'use client';

import { useEffect, useState } from 'react';
import LayerRenderer from '@/components/layers/LayerRenderer';
import type { PageData } from '@/lib/page-fetcher';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root error boundary for published pages
 * Shows custom 500 error page if available
 */
export default function Error({ error, reset }: ErrorProps) {
  const [errorPageData, setErrorPageData] = useState<PageData | null>(null);
  const [generatedCss, setGeneratedCss] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Log the error
    console.error('Published page error:', error);

    // Fetch custom 500 error page
    async function fetchErrorPage() {
      try {
        const response = await fetch('/api/error-page?code=500&published=true');
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
            layers={errorPageData.pageLayers.layers || []}
            isEditMode={false}
            isPublished={true}
          />
        </div>
      </>
    );
  }

  // Fallback to default error page
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center max-w-md px-4">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">500</h1>
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Server Error</h2>
        <p className="text-gray-600 mb-8">
          Something went wrong on our end. Please try again later.
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

