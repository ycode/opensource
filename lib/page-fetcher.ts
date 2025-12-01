import { getSupabaseAdmin } from '@/lib/supabase-server';
import { buildSlugPath } from '@/lib/page-utils';
import { getItemWithValues, getItemsWithValues } from '@/lib/repositories/collectionItemRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';
import type { Page, PageFolder, PageLayers, Component, CollectionItemWithValues, CollectionField, Layer } from '@/types';
import { getCollectionVariable, resolveFieldValue, isFieldVariable } from '@/lib/layer-utils';
import { resolveInlineVariables } from '@/lib/inline-variables';

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

            // Resolve collection layers server-side (for both draft and published)
            // The isPublished parameter controls which collection items to fetch
            const resolvedLayers = pageLayers?.layers
              ? await resolveCollectionLayers(pageLayers.layers, isPublished)
              : [];

            return {
              page: matchingPage,
              pageLayers: {
                ...pageLayers,
                layers: resolvedLayers,
              },
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

    console.log('[fetchPageByPath] Raw pageLayers from database:', {
      pageId: matchingPage.id,
      pageName: matchingPage.name,
      isPublished,
      layersCount: pageLayers?.layers?.length,
      // Recursively find layers with variables
      allLayerIds: JSON.stringify(pageLayers?.layers, null, 2).substring(0, 2000),
    });

    // Resolve collection layers server-side (for both draft and published)
    // The isPublished parameter controls which collection items to fetch
    const resolvedLayers = pageLayers?.layers
      ? await resolveCollectionLayers(pageLayers.layers, isPublished)
      : [];

    return {
      page: matchingPage,
      pageLayers: {
        ...pageLayers,
        layers: resolvedLayers,
      },
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

    // Resolve collection layers server-side (for both draft and published)
    // The isPublished parameter controls which collection items to fetch
    const resolvedLayers = pageLayers?.layers
      ? await resolveCollectionLayers(pageLayers.layers, isPublished)
      : [];

    return {
      page: errorPage,
      pageLayers: {
        ...pageLayers,
        layers: resolvedLayers,
      },
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

    console.log('[fetchHomepage] Fetching homepage with isPublished:', isPublished);
    console.log('[fetchHomepage] Raw layers from database:', JSON.stringify(pageLayers?.layers, null, 2).substring(0, 3000));

    // Resolve collection layers server-side (for both draft and published)
    const resolvedLayers = pageLayers?.layers
      ? await resolveCollectionLayers(pageLayers.layers, isPublished)
      : [];

    return {
      page: homepage,
      pageLayers: {
        ...pageLayers,
        layers: resolvedLayers,
      },
    };
  } catch (error) {
    return null;
  }
}

/**
 * Inject collection field values into a layer and its children
 * Recursively resolves field variables in text, images, etc.
 * @param layer - Layer to inject data into
 * @param itemValues - Collection item field values (field_id -> value)
 * @returns Layer with resolved field values
 */
function injectCollectionData(layer: Layer, itemValues: Record<string, string>): Layer {
  const updates: Partial<Layer> = {};
  
  // Resolve inline variables (embedded JSON format)
  const textContent = layer.variables?.text || layer.text;
  if (textContent && typeof textContent === 'string' && textContent.includes('<ycode-inline-variable>')) {
    const mockItem: CollectionItemWithValues = {
      id: 'temp',
      collection_id: 'temp',
      created_at: '',
      updated_at: '',
      deleted_at: null,
      manual_order: 0,
      is_published: true,
      values: itemValues,
    };
    const resolved = resolveInlineVariables(textContent, mockItem);

    updates.text = resolved;
    updates.variables = {
      ...layer.variables,
      text: undefined,
    };
  }
  // Direct field binding (non-inline)
  else if (layer.text && isFieldVariable(layer.text)) {
    const resolvedValue = resolveFieldValue(layer.text, itemValues);
    updates.text = resolvedValue || layer.text;
  }
  
  // Image URL field binding
  if (layer.url && isFieldVariable(layer.url)) {
    const resolvedUrl = resolveFieldValue(layer.url, itemValues);
    updates.url = resolvedUrl;
  }
  
  // Recursively process children
  const resolvedChildren = layer.children?.map(child => injectCollectionData(child, itemValues));
  if (resolvedChildren) {
    updates.children = resolvedChildren;
  }
  
  return {
    ...layer,
    ...updates,
  };
}

/**
 * Resolve collection layers server-side by fetching their data
 * Recursively traverses the layer tree and injects collection items
 * @param layers - Layer tree to resolve
 * @param isPublished - Whether to fetch published or draft items
 * @returns Layers with collection data injected
 */
export async function resolveCollectionLayers(
  layers: Layer[],
  isPublished: boolean
): Promise<Layer[]> {
  console.log('[resolveCollectionLayers] ===== START =====');
  console.log('[resolveCollectionLayers] Processing layers:', {
    layerCount: layers.length,
    isPublished,
    topLevelLayerIds: layers.map(l => l.id),
  });
  
  const resolveLayer = async (layer: Layer): Promise<Layer> => {
    console.log('[resolveCollectionLayers] Processing layer:', {
      layerId: layer.id,
      layerName: layer.name,
      hasVariables: !!layer.variables,
      hasCollectionVariable: !!layer.variables?.collection,
      collectionId: layer.variables?.collection?.id,
    });
    
    // Check if this is a collection layer
    const isCollectionLayer = !!layer.variables?.collection?.id;
    
    if (isCollectionLayer) {
      const collectionVariable = getCollectionVariable(layer);
      
      if (collectionVariable && collectionVariable.id) {
        try {
          // Fetch collection items with layer-specific settings
          const sortBy = collectionVariable.sort_by;
          const sortOrder = collectionVariable.sort_order;
          const limit = collectionVariable.limit;
          const offset = collectionVariable.offset;
          
          // Build filters for the query
          const filters: any = {};
          if (limit) filters.limit = limit;
          if (offset) filters.offset = offset;
          
          // Fetch items with values
          const { items } = await getItemsWithValues(
            collectionVariable.id,
            isPublished,
            filters
          );
          
          console.log(`[resolveCollectionLayers] Fetched items for layer ${layer.id}:`, {
            collectionId: collectionVariable.id,
            itemsCount: items.length,
            sortBy,
            sortOrder,
            limit,
            offset,
          });
          
          // Apply sorting if specified (since API doesn't handle sortBy yet)
          let sortedItems = items;
          if (sortBy && sortBy !== 'none') {
            if (sortBy === 'manual') {
              sortedItems = items.sort((a, b) => a.manual_order - b.manual_order);
            } else if (sortBy === 'random') {
              sortedItems = items.sort(() => Math.random() - 0.5);
            } else {
              // Field-based sorting
              sortedItems = items.sort((a, b) => {
                const aValue = a.values[sortBy] || '';
                const bValue = b.values[sortBy] || '';
                const aNum = parseFloat(String(aValue));
                const bNum = parseFloat(String(bValue));
                
                if (!isNaN(aNum) && !isNaN(bNum)) {
                  return sortOrder === 'desc' ? bNum - aNum : aNum - bNum;
                }
                
                const comparison = String(aValue).localeCompare(String(bValue));
                return sortOrder === 'desc' ? -comparison : comparison;
              });
            }
          }
          
          // Flatten collection items by duplicating children for each item
          const resolvedChildren = layer.children 
            ? await Promise.all(layer.children.map(resolveLayer)) 
            : [];

          console.log(`[resolveCollectionLayers] Resolved children for layer ${layer.id}:`, {
            childrenCount: resolvedChildren.length,
            sortedItemsCount: sortedItems.length,
          });

          // Create a wrapper div for each collection item with resolved children
          const flattenedChildren: Layer[] = sortedItems.map((item, index) => ({
            id: `${layer.id}-item-${item.id}`,
            name: 'div',
            classes: [] as string[],
            attributes: {
              'data-collection-item-id': item.id,
            } as Record<string, any>,
            children: resolvedChildren.map(child => 
              injectCollectionData(child, item.values)
            ),
          }));

          console.log(`[resolveCollectionLayers] Created ${flattenedChildren.length} wrapper divs for ${sortedItems.length} items`);

          return {
            ...layer,
            // Replace children with flattened collection items
            children: flattenedChildren,
            // Remove collection variable so LayerRenderer treats it as normal div
            variables: {
              ...layer.variables,
              collection: undefined,
            },
          };
        } catch (error) {
          console.error(`Failed to resolve collection layer ${layer.id}:`, error);
          return {
            ...layer,
            children: layer.children ? await Promise.all(layer.children.map(resolveLayer)) : undefined,
          };
        }
      }
    }
    
    // Recursively resolve children
    if (layer.children) {
      return {
        ...layer,
        children: await Promise.all(layer.children.map(resolveLayer)),
      };
    }
    
    return layer;
  };
  
  const result = await Promise.all(layers.map(resolveLayer));
  console.log('[resolveCollectionLayers] ===== END =====');
  console.log('[resolveCollectionLayers] Processed layers count:', result.length);
  
  return result;
}
