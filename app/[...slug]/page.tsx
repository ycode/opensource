import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { buildSlugPath } from '@/lib/page-utils';
import { fetchPageByPath } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import type { Page, PageFolder } from '@/types';

// Force static generation with ISR
export const dynamic = 'force-static';
export const revalidate = 3600; // Revalidate every 1 hour
export const dynamicParams = true; // Allow dynamic slugs not in generateStaticParams

/**
 * Generate static params for known published pages
 * This tells Next.js which pages to pre-render
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

    if (!pages || !folders) {
      return [];
    }

    // Build full paths for all pages
    return pages
      .map((page: Page) => {
        const fullPath = buildSlugPath(page, folders as PageFolder[], 'page');
        // Remove leading slash and split into segments
        const pathSegments = fullPath.slice(1).split('/').filter(Boolean);

        // Skip empty paths (homepage is handled by app/page.tsx)
        if (pathSegments.length === 0) {
          return null;
        }

        return {
          slug: pathSegments,
        };
      })
      .filter((param): param is { slug: string[] } => param !== null);
  } catch (error) {
    console.error('Failed to generate static params:', error);
    return [];
  }
}

/**
 * Fetch published page and layers data from database
 * Cached per slug for revalidation
 */
async function fetchPublishedPageWithLayers(slugPath: string) {
  return unstable_cache(
    async () => fetchPageByPath(slugPath, true),
    [`data-for-route-/${slugPath}-v3`], // Unique cache key per slug path (v3 for full path support)
    {
      tags: [`route-/${slugPath}`], // Tag for revalidation on publish
      revalidate: 60, // Cache for 1 minute (reduced for testing)
    }
  )();
}

export default async function Page({ params }: { params: Promise<{ slug: string | string[] }> }) {
  // Await params (Next.js 15 requirement)
  const { slug } = await params;

  // Handle catch-all slug (join array into path)
  const slugPath = Array.isArray(slug) ? slug.join('/') : slug;

  // Fetch page and layers data
  const data = await fetchPublishedPageWithLayers(slugPath);

  if (!data) {
    notFound();
  }

  const { page, pageLayers, components } = data;

  // Load published CSS from settings
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

// Generate metadata
export async function generateMetadata({ params }: { params: Promise<{ slug: string | string[] }> }): Promise<Metadata> {
  const { slug } = await params;

  // Handle catch-all slug (join array into path)
  const slugPath = Array.isArray(slug) ? slug.join('/') : slug;

  // Fetch page to get name
  const data = await fetchPublishedPageWithLayers(slugPath);

  if (!data) {
    return {
      title: 'Page Not Found',
    };
  }

  return {
    title: data.page.name || slugPath.charAt(0).toUpperCase() + slugPath.slice(1),
    description: `${data.page.name} - Built with YCode`,
  };
}
