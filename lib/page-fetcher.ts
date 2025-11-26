import { getSupabaseAdmin } from '@/lib/supabase-server';
import { buildSlugPath } from '@/lib/page-utils';
import { getItemWithValues } from '@/lib/repositories/collectionItemRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';
import type { Page, PageFolder, PageLayers, Component, CollectionItemWithValues, CollectionField } from '@/types';

export interface PageData {
  page: Page;
  pageLayers: PageLayers;
  components: Component[];
  collectionItem?: CollectionItemWithValues; // For dynamic pages
  collectionFields?: CollectionField[]; // For dynamic pages
}

/**
 * Match a URL path against a dynamic page pattern and extract the slug value
 * @param urlPath - The URL path (e.g., "/products/item-1")
 * @param patternPath - The pattern path with {slug} placeholder (e.g., "/products/{slug}")
 * @returns The extracted slug value or null if no match
 */
function matchDynamicPagePattern(urlPath: string, patternPath: string): string | null {
  // Replace {slug} with a regex capture group
  const patternRegex = patternPath.replace(/\{slug\}/g, '([^/]+)');
  const regex = new RegExp(`^${patternRegex}$`);
  const match = urlPath.match(regex);

  if (!match) {
    return null;
  }

  // Extract the slug value (first capture group)
  return match[1] || null;
}

/**
 * Fetch collection item by slug field value
 * @param collectionId - Collection UUID
 * @param slugFieldId - Field ID for the slug field
 * @param slugValue - The slug value to match
 * @param isPublished - Get draft (false) or published (true) version
 */
async function getCollectionItemBySlug(
  collectionId: string,
  slugFieldId: string,
  slugValue: string,
  isPublished: boolean
): Promise<CollectionItemWithValues | null> {
  try {
    const supabase = await getSupabaseAdmin();

    if (!supabase) {
      return null;
    }

    // Find the item ID by matching the slug field value
    const { data: valueData, error: valueError } = await supabase
      .from('collection_item_values')
      .select('item_id')
      .eq('field_id', slugFieldId)
      .eq('value', slugValue)
      .eq('is_published', isPublished)
      .is('deleted_at', null)
      .limit(1)
      .single();

    if (valueError || !valueData) {
      return null;
    }

    // Verify the item belongs to the correct collection
    const { data: item, error: itemError } = await supabase
      .from('collection_items')
      .select('*')
      .eq('id', valueData.item_id)
      .eq('collection_id', collectionId)
      .eq('is_published', isPublished)
      .is('deleted_at', null)
      .single();

    if (itemError || !item) {
      return null;
    }

    // Fetch the item with all its values
    return await getItemWithValues(item.id, isPublished);
  } catch (error) {
    console.error('Failed to fetch collection item by slug:', error);
    return null;
  }
}

/**
 * Fetch page by full path (including folders)
 * Works for both draft and published pages
 * Handles dynamic pages by matching URL patterns and fetching collection items
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

    const targetPath = `/${slugPath}`;

    // First, try to find an exact match (non-dynamic page)
    let matchingPage = pages.find((page: Page) => {
      if (page.is_dynamic) return false; // Skip dynamic pages for exact match
      const fullPath = buildSlugPath(page, folders as PageFolder[], 'page');
      return fullPath === targetPath;
    });

    // If no exact match, try dynamic pages
    if (!matchingPage) {
      // Find all dynamic pages and check if URL matches their pattern
      const dynamicPages = pages.filter((page: Page) => page.is_dynamic);

      for (const dynamicPage of dynamicPages) {
        const patternPath = buildSlugPath(dynamicPage, folders as PageFolder[], 'page', '{slug}');
        const extractedSlug = matchDynamicPagePattern(targetPath, patternPath);

        if (extractedSlug) {
          // Found a matching dynamic page pattern
          matchingPage = dynamicPage;

          // Fetch the collection item by slug value
          const cmsSettings = dynamicPage.settings?.cms;
          if (cmsSettings?.collection_id && cmsSettings?.slug_field_id) {
            const collectionItem = await getCollectionItemBySlug(
              cmsSettings.collection_id,
              cmsSettings.slug_field_id,
              extractedSlug,
              isPublished
            );

            if (!collectionItem) {
              // Collection item not found for this slug
              return null;
            }

            // Get layers for the dynamic page
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

            // Fetch collection fields for resolving custom code placeholders
            const collectionFields = await getFieldsByCollectionId(
              cmsSettings.collection_id,
              isPublished
            );

            return {
              page: matchingPage,
              pageLayers,
              components: components || [],
              collectionItem, // Include collection item for dynamic pages
              collectionFields, // Include collection fields for resolving placeholders
            };
          }
        }
      }

      // No matching page found (neither exact nor dynamic)
      return null;
    }

    // Handle non-dynamic page (exact match)
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
 * Fetch error page by error code (404, 401, 500)
 * Works for both draft and published pages
 */
export async function fetchErrorPage(
  errorCode: number,
  isPublished: boolean
): Promise<PageData | null> {
  try {
    const supabase = await getSupabaseAdmin();

    if (!supabase) {
      console.error('Supabase not configured');
      return null;
    }

    // Get the error page
    const { data: errorPage } = await supabase
      .from('pages')
      .select('*')
      .eq('error_page', errorCode)
      .eq('is_published', isPublished)
      .is('deleted_at', null)
      .single();

    if (!errorPage) {
      return null;
    }

    // Get layers for the error page
    const { data: pageLayers, error: layersError } = await supabase
      .from('page_layers')
      .select('*')
      .eq('page_id', errorPage.id)
      .eq('is_published', isPublished)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (layersError) {
      console.error(`Failed to fetch ${isPublished ? 'published' : 'draft'} error page layers:`, layersError);
      return null;
    }

    // Fetch all components to resolve component instances
    const { data: components } = await supabase
      .from('components')
      .select('*');

    return {
      page: errorPage,
      pageLayers,
      components: components || [],
    };
  } catch (error) {
    console.error('Failed to fetch error page:', error);
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
