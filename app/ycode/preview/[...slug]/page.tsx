import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchPageByPath, fetchErrorPage } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import PasswordForm from '@/components/PasswordForm';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import { generatePageMetadata } from '@/lib/generate-page-metadata';
import { parseAuthCookie, getPasswordProtection, fetchFoldersForAuth } from '@/lib/page-auth';

// Force dynamic rendering - no caching for preview
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page({ params }: { params: Promise<{ slug: string | string[] }> }) {
  // Await params (Next.js 15 requirement)
  const { slug } = await params;

  // Handle catch-all slug (join array into path)
  const slugPath = Array.isArray(slug) ? slug.join('/') : slug;

  // Fetch draft page and layers data (no caching)
  const data = await fetchPageByPath(slugPath, false);

  // If page not found, try to show custom 404 error page
  if (!data) {
    const errorPageData = await fetchErrorPage(404, false);

    if (errorPageData) {
      const { page, pageLayers, components } = errorPageData;
      const draftCSS = await getSettingByKey('draft_css');

      return (
        <PageRenderer
          page={page}
          layers={pageLayers.layers || []}
          components={components}
          generatedCss={draftCSS}
          isPreview={true}
        />
      );
    }

    // No custom 404 page, use default Next.js 404
    notFound();
  }

  const { page, pageLayers, components, collectionItem, collectionFields, locale, availableLocales, translations } = data;

  // Check password protection for this page (using all folders for preview)
  const folders = await fetchFoldersForAuth(false);
  const authCookie = await parseAuthCookie();
  const protection = getPasswordProtection(page, folders, authCookie);

  // If page is protected and not unlocked, show 401 error page
  if (protection.isProtected && !protection.isUnlocked) {
    const errorPageData = await fetchErrorPage(401, false);
    const draftCSS = await getSettingByKey('draft_css');

    if (errorPageData) {
      const { page: errorPage, pageLayers: errorPageLayers, components: errorComponents } = errorPageData;

      return (
        <PageRenderer
          page={errorPage}
          layers={errorPageLayers.layers || []}
          components={errorComponents}
          generatedCss={draftCSS}
          isPreview={true}
          passwordProtection={{
            pageId: protection.protectedBy === 'page' ? protection.protectedById : undefined,
            folderId: protection.protectedBy === 'folder' ? protection.protectedById : undefined,
            redirectUrl: `/ycode/preview/${slugPath}`,
            isPublished: false,
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
          redirectUrl={`/ycode/preview/${slugPath}`}
          isPublished={false}
        />
      </div>
    );
  }

  // Load draft CSS from settings
  const draftCSS = await getSettingByKey('draft_css');

  // Render the preview page (draft version)
  return (
    <PageRenderer
      page={page}
      layers={pageLayers.layers || []}
      components={components}
      generatedCss={draftCSS}
      collectionItem={collectionItem}
      collectionFields={collectionFields}
      locale={locale}
      availableLocales={availableLocales}
      isPreview={true}
      translations={translations}
    />
  );
}

// Generate metadata
export async function generateMetadata({ params }: { params: Promise<{ slug: string | string[] }> }): Promise<Metadata> {
  const { slug } = await params;

  // Handle catch-all slug (join array into path)
  const slugPath = Array.isArray(slug) ? slug.join('/') : slug;

  // Fetch draft page to get name and SEO settings
  const data = await fetchPageByPath(slugPath, false);

  if (!data) {
    return {
      title: 'Preview - Page Not Found',
    };
  }

  // Check password protection - don't leak metadata for protected pages
  const folders = await fetchFoldersForAuth(false);
  const authCookie = await parseAuthCookie();
  const protection = getPasswordProtection(data.page, folders, authCookie);

  if (protection.isProtected && !protection.isUnlocked) {
    return {
      title: 'Preview - Password Protected',
      description: 'This page is password protected.',
      robots: { index: false, follow: false },
    };
  }

  return generatePageMetadata(data.page, {
    isPreview: true,
    collectionItem: data.collectionItem,
  });
}
