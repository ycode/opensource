import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import { fetchHomepage } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import { generatePageMetadata } from '@/lib/page-utils';
import type { Metadata } from 'next';

// Incremental Static Regeneration (ISR) with on-demand revalidation
export const revalidate = false;
export const dynamicParams = true;

/**
 * Fetch homepage data from database
 * Cached with tag-based revalidation (no time-based stale cache)
 */
async function fetchPublishedHomepage() {
  return unstable_cache(
    async () => fetchHomepage(true),
    ['data-for-route-/'],
    {
      tags: ['route-/'], // Tag for on-demand revalidation via revalidateTag()
      revalidate: 3600,
    }
  )();
}

export default async function Home() {
  // Fetch homepage data
  const data = await fetchPublishedHomepage();

  // If no published homepage exists, show default landing page
  if (!data || !data.pageLayers) {
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

  return generatePageMetadata(data.page, {
    fallbackTitle: 'Home',
  });
}
