import { getSupabaseAdmin } from '@/lib/supabase-server';
import { buildSlugPath } from '@/lib/page-utils';
import { getItemWithValues, getItemsWithValues } from '@/lib/repositories/collectionItemRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';
import type { Page, PageFolder, PageLayers, Component, CollectionItemWithValues, CollectionField, Layer, CollectionPaginationMeta } from '@/types';
import { getCollectionVariable, resolveFieldValue, isFieldVariable, evaluateVisibility } from '@/lib/layer-utils';

// Pagination context passed through to resolveCollectionLayers
export interface PaginationContext {
  // Map of layerId -> page number (defaults to 1 if not specified)
  pageNumbers?: Record<string, number>;
  // Default page number for all collection layers (from URL ?page=N)
  defaultPage?: number;
}
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
 * @param slugPath - The URL path
 * @param isPublished - Whether to fetch published or draft version
 * @param paginationContext - Optional pagination context with page numbers from URL
 */
export async function fetchPageByPath(
  slugPath: string,
  isPublished: boolean,
  paginationContext?: PaginationContext
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

            // Resolve reference fields in the collection item values
            // This adds nested field values like "location.name" for inline variable resolution
            const enhancedItemValues = await resolveReferenceFields(
              collectionItem.values,
              collectionFields,
              isPublished
            );

            // Create enhanced collection item with resolved reference values
            const enhancedCollectionItem = {
              ...collectionItem,
              values: enhancedItemValues,
            };

            // First, inject dynamic page collection data into TOP-LEVEL layers
            // This resolves inline variables like "Name → Location" on the page
            const layersWithInjectedData = pageLayers?.layers
              ? await Promise.all(
                pageLayers.layers.map((layer: Layer) => 
                  injectCollectionData(layer, enhancedItemValues, collectionFields, isPublished)
                )
              )
              : [];

            // Then resolve collection layers (nested collections will handle their own injection)
            // The isPublished parameter controls which collection items to fetch
            // Pass enhanced values so nested collections can filter based on dynamic page data
            const resolvedLayers = layersWithInjectedData.length > 0
              ? await resolveCollectionLayers(layersWithInjectedData, isPublished, enhancedItemValues, paginationContext)
              : [];

            return {
              page: matchingPage,
              pageLayers: {
                ...pageLayers,
                layers: resolvedLayers,
              },
              components: components || [],
              collectionItem: enhancedCollectionItem, // Include enhanced collection item for dynamic pages
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
      ? await resolveCollectionLayers(pageLayers.layers, isPublished, undefined, paginationContext)
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
 * @param isPublished - Whether to fetch published or draft version
 * @param paginationContext - Optional pagination context with page numbers from URL
 */
export async function fetchHomepage(
  isPublished: boolean,
  paginationContext?: PaginationContext
): Promise<Pick<PageData, 'page' | 'pageLayers'> | null> {
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
      ? await resolveCollectionLayers(pageLayers.layers, isPublished, undefined, paginationContext)
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
  
  // Recursively process children, but SKIP collection layers
  // Collection layers will be processed by resolveCollectionLayers with their own item data
  if (layer.children) {
    const resolvedChildren = await Promise.all(
      layer.children.map(child => {
        // Skip collection layers - they'll be processed separately with correct per-item data
        if (child.variables?.collection?.id) {
          return Promise.resolve(child);
        }
        return injectCollectionData(child, enhancedValues, fields, isPublished);
      })
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
 * @param paginationContext - Optional pagination context with page numbers
 * @returns Layers with collection data injected
 */
export async function resolveCollectionLayers(
  layers: Layer[],
  isPublished: boolean,
  parentItemValues?: Record<string, string>,
  paginationContext?: PaginationContext
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
          const sourceFieldId = collectionVariable.source_field_id;
          const sourceFieldType = collectionVariable.source_field_type;
          
          // Check if pagination is enabled
          const paginationConfig = collectionVariable.pagination;
          const isPaginated = paginationConfig?.enabled && paginationConfig?.mode === 'pages';
          
          // Determine limit and offset based on pagination settings
          let limit: number | undefined;
          let offset: number | undefined;
          let currentPage = 1;
          
          if (isPaginated) {
            const itemsPerPage = paginationConfig.items_per_page || 10;
            // Get page number from context (either specific to this layer or default)
            currentPage = paginationContext?.pageNumbers?.[layer.id] 
              ?? paginationContext?.defaultPage 
              ?? 1;
            limit = itemsPerPage;
            offset = (currentPage - 1) * itemsPerPage;
          } else {
            // Use legacy limit/offset from collection variable
            limit = collectionVariable.limit;
            offset = collectionVariable.offset;
          }
          
          // Build filters for the query
          const filters: any = {};
          if (limit) filters.limit = limit;
          if (offset) filters.offset = offset;
          
          // For reference/multi-reference fields, get allowed item IDs BEFORE fetching
          // This ensures pagination counts and offsets are correct for the filtered set
          let allowedItemIds: string[] | undefined;
          if (sourceFieldId && itemValues) {
            const refValue = itemValues[sourceFieldId];
            if (refValue) {
              if (sourceFieldType === 'reference') {
                // Single reference: only one item ID
                allowedItemIds = [refValue];
                console.log(`[resolveCollectionLayers] Single reference filter for field ${sourceFieldId}:`, {
                  refItemId: refValue,
                });
              } else {
                // Multi-reference: parse JSON array of item IDs
                try {
                  const parsedIds = JSON.parse(refValue);
                  if (Array.isArray(parsedIds)) {
                    allowedItemIds = parsedIds;
                    console.log(`[resolveCollectionLayers] Multi-reference filter for field ${sourceFieldId}:`, {
                      allowedIds: parsedIds,
                    });
                  }
                } catch {
                  console.warn(`[resolveCollectionLayers] Failed to parse multi-reference value for field ${sourceFieldId}`);
                  allowedItemIds = []; // No valid items
                }
              }
            } else {
              // No value in parent item for this field - show no items
              allowedItemIds = [];
            }
          }
          
          // Pass allowed item IDs as filter so count and pagination are correct
          if (allowedItemIds !== undefined) {
            filters.itemIds = allowedItemIds;
          }
          
          // Fetch items with values - total count now reflects filtered set
          const fetchResult = await getItemsWithValues(
            collectionVariable.id,
            isPublished,
            filters
          );
          let items = fetchResult.items;
          const totalItems = fetchResult.total;
          
          console.log(`[resolveCollectionLayers] Fetched items for layer ${layer.id}:`, {
            collectionId: collectionVariable.id,
            itemsCount: items.length,
            totalItems,
            sortBy,
            sortOrder,
            limit,
            offset,
            sourceFieldId,
            sourceFieldType,
            isPaginated,
            currentPage,
            hasItemIdFilter: !!allowedItemIds,
          });
          
          // Apply collection filters (evaluate against each item's own values)
          const collectionFilters = collectionVariable.filters;
          if (collectionFilters?.groups?.length) {
            items = items.filter(item => 
              evaluateVisibility(collectionFilters, {
                collectionItemData: item.values,
                pageCollectionCounts: {},
              })
            );
            console.log(`[resolveCollectionLayers] Applied collection filters for layer ${layer.id}:`, {
              filterGroupCount: collectionFilters.groups.length,
              filteredCount: items.length,
            });
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

          console.log(`[resolveCollectionLayers] Resolving children for layer ${layer.id}:`, {
            childrenCount: layer.children?.length || 0,
            sortedItemsCount: sortedItems.length,
          });

          // Clone the collection layer for each item (design settings apply to each repeated item)
          // For each item, resolve nested collection layers with that item's values
          // Note: Pagination is now a sibling layer, not a child, so no filtering needed
          const clonedLayers: Layer[] = await Promise.all(
            sortedItems.map(async (item) => {
              // Resolve children for THIS specific item's values
              // This ensures nested collection layers filter based on this item's reference fields
              const resolvedChildren = layer.children?.length 
                ? await Promise.all(layer.children.map(child => resolveLayer(child, item.values))) 
                : [];
              
              // Then inject field data into the resolved children
              const injectedChildren = await Promise.all(
                resolvedChildren.map(child => 
                  injectCollectionData(child, item.values, collectionFields, isPublished)
                )
              );
              
              return {
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
                children: injectedChildren,
                // Store item values for visibility filtering (SSR only, not serialized to client)
                _collectionItemValues: item.values,
              } as Layer;
            })
          );

          console.log(`[resolveCollectionLayers] Cloned collection layer into ${clonedLayers.length} items`);

          // Build pagination metadata if pagination is enabled
          let paginationMeta: CollectionPaginationMeta | undefined;
          if (isPaginated && paginationConfig) {
            const itemsPerPage = paginationConfig.items_per_page || 10;
            paginationMeta = {
              currentPage,
              totalPages: Math.ceil(totalItems / itemsPerPage),
              totalItems,
              itemsPerPage,
              layerId: layer.id,
              collectionId: collectionVariable.id,
            };
            console.log(`[resolveCollectionLayers] Pagination meta for layer ${layer.id}:`, paginationMeta);
          }

          // Build children array - just the cloned items
          // Pagination is now a sibling layer, not added here
          const fragmentChildren = clonedLayers;

          // Return a fragment layer - LayerRenderer will render children directly without wrapper
          return {
            ...layer,
            id: `${layer.id}-fragment`,
            name: '_fragment',  // Special marker for LayerRenderer to unwrap
            classes: [],
            design: undefined,
            attributes: {} as Record<string, any>,
            children: fragmentChildren,
            variables: {
              ...layer.variables,
              collection: undefined,
            },
            // Store pagination meta for client hydration (SSR only)
            _paginationMeta: paginationMeta,
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
  
  // Collect pagination metadata from all fragments
  const paginationMetaMap: Record<string, CollectionPaginationMeta> = {};
  function collectPaginationMeta(layerList: Layer[]) {
    for (const layer of layerList) {
      if (layer._paginationMeta) {
        const originalId = layer.id.replace('-fragment', '');
        paginationMetaMap[originalId] = layer._paginationMeta;
      }
      if (layer.children) {
        collectPaginationMeta(layer.children);
      }
    }
  }
  collectPaginationMeta(result);
  
  // Update pagination sibling layers with correct meta
  function updatePaginationSiblings(layerList: Layer[]): Layer[] {
    return layerList.map(layer => {
      // Check if this is a pagination wrapper (has data-pagination-for attribute)
      const paginationFor = layer.attributes?.['data-pagination-for'];
      if (paginationFor && paginationMetaMap[paginationFor]) {
        // Update this pagination layer with the meta
        return updatePaginationLayerWithMeta(layer, paginationMetaMap[paginationFor]);
      }
      
      // Recursively update children
      if (layer.children) {
        return {
          ...layer,
          children: updatePaginationSiblings(layer.children),
        };
      }
      
      return layer;
    });
  }
  
  const resultWithPagination = updatePaginationSiblings(result);
  
  // Third pass: Filter layers by conditional visibility
  // We need to compute collection counts first, then filter
  const filteredResult = filterByVisibility(resultWithPagination, parentItemValues);
  
  return filteredResult;
}

/**
 * Compute item counts for all collection layers in a layer tree
 * Used for evaluating page collection visibility conditions
 */
function computeCollectionCounts(layers: Layer[]): Record<string, number> {
  const counts: Record<string, number> = {};
  
  function traverse(layerList: Layer[]) {
    for (const layer of layerList) {
      // If this is a fragment containing cloned collection items, count them
      if (layer.name === '_fragment' && layer.children) {
        // Find the original layer ID (before -fragment suffix)
        const originalId = layer.id.replace('-fragment', '');
        counts[originalId] = layer.children.length;
      }
      
      // Also check for pre-resolved collection items
      if (layer._collectionItems) {
        counts[layer.id] = layer._collectionItems.length;
      }
      
      if (layer.children) {
        traverse(layer.children);
      }
    }
  }
  
  traverse(layers);
  return counts;
}

/**
 * Filter layers by conditional visibility rules
 * @param layers - Layer tree to filter
 * @param itemValues - Current collection item values for field conditions
 * @returns Filtered layer tree with hidden layers removed
 */
function filterByVisibility(
  layers: Layer[],
  itemValues?: Record<string, string>
): Layer[] {
  // First compute all collection counts
  const pageCollectionCounts = computeCollectionCounts(layers);
  
  function filterLayer(layer: Layer, currentItemValues?: Record<string, string>): Layer | null {
    // Use stored item values from cloned collection layers if available
    // This ensures children of collection items have access to the correct item values
    const effectiveItemValues = layer._collectionItemValues || currentItemValues;
    
    // Check conditional visibility
    const conditionalVisibility = layer.variables?.conditionalVisibility;
    if (conditionalVisibility && conditionalVisibility.groups?.length > 0) {
      const isVisible = evaluateVisibility(conditionalVisibility, {
        collectionItemData: effectiveItemValues,
        pageCollectionCounts,
      });
      if (!isVisible) {
        return null;
      }
    }
    
    // Recursively filter children, passing down the effective item values
    if (layer.children) {
      const filteredChildren = layer.children
        .map(child => filterLayer(child, effectiveItemValues))
        .filter((child): child is Layer => child !== null);
      
      return {
        ...layer,
        children: filteredChildren,
      };
    }
    
    return layer;
  }
  
  return layers
    .map(layer => filterLayer(layer, itemValues))
    .filter((layer): layer is Layer => layer !== null);
}

/**
 * Update a pagination layer with dynamic meta (page info text, button states)
 * @param layer - The pagination layer to update
 * @param meta - Pagination metadata
 * @returns Updated layer with dynamic content
 */
function updatePaginationLayerWithMeta(layer: Layer, meta: CollectionPaginationMeta): Layer {
  const { currentPage, totalPages } = meta;
  
  // Deep clone to avoid mutation
  const updatedLayer: Layer = JSON.parse(JSON.stringify(layer));
  
  // Helper to recursively update layers
  function updateLayerRecursive(l: Layer): void {
    // Update page info text
    if (l.id?.endsWith('-pagination-info')) {
      l.text = `Page ${currentPage} of ${totalPages}`;
    }
    
    // Update previous button state
    if (l.id?.endsWith('-pagination-prev')) {
      const isFirstPage = currentPage <= 1;
      l.attributes = l.attributes || {};
      l.attributes['data-current-page'] = String(currentPage);
      if (isFirstPage) {
        l.attributes.disabled = true;
        l.classes = Array.isArray(l.classes) 
          ? [...l.classes, 'opacity-50', 'cursor-not-allowed']
          : `${l.classes || ''} opacity-50 cursor-not-allowed`;
      }
    }
    
    // Update next button state
    if (l.id?.endsWith('-pagination-next')) {
      const isLastPage = currentPage >= totalPages;
      l.attributes = l.attributes || {};
      l.attributes['data-current-page'] = String(currentPage);
      if (isLastPage) {
        l.attributes.disabled = true;
        l.classes = Array.isArray(l.classes) 
          ? [...l.classes, 'opacity-50', 'cursor-not-allowed']
          : `${l.classes || ''} opacity-50 cursor-not-allowed`;
      }
    }
    
    // Recursively update children
    if (l.children) {
      l.children.forEach(updateLayerRecursive);
    }
  }
  
  updateLayerRecursive(updatedLayer);
  return updatedLayer;
}

/**
 * Generate a pagination wrapper layer with Previous/Next buttons
 * This is injected as a sibling after the collection fragment
 * @param collectionLayerId - Original collection layer ID
 * @param paginationMeta - Pagination metadata
 * @returns Layer structure for pagination controls
 */
export function generatePaginationWrapper(
  collectionLayerId: string,
  paginationMeta: CollectionPaginationMeta
): Layer {
  const { currentPage, totalPages } = paginationMeta;
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  return {
    id: `${collectionLayerId}-pagination`,
    name: 'div',
    classes: 'flex items-center justify-center gap-4 mt-4',
    children: [
      // Previous Button
      {
        id: `${collectionLayerId}-pagination-prev`,
        name: 'button',
        classes: `px-4 py-2 rounded bg-[#e5e7eb] hover:bg-[#d1d5db] transition-colors ${isFirstPage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`,
        settings: {
          tag: 'button',
        },
        attributes: {
          'data-pagination-action': 'prev',
          'data-collection-layer-id': collectionLayerId,
          'data-current-page': String(currentPage),
          ...(isFirstPage ? { disabled: true } : {}),
        } as Record<string, any>,
        children: [
          {
            id: `${collectionLayerId}-pagination-prev-text`,
            name: 'span',
            text: 'Previous',
          } as Layer,
        ],
      } as Layer,
      // Page indicator
      {
        id: `${collectionLayerId}-pagination-info`,
        name: 'span',
        classes: 'text-sm text-[#4b5563]',
        text: `Page ${currentPage} of ${totalPages}`,
      } as Layer,
      // Next Button
      {
        id: `${collectionLayerId}-pagination-next`,
        name: 'button',
        classes: `px-4 py-2 rounded bg-[#e5e7eb] hover:bg-[#d1d5db] transition-colors ${isLastPage ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`,
        settings: {
          tag: 'button',
        },
        attributes: {
          'data-pagination-action': 'next',
          'data-collection-layer-id': collectionLayerId,
          'data-current-page': String(currentPage),
          ...(isLastPage ? { disabled: true } : {}),
        } as Record<string, any>,
        children: [
          {
            id: `${collectionLayerId}-pagination-next-text`,
            name: 'span',
            text: 'Next',
          } as Layer,
        ],
      } as Layer,
    ],
    attributes: {
      'data-pagination-wrapper': 'true',
      'data-collection-layer-id': collectionLayerId,
    } as Record<string, any>,
  } as Layer;
}
