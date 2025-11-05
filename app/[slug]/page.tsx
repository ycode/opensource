import { notFound } from 'next/navigation';
import { unstable_cache } from 'next/cache';
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

    // Get all published pages
    const { data: pages, error } = await supabase
      .from('pages')
      .select('slug')
      .not('published_version_id', 'is', null);

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
 * Fetch published page and version data from database
 * Cached per slug for revalidation
 */
async function fetchPublishedPageWithVersion(slug: string) {
  // Use unstable_cache to cache this fetch with tags
  return unstable_cache(
    async () => {
      try {
        const supabase = await getSupabaseAdmin();
        
        if (!supabase) {
          console.error('Supabase not configured');
          return null;
        }

        // Get page by slug
        const { data: page, error: pageError } = await supabase
          .from('pages')
          .select('*')
          .eq('slug', slug)
          .single();

        if (pageError) {
          if (pageError.code === 'PGRST116') {
            // Page not found
            return null;
          }
          throw pageError;
        }

        // Check if page is published
        if (page.status === 'draft' && !page.published_version_id) {
          return null; // Unpublished page
        }

        // Get published version
        if (!page.published_version_id) {
          return null; // No published version
        }

        const { data: version, error: versionError } = await supabase
          .from('page_versions')
          .select('*')
          .eq('id', page.published_version_id)
          .single();

        if (versionError) {
          console.error('Failed to fetch published version:', versionError);
          return null;
        }
        
        // Fetch all components to resolve component instances
        const { data: components } = await supabase
          .from('components')
          .select('*');

        return {
          page,
          version,
          components: components || [],
        };
      } catch (error) {
        console.error('Failed to fetch page:', error);
        return null;
      }
    },
    [`page-data-${slug}`], // Unique cache key per slug
    {
      tags: [`page-${slug}`], // Tag for revalidation on publish
      revalidate: 3600, // Cache for 1 hour
    }
  )();
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  // Await params (Next.js 15 requirement)
  const { slug } = await params;
  
  // Fetch page and version data in one go
  const data = await fetchPublishedPageWithVersion(slug);
  
  if (!data) {
    notFound();
  }

  const { version, components } = data;
  
  // Resolve component instances in the layer tree before rendering
  const resolvedLayers = resolveComponents(version.layers || [], components);

  // Render the page with extracted CSS from Tailwind JIT (compiled during publish)
  return (
    <>
      {/* Remove dark mode class from <html> element */}
      <RemoveDarkMode />
      
      {/* Inject minified CSS into <head> */}
      {version.generated_css && <PublishedPageHead css={version.generated_css} />}
      
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
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  // Fetch page to get title
  const data = await fetchPublishedPageWithVersion(slug);
  
  if (!data) {
    return {
      title: 'Page Not Found',
    };
  }

  return {
    title: data.page.title || slug.charAt(0).toUpperCase() + slug.slice(1),
    description: `${data.page.title} - Built with YCode`,
  };
}
