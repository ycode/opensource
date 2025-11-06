import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
import type { Metadata } from 'next';
import LayerRenderer from '../../components/layers/LayerRenderer';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { resolveComponents } from '@/lib/resolve-components';
import PublishedPageHead from './PublishedPageHead';
import RemoveDarkMode from './RemoveDarkMode';

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

    // Get all published pages (excluding soft-deleted)
    const { data: pages, error } = await supabase
      .from('pages')
      .select('slug')
      .eq('is_published', true)
      .is('deleted_at', null);

    if (error || !pages) {
      return [];
    }

    return pages.map((page) => ({
      slug: page.slug,
    }));
  } catch (error) {
    console.error('Failed to generate static params:', error);
    return [];
  }
}

/**
 * Fetch published page and layers data from database
 * Cached per slug for revalidation
 */
async function fetchPublishedPageWithLayers(slug: string) {
  // Use unstable_cache to cache this fetch with tags
  return unstable_cache(
    async () => {
      try {
        const supabase = await getSupabaseAdmin();

        if (!supabase) {
          console.error('Supabase not configured');
          return null;
        }

        // Get page by slug (only published, non-deleted)
        const { data: page, error: pageError } = await supabase
          .from('pages')
          .select('*')
          .eq('slug', slug)
          .eq('is_published', true)
          .is('deleted_at', null)
          .single();

        if (pageError) {
          if (pageError.code === 'PGRST116') {
            // Page not found
            return null;
          }
          throw pageError;
        }

        // Get published layers (only non-deleted)
        const { data: pageLayers, error: layersError } = await supabase
          .from('page_layers')
          .select('*')
          .eq('page_id', page.id)
          .eq('is_published', true)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (layersError) {
          console.error('Failed to fetch published layers:', layersError);
          return null;
        }

        // Fetch all components to resolve component instances
        const { data: components } = await supabase
          .from('components')
          .select('*');

        return {
          page,
          pageLayers,
          components: components || [],
        };
      } catch (error) {
        console.error('Failed to fetch page:', error);
        return null;
      }
    },
    [`data-for-route-/${slug}-v2`], // Unique cache key per slug (v2 for component fix)
    {
      tags: [`route-/${slug}`], // Tag for revalidation on publish
      revalidate: 60, // Cache for 1 minute (reduced for testing)
    }
  )();
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  // Await params (Next.js 15 requirement)
  const { slug } = await params;

  // Fetch page and layers data in one go
  const data = await fetchPublishedPageWithLayers(slug);

  if (!data) {
    notFound();
  }

  const { page, pageLayers, components } = data;

  // Resolve component instances in the layer tree before rendering
  const resolvedLayers = resolveComponents(pageLayers.layers || [], components);

  // Render the page with extracted CSS from Tailwind JIT (compiled during publish)
  return (
    <>
      {/* Remove dark mode class from <html> element */}
      <RemoveDarkMode />

      {/* Inject minified CSS into <head> */}
      {pageLayers.generated_css && <PublishedPageHead css={pageLayers.generated_css} />}

      <div className="min-h-screen bg-white">
        <LayerRenderer
          layers={resolvedLayers}
          isEditMode={false}
        />
      </div>
    </>
  );
}

// Generate metadata
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  // Fetch page to get name
  const data = await fetchPublishedPageWithLayers(slug);

  if (!data) {
    return {
      title: 'Page Not Found',
    };
  }

  return {
    title: data.page.name || slug.charAt(0).toUpperCase() + slug.slice(1),
    description: `${data.page.name} - Built with YCode`,
  };
}
