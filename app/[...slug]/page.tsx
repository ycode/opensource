import { notFound, redirect, permanentRedirect } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { buildSlugPath } from '@/lib/page-utils';
import { generatePageMetadata, fetchGlobalPageSettings } from '@/lib/generate-page-metadata';
import { fetchPageByPath, fetchErrorPage } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import PasswordForm from '@/components/PasswordForm';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import { parseAuthCookie, getPasswordProtection, fetchFoldersForAuth } from '@/lib/page-auth';
import type { Page, PageFolder, Translation, Redirect as RedirectType } from '@/types';

// Static by default for performance, dynamic only when pagination is requested
export const revalidate = false; // Cache indefinitely until publish invalidates
export const dynamicParams = true;

/**
 * Generate static params for known published pages
 * This tells Next.js which pages to pre-render
 * Includes both default locale paths and translated paths for all locales
 */
export async function generateStaticParams() {
  try {
    const supabase = await getSupabaseAdmin();

    if (!supabase) {
      return [];
    }

    // Get all published pages and folders (excluding soft-deleted)
    const { data: pages } = await supabase
      .from('pages')
      .select('*')
      .eq('is_published', true)
      .is('deleted_at', null);

    const { data: folders } = await supabase
      .from('page_folders')
      .select('*')
      .eq('is_published', true)
      .is('deleted_at', null);

    // Get all active locales
    const { data: locales } = await supabase
      .from('locales')
      .select('*')
      .is('deleted_at', null);

    // Get all published translations
    const { data: translations } = await supabase
      .from('translations')
      .select('*')
      .eq('is_published', true)
      .is('deleted_at', null);

    if (!pages || !folders) {
      return [];
    }

    const params: { slug: string[] }[] = [];

    // Build translations map for easier lookup
    const translationsMap: Record<string, Record<string, Translation>> = {};
    if (translations) {
      for (const translation of translations) {
        if (!translationsMap[translation.locale_id]) {
          translationsMap[translation.locale_id] = {};
        }
        const key = `${translation.source_type}:${translation.source_id}:${translation.content_key}`;
        translationsMap[translation.locale_id][key] = translation;
      }
    }

    // Generate localized homepage paths (e.g., /fr/, /es/)
    if (locales) {
      for (const locale of locales) {
        if (locale.is_default) continue; // Skip default locale (/ is handled by app/page.tsx)
        params.push({ slug: [locale.code] });
      }
    }

    // Generate params for each non-dynamic page
    for (const page of pages) {
      // Skip dynamic pages - they are handled dynamically at request time
      if (page.is_dynamic) {
        continue;
      }

      // Generate default locale path (no locale prefix)
      const defaultPath = buildSlugPath(page, folders as PageFolder[], 'page');
      const defaultSegments = defaultPath.slice(1).split('/').filter(Boolean);

      // Skip empty paths (homepage is handled by app/page.tsx)
      if (defaultSegments.length > 0) {
        params.push({ slug: defaultSegments });
      }

      // Generate translated paths for non-default locales
      if (locales) {
        for (const locale of locales) {
          if (locale.is_default) continue; // Skip default locale

          const localeTranslations = translationsMap[locale.id] || {};

          // Build localized path with translated slugs
          const slugParts: string[] = [locale.code];

          // Add translated folder path
          let currentFolderId = page.page_folder_id;
          const folderSegments: string[] = [];
          while (currentFolderId) {
            const folder = folders.find(f => f.id === currentFolderId);
            if (!folder) break;

            const translationKey = `folder:${folder.id}:slug`;
            const translatedSlug = localeTranslations[translationKey]?.content_value || folder.slug;
            folderSegments.unshift(translatedSlug);

            currentFolderId = folder.page_folder_id;
          }
          slugParts.push(...folderSegments);

          // Add page's own slug
          if (!page.is_index && page.slug) {
            const pageKey = `page:${page.id}:slug`;
            const translatedSlug = localeTranslations[pageKey]?.content_value || page.slug;
            slugParts.push(translatedSlug);
          }

          const localizedSegments = slugParts.filter(Boolean);
          if (localizedSegments.length > 1) { // Must have at least locale + something
            params.push({ slug: localizedSegments });
          }
        }
      }
    }

    return params;
  } catch (error) {
    console.error('Failed to generate static params:', error);
    return [];
  }
}

/**
 * Fetch published page and layers data from database
 * Cached per slug and page for revalidation
 */
async function fetchPublishedPageWithLayers(slugPath: string) {
  try {
    return await unstable_cache(
      async () => fetchPageByPath(slugPath, true),
      [`data-for-route-/${slugPath}`],
      {
        tags: ['all-pages', `route-/${slugPath}`], // all-pages for full publish invalidation
        revalidate: false,
      }
    )();
  } catch {
    // Fallback to uncached fetch when data exceeds cache size limit (2MB).
    // If runtime credentials are unavailable (e.g. build-time), return null.
    try {
      return await fetchPageByPath(slugPath, true);
    } catch {
      return null;
    }
  }
}

async function fetchCachedRedirects(): Promise<RedirectType[] | null> {
  try {
    return await unstable_cache(
      async () => getSettingByKey('redirects') as Promise<RedirectType[] | null>,
      ['data-for-redirects'],
      { tags: ['all-pages'], revalidate: false }
    )();
  } catch {
    return null;
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

async function fetchCachedErrorPage(errorCode: 401 | 404) {
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

interface PageProps {
  params: Promise<{ slug: string | string[] }>;
}

export default async function Page({ params }: PageProps) {
  // Await params
  const { slug } = await params;

  // Handle catch-all slug (join array into path)
  const slugPath = Array.isArray(slug) ? slug.join('/') : slug;

  // Check for redirects before processing the page
  const currentPath = `/${slugPath}`;
  const redirects = await fetchCachedRedirects();
  if (redirects && Array.isArray(redirects)) {
    const matchedRedirect = redirects.find((r) => r.oldUrl === currentPath);
    if (matchedRedirect) {
      // Use permanentRedirect for 301 (default), redirect for 302
      if (matchedRedirect.type === '302') {
        redirect(matchedRedirect.newUrl);
      } else {
        permanentRedirect(matchedRedirect.newUrl);
      }
    }
  }

  // Cache-first slug path; pagination is served through internal dynamic routes.
  const data = await fetchPublishedPageWithLayers(slugPath);

  // If page not found, try to show custom 404 error page
  if (!data) {
    const errorPageData = await fetchCachedErrorPage(404);

    if (errorPageData) {
      const { page, pageLayers, components } = errorPageData;
      const publishedCSS = await fetchCachedPublishedCss();

      return (
        <PageRenderer
          page={page}
          layers={pageLayers.layers || []}
          components={components}
          generatedCss={publishedCSS}
        />
      );
    }

    // No custom 404 page, use default Next.js 404
    notFound();
  }

  const { page, pageLayers, components, collectionItem, collectionFields, locale, availableLocales, translations } = data;

  // Check password protection for this page.
  // First evaluate without cookies() so non-protected pages stay cacheable.
  const folders = await fetchCachedFoldersForAuth();
  const protectionCheck = getPasswordProtection(page, folders, null);

  // If page is protected, read auth cookie and re-check unlock state.
  if (protectionCheck.isProtected) {
    const authCookie = await parseAuthCookie();
    const protection = getPasswordProtection(page, folders, authCookie);

    // If page is protected and not unlocked, show 401 error page
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
            redirectUrl: currentPath,
            isPublished: true,
          }}
        />
        );
      }

      // Inline fallback if no custom 401 page exists
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="text-center max-w-md px-4">
            <h1 className="text-6xl font-bold text-gray-900 mb-4">401</h1>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Password Protected</h2>
            <p className="text-gray-600 mb-8">Enter the password to continue.</p>
            <PasswordForm
              pageId={protection.protectedBy === 'page' ? protection.protectedById : undefined}
              folderId={protection.protectedBy === 'folder' ? protection.protectedById : undefined}
              redirectUrl={currentPath}
              isPublished={true}
            />
          </div>
        </div>
      );
    }
  }

  // Load all global settings in a single query
  const globalSettings = await fetchCachedGlobalSettings();

  return (
    <PageRenderer
      page={page}
      layers={pageLayers.layers || []}
      components={components}
      generatedCss={globalSettings.publishedCss || undefined}
      collectionItem={collectionItem}
      collectionFields={collectionFields}
      locale={locale}
      availableLocales={availableLocales}
      translations={translations}
      gaMeasurementId={globalSettings.gaMeasurementId}
      globalCustomCodeHead={globalSettings.globalCustomCodeHead}
      globalCustomCodeBody={globalSettings.globalCustomCodeBody}
      ycodeBadge={globalSettings.ycodeBadge}
    />
  );
}

// Generate metadata
export async function generateMetadata({ params }: { params: Promise<{ slug: string | string[] }> }): Promise<Metadata> {
  const { slug } = await params;

  // Handle catch-all slug (join array into path)
  const slugPath = Array.isArray(slug) ? slug.join('/') : slug;

  // Fetch page and global settings in parallel
  const [data, globalSettings] = await Promise.all([
    fetchPublishedPageWithLayers(slugPath),
    fetchCachedGlobalSettings(),
  ]);

  if (!data) {
    return {
      title: 'Page Not Found',
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
      fallbackTitle: slugPath.charAt(0).toUpperCase() + slugPath.slice(1),
      collectionItem: data.collectionItem,
      pagePath: '/' + slugPath,
      globalSeoSettings: globalSettings,
    }),
    [`data-for-route-/${slugPath}-meta`],
    { tags: ['all-pages', `route-/${slugPath}`], revalidate: false }
  )();
}
