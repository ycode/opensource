import { unstable_cache } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import Link from 'next/link';
import LayerRenderer from '@/components/layers/LayerRenderer';
import PublishedPageHead from './[slug]/PublishedPageHead';
import RemoveDarkMode from './[slug]/RemoveDarkMode';
import type { Metadata } from 'next';

// Force dynamic rendering with on-demand revalidation
export const dynamic = 'force-static';
export const revalidate = 3600;
export const dynamicParams = true;

/**
 * Fetch homepage data from database with caching
 */
async function fetchHomepage() {
  return unstable_cache(
    async () => {
      try {
        const supabase = await getSupabaseAdmin();

        if (!supabase) {
          return null;
        }

        // Get the homepage
        const { data: homepage } = await supabase
          .from('pages')
          .select('*')
          .eq('is_index', true)
          .is('page_folder_id', null)
          .eq('is_published', true)
          .is('deleted_at', null)
          .limit(1)
          .single();

        if (!homepage) {
          return null;
        }

        // Get published layers for homepage
        const { data: pageLayers, error: layersError } = await supabase
          .from('page_layers')
          .select('*')
          .eq('page_id', homepage.id)
          .eq('is_published', true)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (layersError) {
          return null;
        }

        return {
          page: homepage,
          pageLayers,
        };
      } catch (error) {
        return null;
      }
    },
    ['data-for-route-/'], // Cache key
    {
      tags: ['route-/'], // Tags for revalidation (empty slug = homepage)
      revalidate: 3600, // Cache for 1 hour
    }
  )();
}

export default async function Home() {
  // Fetch homepage data
  const data = await fetchHomepage();

  // If no homepage, show default landing page
  if (!data || !data.pageLayers.layers || data.pageLayers.layers.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center p-8">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">
            YCode
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Your website is ready! Create pages in the builder.
          </p>
          <Link
            href="/ycode"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            Open Builder →
          </Link>
        </div>
      </div>
    );
  }

  // Render homepage
  return (
    <div className="min-h-screen bg-white">
      <RemoveDarkMode />
      {data.pageLayers.generated_css && (
        <PublishedPageHead css={data.pageLayers.generated_css} />
      )}
      <LayerRenderer
        layers={data.pageLayers.layers}
        isEditMode={false}
      />
    </div>
  );
}

// Generate metadata
export async function generateMetadata(): Promise<Metadata> {
  const data = await fetchHomepage();

  if (!data) {
    return {
      title: 'YCode',
      description: 'Built with YCode',
    };
  }

  return {
    title: data.page.name || 'Home',
    description: `${data.page.name} - Built with YCode`,
  };
}
