'use client';

/**
 * Homepage
 *
 * Checks setup status and redirects to welcome wizard if not configured
 * Otherwise renders the published homepage from database
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkSetupStatus } from '@/lib/api/setup';
import { pagesApi, pageLayersApi } from '@/lib/api';
import { findHomepage } from '@/lib/page-utils';
import LayerRenderer from '@/components/layers/LayerRenderer';
import type { Page, PageLayers } from '@/types';

export default function Home() {
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [homepage, setHomepage] = useState<{ page: Page; pageLayers: PageLayers } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function checkSetup() {
      try {
        const status = await checkSetupStatus();

        if (! status.is_configured) {
          // Not configured yet - redirect to welcome wizard
          setIsRedirecting(true);
          router.push('/welcome');
          return;
        }

        // Get all published pages and find the homepage
        const pagesResponse = await pagesApi.getAllPublished();

        if (pagesResponse.data) {
          const homepagePage = findHomepage(pagesResponse.data);

          if (homepagePage) {
            // Fetch published layers
            const pageLayersResponse = await pageLayersApi.getPublished(homepagePage.id);

            if (pageLayersResponse.data) {
              setHomepage({
                page: homepagePage,
                pageLayers: pageLayersResponse.data,
              });
            }
          }
        }

        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to check setup status:', error);
        // Assume not configured if check fails
        setIsRedirecting(true);
        router.push('/welcome');
      }
    }

    checkSetup();
  }, [router]);

  // Only show loading spinner if we're redirecting to setup
  if (isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Redirecting to setup...</p>
        </div>
      </div>
    );
  }

  // Don't render anything until loaded (prevents flash)
  if (!isLoaded) {
    return null;
  }

  // Render homepage if it exists
  if (homepage && homepage.pageLayers.layers && homepage.pageLayers.layers.length > 0) {
    return (
      <div className="min-h-screen bg-white">
        <LayerRenderer
          layers={homepage.pageLayers.layers}
          isEditMode={false}
        />
      </div>
    );
  }

  // Default landing page if no homepage
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center p-8">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">
          YCode
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Your website is ready! Create pages in the builder.
        </p>
        <a
          href="/ycode"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
        >
          Open Builder →
        </a>
      </div>
    </div>
  );
}
