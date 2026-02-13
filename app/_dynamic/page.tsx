import { unstable_noStore } from 'next/cache';
import Link from 'next/link';
import { fetchHomepage, fetchErrorPage, PaginationContext } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import PasswordForm from '@/components/PasswordForm';
import { fetchGlobalPageSettings } from '@/lib/generate-page-metadata';
import { parseAuthCookie, getPasswordProtection, fetchFoldersForAuth } from '@/lib/page-auth';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';

// Internal pagination path: always dynamic/no-store.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface DynamicHomeProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DynamicHome({ searchParams }: DynamicHomeProps) {
  const resolvedSearchParams = await searchParams;

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

  const data = await fetchHomepage(true, paginationContext);

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

  const folders = await fetchFoldersForAuth(true);
  const protectionCheck = getPasswordProtection(data.page, folders, null);

  if (protectionCheck.isProtected) {
    const authCookie = await parseAuthCookie();
    const protection = getPasswordProtection(data.page, folders, authCookie);

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
              redirectUrl: '/',
              isPublished: true,
            }}
          />
        );
      }

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

  const globalSettings = await fetchGlobalPageSettings();

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
