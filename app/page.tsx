import { unstable_cache } from 'next/cache';
import Link from 'next/link';
import { fetchHomepage, fetchErrorPage } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import PasswordForm from '@/components/PasswordForm';
import { generatePageMetadata, fetchGlobalPageSettings } from '@/lib/generate-page-metadata';
import { parseAuthCookie, getPasswordProtection, fetchFoldersForAuth } from '@/lib/page-auth';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import type { Metadata } from 'next';

// Static by default for performance, dynamic only when pagination is requested
export const revalidate = false; // Cache indefinitely until publish invalidates

/**
 * Fetch homepage data from database
 * Cached with tag-based revalidation (no time-based stale cache)
 */
async function fetchPublishedHomepage() {
  try {
    return await unstable_cache(
      async () => fetchHomepage(true),
      ['data-for-route-/'],
      {
        tags: ['all-pages', 'route-/'], // all-pages for full publish invalidation, route-/ for targeted
        revalidate: false,
      }
    )();
  } catch {
    // Fallback to uncached fetch when data exceeds cache size limit (2MB).
    // If runtime credentials are unavailable (e.g. build-time), return null.
    try {
      return await fetchHomepage(true);
    } catch {
      return null;
    }
  }
}

async function fetchCachedGlobalSettings() {
  try {
    return await unstable_cache(
      async () => fetchGlobalPageSettings(),
      ['data-for-global-settings'],
      { tags: ['all-pages'], revalidate: false }
    )();
  } catch {
    return {
      googleSiteVerification: null,
      globalCanonicalUrl: null,
      gaMeasurementId: null,
      publishedCss: null,
      globalCustomCodeHead: null,
      globalCustomCodeBody: null,
      ycodeBadge: true,
      faviconUrl: null,
      webClipUrl: null,
    };
  }
}

async function fetchCachedFoldersForAuth() {
  try {
    return await unstable_cache(
      async () => fetchFoldersForAuth(true),
      ['data-for-auth-folders'],
      { tags: ['all-pages'], revalidate: false }
    )();
  } catch {
    return [];
  }
}

async function fetchCachedErrorPage(errorCode: 401) {
  try {
    return await unstable_cache(
      async () => fetchErrorPage(errorCode, true),
      [`data-for-error-page-${errorCode}`],
      { tags: ['all-pages'], revalidate: false }
    )();
  } catch {
    return null;
  }
}

async function fetchCachedPublishedCss() {
  try {
    return await unstable_cache(
      async () => getSettingByKey('published_css'),
      ['data-for-published-css'],
      { tags: ['all-pages'], revalidate: false }
    )();
  } catch {
    return null;
  }
}

export default async function Home() {
  // Cache-first homepage path; pagination is served through internal dynamic routes.
  const data = await fetchPublishedHomepage();

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

  // Check password protection for homepage.
  // First evaluate without cookies() so non-protected pages can stay cacheable.
  const folders = await fetchCachedFoldersForAuth();
  const protectionCheck = getPasswordProtection(data.page, folders, null);

  // If homepage is protected, read auth cookie and re-check unlock state.
  if (protectionCheck.isProtected) {
    const authCookie = await parseAuthCookie();
    const protection = getPasswordProtection(data.page, folders, authCookie);

    // If homepage is protected and not unlocked, show 401 error page
    if (!protection.isUnlocked) {
      const errorPageData = await fetchCachedErrorPage(401);
      const publishedCSS = await fetchCachedPublishedCss();

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
  }

  // Load all global settings in a single query
  const globalSettings = await fetchCachedGlobalSettings();

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
    fetchCachedGlobalSettings(),
  ]);

  if (!data) {
    return {
      title: 'YCode',
      description: 'Built with YCode',
    };
  }

  // Check password protection - don't leak metadata for protected pages.
  // First check without cookies() to avoid forcing dynamic metadata for public pages.
  const folders = await fetchCachedFoldersForAuth();
  const protectionCheck = getPasswordProtection(data.page, folders, null);

  if (protectionCheck.isProtected) {
    const authCookie = await parseAuthCookie();
    const protection = getPasswordProtection(data.page, folders, authCookie);
    if (!protection.isUnlocked) {
      return {
        title: 'Password Protected',
        description: 'This page is password protected.',
        robots: { index: false, follow: false },
      };
    }
  }

  return unstable_cache(
    async () => generatePageMetadata(data.page, {
      fallbackTitle: 'Home',
      pagePath: '/',
      globalSeoSettings: globalSettings,
    }),
    ['data-for-route-/-meta'],
    { tags: ['all-pages', 'route-/'], revalidate: false }
  )();
}
