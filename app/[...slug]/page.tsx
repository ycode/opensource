import { notFound } from 'next/navigation';
import { unstable_cache, unstable_noStore } from 'next/cache';
import type { Metadata } from 'next';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { buildSlugPath } from '@/lib/page-utils';
import { generatePageMetadata } from '@/lib/generate-page-metadata';
import { fetchPageByPath, fetchErrorPage, PaginationContext } from '@/lib/page-fetcher';
import PageRenderer from '@/components/PageRenderer';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';
import type { Page, PageFolder } from '@/types';

// Static by default for performance, dynamic only when pagination is requested
export const revalidate = 3600; // Revalidate every hour
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
  // Include pagination params in cache key for per-collection pagination support
  // Sort keys for consistent cache key regardless of param order
  const paginationKey = paginationContext?.pageNumbers 
    ? Object.entries(paginationContext.pageNumbers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, page]) => `${id}:${page}`)
      .join(',')
    : '';
  return unstable_cache(
    async () => fetchPageByPath(slugPath, true, paginationContext),
    [`data-for-route-/${slugPath}`, `pagination-${paginationKey}`],
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
