import { unstable_cache, unstable_noStore } from 'next/cache';
import Link from 'next/link';
import { fetchHomepage, fetchErrorPage, PaginationContext } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import PasswordForm from '@/components/PasswordForm';
import { generatePageMetadata, fetchGlobalPageSettings } from '@/lib/generate-page-metadata';
import { parseAuthCookie, getPasswordProtection, fetchFoldersForAuth } from '@/lib/page-auth';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
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

  try {
    return await unstable_cache(
      async () => fetchHomepage(true, paginationContext),
      ['data-for-route-/', `pagination-${paginationKey}`],
      {
        tags: ['route-/'], // Tag for on-demand revalidation via revalidateTag()
        revalidate: 3600,
      }
    )();
  } catch {
    // Fallback to uncached fetch when data exceeds cache size limit (2MB)
    return fetchHomepage(true, paginationContext);
  }
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

  // Check password protection for homepage
  const folders = await fetchFoldersForAuth(true);
  const authCookie = await parseAuthCookie();
  const protection = getPasswordProtection(data.page, folders, authCookie);

  // If homepage is protected and not unlocked, show 401 error page
  if (protection.isProtected && !protection.isUnlocked) {
    const errorPageData = await fetchErrorPage(401, true);
    const publishedCSS = await getSettingByKey('published_css');

    if (errorPageData) {
      const { page: errorPage, pageLayers: errorPageLayers, components: errorComponents } = errorPageData;

      return (
        <PageRenderer
          page={errorPage}
          layers={errorPageLayers.layers || []}
          components={errorComponents}
          generatedCss={publishedCSS}
          passwordProtection={{
            pageId: protection.protectedBy === 'page' ? protection.protectedById : undefined,
            folderId: protection.protectedBy === 'folder' ? protection.protectedById : undefined,
            redirectUrl: '/',
            isPublished: true,
          }}
        />
      );
    }

    // Inline fallback if no custom 401 page exists
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'white', fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px', color: '#111' }}>Password Protected</h1>
        <p style={{ color: '#666', marginBottom: '24px' }}>Enter the password to continue.</p>
        <PasswordForm
          pageId={protection.protectedBy === 'page' ? protection.protectedById : undefined}
          folderId={protection.protectedBy === 'folder' ? protection.protectedById : undefined}
          redirectUrl="/"
          isPublished={true}
        />
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

  // Check password protection - don't leak metadata for protected pages
  const folders = await fetchFoldersForAuth(true);
  const authCookie = await parseAuthCookie();
  const protection = getPasswordProtection(data.page, folders, authCookie);

  if (protection.isProtected && !protection.isUnlocked) {
    return {
      title: 'Password Protected',
      description: 'This page is password protected.',
      robots: { index: false, follow: false },
    };
  }

  return generatePageMetadata(data.page, {
    fallbackTitle: 'Home',
    pagePath: '/',
    globalSeoSettings: globalSettings,
  });
}
