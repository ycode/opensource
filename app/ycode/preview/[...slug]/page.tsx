import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchPageByPath, fetchErrorPage } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import { generatePageMetadata } from '@/lib/generate-page-metadata';

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
        />
      );
    }

    // No custom 404 page, use default Next.js 404
    notFound();
  }

  const { page, pageLayers, components, collectionItem, collectionFields, locale, availableLocales } = data;

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

  return generatePageMetadata(data.page, {
    isPreview: true,
    collectionItem: data.collectionItem,
  });
}
