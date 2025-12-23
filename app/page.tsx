import { unstable_cache, unstable_noStore } from 'next/cache';
import Link from 'next/link';
import { fetchHomepage, PaginationContext } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import { generatePageMetadata } from '@/lib/generate-page-metadata';
import type { Metadata } from 'next';

// Static by default for performance, dynamic only when pagination is requested
export const revalidate = 3600; // Revalidate every hour

/**
 * Fetch homepage data from database
 * Cached with tag-based revalidation (no time-based stale cache)
 */
async function fetchPublishedHomepage(paginationContext?: PaginationContext) {
  // Include pagination params in cache key for per-collection pagination support
  // Sort keys for consistent cache key regardless of param order
  const paginationKey = paginationContext?.pageNumbers 
    ? Object.entries(paginationContext.pageNumbers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, page]) => `${id}:${page}`)
      .join(',')
    : '';
  return unstable_cache(
    async () => fetchHomepage(true, paginationContext),
    ['data-for-route-/', `pagination-${paginationKey}`],
    {
      tags: ['route-/'], // Tag for on-demand revalidation via revalidateTag()
      revalidate: 3600,
    }
  )();
}

interface HomeProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Home({ searchParams }: HomeProps) {
  // Await searchParams (Next.js 15 requirement)
  const resolvedSearchParams = await searchParams;
  
  // Parse layer-specific pagination params (p_LAYER_ID=N)
  // This enables independent pagination for multiple collections on the same page
  const pageNumbers: Record<string, number> = {};
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (key.startsWith('p_') && typeof value === 'string') {
      const layerId = key.slice(2); // Remove 'p_' prefix
      const pageNum = parseInt(value, 10);
      if (!isNaN(pageNum) && pageNum >= 1) {
        pageNumbers[layerId] = pageNum;
      }
    }
  }
  
  // Only opt out of caching when pagination is requested
  // This keeps default page visits fast and cached
  if (Object.keys(pageNumbers).length > 0) {
    unstable_noStore();
  }
  
  const paginationContext: PaginationContext = {
    pageNumbers,
    defaultPage: 1,
  };

  // Fetch homepage data with pagination context
  const data = await fetchPublishedHomepage(paginationContext);

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
