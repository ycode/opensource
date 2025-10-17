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
import { pagesApi, pageVersionsApi } from '@/lib/api';
import LayerRenderer from '@/components/layers/LayerRenderer';
import type { Page, PageVersion } from '@/types';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [homepage, setHomepage] = useState<{ page: Page; version: PageVersion } | null>(null);

  useEffect(() => {
    async function checkSetup() {
      try {
        const status = await checkSetupStatus();

        if (! status.is_configured) {
          // Not configured yet - redirect to welcome wizard
          router.push('/welcome');
          return;
        }

        // Try to load homepage (slug: "home" or "index")
        let pageResponse = await pagesApi.getBySlug('home');
        
        if (pageResponse.error || !pageResponse.data) {
          // Try "index" as fallback
          pageResponse = await pagesApi.getBySlug('index');
        }

        if (pageResponse.data && pageResponse.data.published_version_id) {
          // Fetch published version
          const versionResponse = await pageVersionsApi.getPublished(pageResponse.data.id);
          
          if (versionResponse.data) {
            setHomepage({
              page: pageResponse.data,
              version: versionResponse.data,
            });
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Failed to check setup status:', error);
        // Assume not configured if check fails
        router.push('/welcome');
      }
    }

    checkSetup();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Render homepage if it exists
  if (homepage && homepage.version.layers && homepage.version.layers.length > 0) {
    return (
      <div className="min-h-screen bg-white">
        <LayerRenderer 
          layers={homepage.version.layers} 
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
