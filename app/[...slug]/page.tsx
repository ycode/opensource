import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { buildSlugPath } from '@/lib/page-utils';
import { generatePageMetadata } from '@/lib/generate-page-metadata';
import { fetchPageByPath, fetchErrorPage, PaginationContext } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import type { Page, PageFolder } from '@/types';

// Incremental Static Regeneration (ISR) with on-demand revalidation
export const revalidate = false;
export const dynamicParams = true;

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

    // Build full paths for all pages (exclude dynamic pages - they use dynamicParams)
    return pages
      .map((page: Page) => {
        // Skip dynamic pages - they are handled dynamically at request time
        if (page.is_dynamic) {
          return null;
        }

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
 * Cached per slug and page for revalidation
 */
async function fetchPublishedPageWithLayers(slugPath: string, paginationContext?: PaginationContext) {
  // Include page number in cache key for pagination support
  const pageNum = paginationContext?.defaultPage || 1;
  return unstable_cache(
    async () => fetchPageByPath(slugPath, true, paginationContext),
    [`data-for-route-/${slugPath}`, `page-${pageNum}`],
    {
      tags: [`route-/${slugPath}`], // Tag for revalidation on publish
      revalidate: 3600,
    }
  )();
}

interface PageProps {
  params: Promise<{ slug: string | string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function Page({ params, searchParams }: PageProps) {
  // Await params and searchParams (Next.js 15 requirement)
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;

  // Handle catch-all slug (join array into path)
  const slugPath = Array.isArray(slug) ? slug.join('/') : slug;

  // Extract page number from search params for pagination
  const pageParam = resolvedSearchParams.page;
  const pageNumber = typeof pageParam === 'string' ? parseInt(pageParam, 10) : 1;
  const paginationContext: PaginationContext = {
    defaultPage: isNaN(pageNumber) || pageNumber < 1 ? 1 : pageNumber,
  };

  // Fetch page and layers data
  const data = await fetchPublishedPageWithLayers(slugPath, paginationContext);

  // If page not found, try to show custom 404 error page
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

    // No custom 404 page, use default Next.js 404
    notFound();
  }

  const { page, pageLayers, components, collectionItem, collectionFields } = data;

  // Load published CSS from settings
  const publishedCSS = await getSettingByKey('published_css');

  return (
    <PageRenderer
      page={page}
      layers={pageLayers.layers || []}
      components={components}
      generatedCss={publishedCSS}
      collectionItem={collectionItem}
      collectionFields={collectionFields}
    />
  );
}

// Generate metadata
export async function generateMetadata({ params }: { params: Promise<{ slug: string | string[] }> }): Promise<Metadata> {
  const { slug } = await params;

  // Handle catch-all slug (join array into path)
  const slugPath = Array.isArray(slug) ? slug.join('/') : slug;

  // Fetch page to get name and SEO settings
  const data = await fetchPublishedPageWithLayers(slugPath);

  if (!data) {
    return {
      title: 'Page Not Found',
    };
  }

  return generatePageMetadata(data.page, {
    fallbackTitle: slugPath.charAt(0).toUpperCase() + slugPath.slice(1),
    collectionItem: data.collectionItem,
  });
}
