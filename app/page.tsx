import { unstable_cache, unstable_noStore } from 'next/cache';
import Link from 'next/link';
import { fetchHomepage, PaginationContext } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import { generatePageMetadata, fetchGlobalPageSettings } from '@/lib/generate-page-metadata';
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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center p-8 flex flex-col items-center justify-center gap-2">
          <h1 className="text-xl font-semibold text-neutral-900">
            Welcome to Ycode
          </h1>
          <Link
            href="/ycode"
            className=" bg-blue-500 text-white text-sm font-medium h-8 flex items-center justify-center px-3 rounded-lg transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>
    );
  }

  // Load all global settings in a single query
  const globalSettings = await fetchGlobalPageSettings();

  // Render homepage
  return (
    <PageRenderer
      page={data.page}
      layers={data.pageLayers.layers || []}
      components={[]}
      generatedCss={globalSettings.publishedCss || undefined}
      locale={data.locale}
      availableLocales={data.availableLocales}
      translations={data.translations}
      gaMeasurementId={globalSettings.gaMeasurementId}
      globalCustomCodeHead={globalSettings.globalCustomCodeHead}
      globalCustomCodeBody={globalSettings.globalCustomCodeBody}
      ycodeBadge={globalSettings.ycodeBadge}
    />
  );
}

// Generate metadata
export async function generateMetadata(): Promise<Metadata> {
  // Fetch page and global settings in parallel
  const [data, globalSettings] = await Promise.all([
    fetchPublishedHomepage(),
    fetchGlobalPageSettings(),
  ]);

  if (!data) {
    return {
      title: 'YCode',
      description: 'Built with YCode',
    };
  }

  return generatePageMetadata(data.page, {
    fallbackTitle: 'Home',
    pagePath: '/',
    globalSeoSettings: globalSettings,
  });
}
