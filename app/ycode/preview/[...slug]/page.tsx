import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { fetchPageByPath } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';

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

  if (!data) {
    notFound();
  }

  const { page, pageLayers, components } = data;

  // Load draft CSS from settings
  const draftCSS = await getSettingByKey('draft_css');

  // Render the preview page (draft version)
  return (
    <PageRenderer
      page={page}
      layers={pageLayers.layers || []}
      components={components}
      generatedCss={draftCSS}
    />
  );
}

// Generate metadata
export async function generateMetadata({ params }: { params: Promise<{ slug: string | string[] }> }): Promise<Metadata> {
  const { slug } = await params;

  // Handle catch-all slug (join array into path)
  const slugPath = Array.isArray(slug) ? slug.join('/') : slug;

  // Fetch draft page to get name
  const data = await fetchPageByPath(slugPath, false);

  if (!data) {
    return {
      title: 'Preview - Page Not Found',
    };
  }

  return {
    title: `Preview: ${data.page.name}`,
    description: `Preview of ${data.page.name} - YCode`,
  };
}
