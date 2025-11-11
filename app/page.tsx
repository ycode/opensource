import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import { fetchHomepage } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import type { Metadata } from 'next';

// Force dynamic rendering with on-demand revalidation
export const dynamic = 'force-static';
export const revalidate = 3600;
export const dynamicParams = true;

/**
 * Fetch homepage data from database with caching
 */
async function fetchPublishedHomepage() {
  return unstable_cache(
    async () => fetchHomepage(true),
    ['data-for-route-/'], // Cache key
    {
      tags: ['route-/'], // Tags for revalidation (empty slug = homepage)
      revalidate: 3600, // Cache for 1 hour
    }
  )();
}

export default async function Home() {
  // Fetch homepage data
  const data = await fetchPublishedHomepage();

  // If no homepage, show default landing page
  if (!data || !data.pageLayers.layers || data.pageLayers.layers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center p-8">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">
            YCode
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Your website is ready! Create pages in the builder.
          </p>
          <Link
            href="/ycode"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            Open Builder →
          </Link>
        </div>
      </div>
    );
  }

  // Load published CSS from settings
  const publishedCSS = await getSettingByKey('published_css');

  // Render homepage
  return (
    <PageRenderer
      page={data.page}
      layers={data.pageLayers.layers || []}
      components={[]}
      generatedCss={publishedCSS}
    />
  );
}

// Generate metadata
export async function generateMetadata(): Promise<Metadata> {
  const data = await fetchPublishedHomepage();

  if (!data) {
    return {
      title: 'YCode',
      description: 'Built with YCode',
    };
  }

  return {
    title: data.page.name || 'Home',
    description: `${data.page.name} - Built with YCode`,
  };
}
