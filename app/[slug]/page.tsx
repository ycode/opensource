import { notFound } from 'next/navigation';
import { cache } from 'react';
import LayerRenderer from '../../components/layers/LayerRenderer';
import { getSupabaseAdmin } from '@/lib/supabase-server';

// Enable ISR with on-demand revalidation
export const revalidate = 60; // Fallback: revalidate every 60 seconds
export const dynamicParams = true; // Allow dynamic slugs

/**
 * Fetch published page and version data directly from database
 * Cached to avoid duplicate queries during render + metadata generation
 */
const fetchPublishedPageWithVersion = cache(async (slug: string) => {
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

    return {
      page,
      version,
    };
  } catch (error) {
    console.error('Failed to fetch page:', error);
    return null;
  }
});

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  // Await params (Next.js 15 requirement)
  const { slug } = await params;
  
  // Fetch page and version data in one go
  const data = await fetchPublishedPageWithVersion(slug);
  
  if (!data) {
    notFound();
  }

  const { version } = data;

  // Render the page exactly as it appears in canvas (even if empty)
  return (
    <div className="min-h-screen bg-white">
      <LayerRenderer 
        layers={version.layers || []} 
        isEditMode={false}
      />
    </div>
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
