import { notFound, redirect, permanentRedirect } from 'next/navigation';
import { unstable_noStore } from 'next/cache';
import { fetchPageByPath, fetchErrorPage, PaginationContext } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import PasswordForm from '@/components/PasswordForm';
import { fetchGlobalPageSettings } from '@/lib/generate-page-metadata';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import { parseAuthCookie, getPasswordProtection, fetchFoldersForAuth } from '@/lib/page-auth';
import type { Redirect as RedirectType } from '@/types';

// Internal pagination path: always dynamic/no-store.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface DynamicSlugPageProps {
  params: Promise<{ slug: string | string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DynamicSlugPage({ params, searchParams }: DynamicSlugPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;

  const slugPath = Array.isArray(slug) ? slug.join('/') : slug;
  const currentPath = `/${slugPath}`;

  const redirects = await getSettingByKey('redirects') as RedirectType[] | null;
  if (redirects && Array.isArray(redirects)) {
    const matchedRedirect = redirects.find((r) => r.oldUrl === currentPath);
    if (matchedRedirect) {
      if (matchedRedirect.type === '302') {
        redirect(matchedRedirect.newUrl);
      } else {
        permanentRedirect(matchedRedirect.newUrl);
      }
    }
  }

  const pageNumbers: Record<string, number> = {};
  for (const [key, value] of Object.entries(resolvedSearchParams)) {
    if (key.startsWith('p_') && typeof value === 'string') {
      const layerId = key.slice(2);
      const pageNum = parseInt(value, 10);
      if (!isNaN(pageNum) && pageNum >= 1) {
        pageNumbers[layerId] = pageNum;
      }
    }
  }

  unstable_noStore();

  const paginationContext: PaginationContext = {
    pageNumbers,
    defaultPage: 1,
  };

  const data = await fetchPageByPath(slugPath, true, paginationContext);

  if (!data) {
    const errorPageData = await fetchErrorPage(404, true);
    if (errorPageData) {
      const { page, pageLayers, components } = errorPageData;
      const publishedCSS = await getSettingByKey('published_css');

      return (
        <PageRenderer
          page={page}
          layers={pageLayers.layers || []}
          components={components}
          generatedCss={publishedCSS}
        />
      );
    }

    notFound();
  }

  const { page, pageLayers, components, collectionItem, collectionFields, locale, availableLocales, translations } = data;

  const folders = await fetchFoldersForAuth(true);
  const protectionCheck = getPasswordProtection(page, folders, null);

  if (protectionCheck.isProtected) {
    const authCookie = await parseAuthCookie();
    const protection = getPasswordProtection(page, folders, authCookie);

    if (!protection.isUnlocked) {
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
              redirectUrl: currentPath,
              isPublished: true,
            }}
          />
        );
      }

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

  const globalSettings = await fetchGlobalPageSettings();

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
