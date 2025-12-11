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
 * Resolve reference field values by fetching referenced item data
 * Adds referenced item's fields with a prefix based on the field path
 * @param itemValues - Current item values (field_id -> value)
 * @param fields - Collection fields to check for references
 * @param isPublished - Whether to fetch published data
 * @returns Enhanced item values with resolved reference data
 */
async function resolveReferenceFields(
  itemValues: Record<string, string>,
  fields: CollectionField[],
  isPublished: boolean,
  pathPrefix: string = '',
  visited: Set<string> = new Set()
): Promise<Record<string, string>> {
  const enhancedValues = { ...itemValues };
  
  // Find reference fields (single reference only - multi-reference is used for collection sources)
  const referenceFields = fields.filter(
    f => f.type === 'reference' && f.reference_collection_id
  );
  
  for (const field of referenceFields) {
    const refItemId = itemValues[field.id];
    if (!refItemId || !field.reference_collection_id) continue;
    
    // Prevent infinite loops from circular references
    const visitKey = `${field.id}:${refItemId}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);
    
    try {
      // Fetch the referenced item
      const refItem = await getItemWithValues(refItemId, isPublished);
      if (!refItem) continue;
      
      // Get fields for the referenced collection
      const refFields = await getFieldsByCollectionId(field.reference_collection_id, isPublished);
      
      // Build the path prefix for this level
      const currentPath = pathPrefix ? `${pathPrefix}.${field.id}` : field.id;
      
      // Add referenced item's values with the current path as prefix
      // e.g., if field is "Author" with id "abc123", and referenced item has "name" field with id "xyz789"
      // the value becomes accessible as "abc123.xyz789" in the values map
      for (const refField of refFields) {
        const refValue = refItem.values[refField.id];
        if (refValue !== undefined) {
          // Store as: parentFieldId.refFieldId for relationship path resolution
          enhancedValues[`${currentPath}.${refField.id}`] = refValue;
        }
      }
      
      // Recursively resolve nested reference fields
      const nestedValues = await resolveReferenceFields(
        refItem.values,
        refFields,
        isPublished,
        currentPath,
        visited
      );
      
      // Merge nested values (they'll have the full path)
      Object.assign(enhancedValues, nestedValues);
    } catch (error) {
      console.error(`Failed to resolve reference field ${field.id}:`, error);
    }
  }
  
  return enhancedValues;
}

/**
 * Inject collection field values into a layer and its children
 * Recursively resolves field variables in text, images, etc.
 * @param layer - Layer to inject data into
 * @param itemValues - Collection item field values (field_id -> value)
 * @param fields - Optional collection fields (for reference field resolution)
 * @param isPublished - Whether fetching published data
 * @returns Layer with resolved field values
 */
async function injectCollectionData(
  layer: Layer,
  itemValues: Record<string, string>,
  fields?: CollectionField[],
  isPublished: boolean = true
): Promise<Layer> {
  // Resolve reference fields if we have field definitions
  let enhancedValues = itemValues;
  if (fields && fields.length > 0) {
    enhancedValues = await resolveReferenceFields(itemValues, fields, isPublished);
  }
  
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
      values: enhancedValues,
    };
    const resolved = resolveInlineVariablesWithRelationships(textContent, mockItem);

    updates.text = resolved;
    updates.variables = {
      ...layer.variables,
      text: undefined,
    };
  }
  // Direct field binding (non-inline)
  else if (layer.text && isFieldVariable(layer.text)) {
    const resolvedValue = resolveFieldValueWithRelationships(layer.text, enhancedValues);
    updates.text = resolvedValue || layer.text;
  }
  
  // Image URL field binding
  if (layer.url && isFieldVariable(layer.url)) {
    const resolvedUrl = resolveFieldValueWithRelationships(layer.url, enhancedValues);
    updates.url = resolvedUrl;
  }
  
  // Recursively process children
  if (layer.children) {
    const resolvedChildren = await Promise.all(
      layer.children.map(child => injectCollectionData(child, enhancedValues, fields, isPublished))
    );
    updates.children = resolvedChildren;
  }
  
  return {
    ...layer,
    ...updates,
  };
}

/**
 * Resolve inline variables with support for relationship paths
 * e.g., {"type":"field","data":{"field_id":"authorId","relationships":["nameFieldId"]}}
 */
function resolveInlineVariablesWithRelationships(
  text: string,
  collectionItem: CollectionItemWithValues
): string {
  if (!collectionItem || !collectionItem.values) {
    return text;
  }

  const regex = /<ycode-inline-variable>([\s\S]*?)<\/ycode-inline-variable>/g;
  return text.replace(regex, (match, variableContent) => {
    try {
      const parsed = JSON.parse(variableContent.trim());

      if (parsed.type === 'field' && parsed.data?.field_id) {
        const fieldId = parsed.data.field_id;
        const relationships = parsed.data.relationships || [];
        
        // Build the full path for relationship resolution
        if (relationships.length > 0) {
          const fullPath = [fieldId, ...relationships].join('.');
          const fieldValue = collectionItem.values[fullPath];
          return fieldValue || '';
        }
        
        // Simple field lookup
        const fieldValue = collectionItem.values[fieldId];
        return fieldValue || '';
      }
    } catch {
      // Invalid JSON or not a field variable, leave as is
    }

    return match;
  });
}

/**
 * Resolve field value with support for relationship paths
 */
function resolveFieldValueWithRelationships(
  fieldVariable: { type: 'field'; data: { field_id: string; relationships?: string[]; format?: string } },
  itemValues: Record<string, string>
): string | undefined {
  const { field_id, relationships = [] } = fieldVariable.data;
  
  // Build the full path for relationship resolution
  if (relationships.length > 0) {
    const fullPath = [field_id, ...relationships].join('.');
    return itemValues[fullPath];
  }
  
  return itemValues[field_id];
}

/**
 * Resolve collection layers server-side by fetching their data
 * Recursively traverses the layer tree and injects collection items
 * @param layers - Layer tree to resolve
 * @param isPublished - Whether to fetch published or draft items
 * @param parentItemValues - Optional parent item values for multi-reference filtering
 * @returns Layers with collection data injected
 */
export async function resolveCollectionLayers(
  layers: Layer[],
  isPublished: boolean,
  parentItemValues?: Record<string, string>
): Promise<Layer[]> {
  console.log('[resolveCollectionLayers] ===== START =====');
  console.log('[resolveCollectionLayers] Processing layers:', {
    layerCount: layers.length,
    isPublished,
    topLevelLayerIds: layers.map(l => l.id),
    hasParentItemValues: !!parentItemValues,
  });
  
  const resolveLayer = async (layer: Layer, itemValues?: Record<string, string>): Promise<Layer> => {
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
          const sourceFieldId = collectionVariable.source_field_id;
          
          // Build filters for the query
          const filters: any = {};
          if (limit) filters.limit = limit;
          if (offset) filters.offset = offset;
          
          // Fetch items with values
          let { items } = await getItemsWithValues(
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
            sourceFieldId,
          });
          
          // Filter by multi-reference field if source_field_id is set
          if (sourceFieldId && itemValues) {
            const refValue = itemValues[sourceFieldId];
            if (refValue) {
              try {
                const allowedIds = JSON.parse(refValue);
                if (Array.isArray(allowedIds)) {
                  items = items.filter(item => allowedIds.includes(item.id));
                  console.log(`[resolveCollectionLayers] Filtered by multi-reference field ${sourceFieldId}:`, {
                    allowedIds,
                    filteredCount: items.length,
                  });
                }
              } catch {
                console.warn(`[resolveCollectionLayers] Failed to parse multi-reference value for field ${sourceFieldId}`);
                items = [];
              }
            } else {
              // No value in parent item for this field - show no items
              items = [];
            }
          }
          
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
          
          // Fetch collection fields for reference resolution
          const collectionFields = await getFieldsByCollectionId(collectionVariable.id, isPublished);

          // Flatten collection items by duplicating children for each item
          // Pass the current item values to children for nested multi-reference support
          const resolvedChildren = layer.children 
            ? await Promise.all(layer.children.map(child => resolveLayer(child, itemValues))) 
            : [];

          console.log(`[resolveCollectionLayers] Resolved children for layer ${layer.id}:`, {
            childrenCount: resolvedChildren.length,
            sortedItemsCount: sortedItems.length,
          });

          // Clone the collection layer for each item (design settings apply to each repeated item)
          const clonedLayers: Layer[] = await Promise.all(
            sortedItems.map(async (item) => ({
              ...layer,  // Clone all properties including classes, design, name, etc.
              id: `${layer.id}-item-${item.id}`,
              attributes: {
                ...layer.attributes,
                'data-collection-item-id': item.id,
              } as Record<string, any>,
              variables: {
                ...layer.variables,
                collection: undefined,  // Remove collection binding from clone
              },
              children: await Promise.all(
                resolvedChildren.map(child => 
                  injectCollectionData(child, item.values, collectionFields, isPublished)
                )
              ),
            }))
          );

          console.log(`[resolveCollectionLayers] Cloned collection layer into ${clonedLayers.length} items`);

          // Return a transparent wrapper containing the cloned layers
          // The wrapper has no styling - all design is on the cloned children
          return {
            ...layer,
            id: `${layer.id}-wrapper`,
            name: 'div',
            classes: [],  // Clear classes so wrapper is invisible
            design: undefined,  // Clear design so wrapper has no styling
            attributes: {
              'data-collection-wrapper': 'true',
            } as Record<string, any>,
            children: clonedLayers,
            variables: {
              ...layer.variables,
              collection: undefined,
            },
          };
        } catch (error) {
          console.error(`Failed to resolve collection layer ${layer.id}:`, error);
          return {
            ...layer,
            children: layer.children ? await Promise.all(layer.children.map(child => resolveLayer(child, itemValues))) : undefined,
          };
        }
      }
    }
    
    // Recursively resolve children, passing current item values
    if (layer.children) {
      return {
        ...layer,
        children: await Promise.all(layer.children.map(child => resolveLayer(child, itemValues))),
      };
    }
    
    return layer;
  };
  
  const result = await Promise.all(layers.map(layer => resolveLayer(layer, parentItemValues)));
  console.log('[resolveCollectionLayers] ===== END =====');
  console.log('[resolveCollectionLayers] Processed layers count:', result.length);
  
  return result;
}
