import { getSupabaseAdmin } from '@/lib/supabase-server';
import { buildSlugPath } from '@/lib/page-utils';
import type { Page, PageFolder, PageLayers, Component } from '@/types';

export interface PageData {
  page: Page;
  pageLayers: PageLayers;
  components: Component[];
}

/**
 * Fetch page by full path (including folders)
 * Works for both draft and published pages
 */
export async function fetchPageByPath(
  slugPath: string,
  isPublished: boolean
): Promise<PageData | null> {
  try {
    const supabase = await getSupabaseAdmin();

    if (!supabase) {
      console.error('Supabase not configured');
      return null;
    }

    // Get all pages and folders to match the full path
    const { data: pages } = await supabase
      .from('pages')
      .select('*')
      .eq('is_published', isPublished)
      .is('deleted_at', null);

    const { data: folders } = await supabase
      .from('page_folders')
      .select('*')
      .eq('is_published', isPublished)
      .is('deleted_at', null);

    if (!pages || !folders) {
      return null;
    }

    // Find the page that matches the full path
    const targetPath = `/${slugPath}`;
    const matchingPage = pages.find((page: Page) => {
      const fullPath = buildSlugPath(page, folders as PageFolder[], 'page');
      return fullPath === targetPath;
    });

    if (!matchingPage) {
      return null;
    }

    // Get layers for the matched page
    const { data: pageLayers, error: layersError } = await supabase
      .from('page_layers')
      .select('*')
      .eq('page_id', matchingPage.id)
      .eq('is_published', isPublished)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (layersError) {
      console.error(`Failed to fetch ${isPublished ? 'published' : 'draft'} layers:`, layersError);
      return null;
    }

    // Fetch all components to resolve component instances
    const { data: components } = await supabase
      .from('components')
      .select('*');

    return {
      page: matchingPage,
      pageLayers,
      components: components || [],
    };
  } catch (error) {
    console.error('Failed to fetch page:', error);
    return null;
  }
}

/**
 * Fetch homepage (index page at root level)
 * Works for both draft and published pages
 */
export async function fetchHomepage(isPublished: boolean): Promise<Pick<PageData, 'page' | 'pageLayers'> | null> {
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
      .eq('is_published', isPublished)
      .is('deleted_at', null)
      .limit(1)
      .single();

    if (!homepage) {
      return null;
    }

    // Get layers for homepage
    const { data: pageLayers, error: layersError } = await supabase
      .from('page_layers')
      .select('*')
      .eq('page_id', homepage.id)
      .eq('is_published', isPublished)
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
}

