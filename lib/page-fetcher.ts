import { getSupabaseAdmin } from '@/lib/supabase-server';
import { buildSlugPath, detectLocaleFromPath, matchPageWithTranslatedSlugs, matchDynamicPageWithTranslatedSlugs } from '@/lib/page-utils';
import { getItemWithValues, getItemsWithValues } from '@/lib/repositories/collectionItemRepository';
import { getFieldsByCollectionId } from '@/lib/repositories/collectionFieldRepository';
import type { Page, PageFolder, PageLayers, Component, CollectionItemWithValues, CollectionField, Layer, CollectionPaginationMeta, Translation, Locale } from '@/types';
import { getCollectionVariable, resolveFieldValue, evaluateVisibility } from '@/lib/layer-utils';
import { isFieldVariable, isAssetVariable, createDynamicTextVariable, createAssetVariable, getDynamicTextContent, getVariableStringValue, getAssetId } from '@/lib/variable-utils';
import { generateImageSrcset, getImageSizes, getOptimizedImageUrl } from '@/lib/asset-utils';
import { resolveComponents } from '@/lib/resolve-components';

// Pagination context passed through to resolveCollectionLayers
export interface PaginationContext {
  // Map of layerId -> page number (defaults to 1 if not specified)
  pageNumbers?: Record<string, number>;
  // Default page number for all collection layers (from URL ?page=N)
  defaultPage?: number;
}
import { resolveInlineVariables } from '@/lib/inline-variables';
import { buildLayerTranslationKey, getTranslationByKey, hasValidTranslationValue, getTranslationValue } from '@/lib/localisation-utils';

export interface PageData {
  page: Page;
  pageLayers: PageLayers;
  components: Component[];
  collectionItem?: CollectionItemWithValues; // For dynamic pages
  collectionFields?: CollectionField[]; // For dynamic pages
  locale?: Locale | null; // Current locale (if detected from URL)
  availableLocales?: Locale[]; // All active locales for locale switcher
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
 * Load translations for a locale from the database
 * @param localeCode - The locale code (e.g., "fr", "en")
 * @param isPublished - Whether to fetch published translations
 * @returns Map of translations keyed by translatable key (source_type:source_id:content_key)
 */
async function loadTranslationsForLocale(
  localeCode: string,
  isPublished: boolean
): Promise<{ locale: Locale | null; translations: Record<string, Translation> }> {
  try {
    const supabase = await getSupabaseAdmin();

    if (!supabase) {
      return { locale: null, translations: {} };
    }

    // Find the locale by code
    const { data: locale } = await supabase
      .from('locales')
      .select('*')
      .eq('code', localeCode)
      .eq('is_published', isPublished)
      .is('deleted_at', null)
      .single();

    if (!locale) {
      return { locale: null, translations: {} };
    }

    // Fetch all translations for this locale
    const { data: translations } = await supabase
      .from('translations')
      .select('*')
      .eq('locale_id', locale.id)
      .eq('is_published', isPublished)
      .is('deleted_at', null);

    if (!translations) {
      return { locale, translations: {} };
    }

    // Build translations map keyed by translatable key
    const translationsMap: Record<string, Translation> = {};
    for (const translation of translations) {
      const key = `${translation.source_type}:${translation.source_id}:${translation.content_key}`;
      translationsMap[key] = translation;
    }

    return { locale, translations: translationsMap };
  } catch (error) {
    console.error('Failed to load translations for locale:', localeCode, error);
    return { locale: null, translations: {} };
  }
}

/**
 * Fetch collection item by slug field value (supports translated slugs)
 * @param collectionId - Collection UUID
 * @param slugFieldId - Field ID for the slug field
 * @param slugValue - The slug value to match (could be original or translated)
 * @param isPublished - Get draft (false) or published (true) version
 * @param collectionFields - Collection fields (needed to build translation keys)
 * @param locale - Current locale (for translated slug lookup)
 * @param translations - Translations map (for translated slug lookup)
 */
async function getCollectionItemBySlug(
  collectionId: string,
  slugFieldId: string,
  slugValue: string,
  isPublished: boolean,
  collectionFields?: CollectionField[],
  locale?: Locale | null,
  translations?: Record<string, Translation>
): Promise<CollectionItemWithValues | null> {
  try {
    const supabase = await getSupabaseAdmin();

    if (!supabase) {
      return null;
    }

    // If locale and translations are provided, try to find item by translated slug first
    if (locale && translations && collectionFields) {
      const slugField = collectionFields.find(f => f.id === slugFieldId);

      if (slugField) {
        // Build content_key for the slug field
        const contentKey = slugField.key
          ? `field:key:${slugField.key}`
          : `field:id:${slugField.id}`;

        // Search through translations to find which item has this translated slug
        for (const [translationKey, translation] of Object.entries(translations)) {
          // Translation key format: cms:{itemId}:{contentKey}
          if (translation.content_value === slugValue && translationKey.endsWith(contentKey)) {
            // Extract item ID from translation key
            const itemId = translation.source_id;

            // Verify this item belongs to the correct collection
            const { data: item, error: itemError } = await supabase
              .from('collection_items')
              .select('*')
              .eq('id', itemId)
              .eq('collection_id', collectionId)
              .eq('is_published', isPublished)
              .is('deleted_at', null)
              .single();

            if (!itemError && item) {
              // Found the item via translation - return it with all values
              return await getItemWithValues(item.id, isPublished);
            }
          }
        }
      }
    }

    // Fall back to original slug lookup (no translation or translation not found)
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
 * Supports localized URLs with translated slugs
 * @param slugPath - The URL path (may include locale prefix like "fr/products/item")
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

    // Get all active locales from the database
    const { data: availableLocales } = await supabase
      .from('locales')
      .select('*')
      .eq('is_published', isPublished)
      .is('deleted_at', null);

    const validLocaleCodes = availableLocales?.map(l => l.code) || [];

    // Detect locale from URL path using database locale codes
    const localeDetection = detectLocaleFromPath(slugPath, validLocaleCodes);
    const pathWithoutLocale = localeDetection?.remainingPath ?? slugPath;

    // Load translations if locale detected
    let translations: Record<string, Translation> | undefined;
    let detectedLocale: Locale | null = null;

    if (localeDetection) {
      const { locale, translations: trans } = await loadTranslationsForLocale(
        localeDetection.localeCode,
        isPublished
      );
      detectedLocale = locale;
      translations = trans;

      console.log('[fetchPageByPath] Detected locale:', {
        localeCode: localeDetection.localeCode,
        locale: detectedLocale,
        translationsCount: Object.keys(translations).length,
        pathWithoutLocale,
      });
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

    // Fetch all components once at the start
    const components = await fetchComponents(supabase);

    const targetPath = pathWithoutLocale;

    // If path is empty after locale detection (e.g., "/fr/" -> "fr" -> ""),
    // try to fetch the homepage
    if (targetPath === '' && detectedLocale) {
      const homepageData = await fetchHomepage(isPublished, paginationContext);
      if (homepageData) {
        // Resolve components and apply translations
        let processedLayers = applyComponentsAndTranslations(
          homepageData.pageLayers.layers || [],
          homepageData.page.id,
          components,
          translations
        );

        // Resolve all AssetVariables to URLs server-side (prevents client-side API calls)
        processedLayers = await resolveAllAssets(processedLayers);

        return {
          ...homepageData,
          pageLayers: {
            ...homepageData.pageLayers,
            layers: processedLayers,
          },
          components: [],  // Components already resolved into layers
          locale: detectedLocale,
          availableLocales: availableLocales as Locale[] || [],
        };
      }
      return null;
    }

    // First, try to find an exact match (non-dynamic page)
    // Use translated slug matching if translations are available
    let matchingPage = pages.find((page: Page) => {
      if (page.is_dynamic) return false; // Skip dynamic pages for exact match

      // If we have translations, match using translated slugs
      if (translations) {
        return matchPageWithTranslatedSlugs(targetPath, page, folders as PageFolder[], translations);
      }

      // Otherwise, use default slug matching
      const fullPath = buildSlugPath(page, folders as PageFolder[], 'page');
      return fullPath === `/${targetPath}`;
    });

    // If no exact match, try dynamic pages
    if (!matchingPage) {
      // Find all dynamic pages and check if URL matches their pattern
      const dynamicPages = pages.filter((page: Page) => page.is_dynamic);

      for (const dynamicPage of dynamicPages) {
        let extractedSlug: string | null = null;

        // Match using translated slugs if available
        if (translations) {
          extractedSlug = matchDynamicPageWithTranslatedSlugs(
            targetPath,
            dynamicPage,
            folders as PageFolder[],
            translations
          );
        } else {
          // Use default slug matching
          const patternPath = buildSlugPath(dynamicPage, folders as PageFolder[], 'page', '{slug}');
          extractedSlug = matchDynamicPagePattern(`/${targetPath}`, patternPath);
        }

        if (extractedSlug) {
          // Found a matching dynamic page pattern
          matchingPage = dynamicPage;

          // Fetch the collection item by slug value (supports translated slugs)
          const cmsSettings = dynamicPage.settings?.cms;
          if (cmsSettings?.collection_id && cmsSettings?.slug_field_id) {
            // Fetch collection fields (needed for translation key lookup and custom code placeholders)
            const collectionFields = await getFieldsByCollectionId(
              cmsSettings.collection_id,
              isPublished
            );

            const collectionItem = await getCollectionItemBySlug(
              cmsSettings.collection_id,
              cmsSettings.slug_field_id,
              extractedSlug,
              isPublished,
              collectionFields,
              detectedLocale,
              translations
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

            // Resolve reference fields in the collection item values
            // This adds nested field values like "location.name" for inline variable resolution
            let enhancedItemValues = await resolveReferenceFields(
              collectionItem.values,
              collectionFields,
              isPublished
            );

            // Apply CMS translations to the item values
            enhancedItemValues = applyCmsTranslations(collectionItem.id, enhancedItemValues, collectionFields, translations);

            // Create enhanced collection item with resolved reference values and translations
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
            let resolvedLayers = layersWithInjectedData.length > 0
              ? await resolveCollectionLayers(layersWithInjectedData, isPublished, enhancedItemValues, paginationContext, translations)
              : [];

            // Resolve components and apply translations
            resolvedLayers = applyComponentsAndTranslations(
              resolvedLayers,
              matchingPage.id,
              components,
              detectedLocale ? translations : undefined
            );

            // Resolve all AssetVariables to URLs server-side (prevents client-side API calls)
            resolvedLayers = await resolveAllAssets(resolvedLayers);

            return {
              page: matchingPage,
              pageLayers: {
                ...pageLayers,
                layers: resolvedLayers,
              },
              components: [],  // Components already resolved into layers
              collectionItem: enhancedCollectionItem, // Include enhanced collection item for dynamic pages
              collectionFields, // Include collection fields for resolving placeholders
              locale: detectedLocale,
              availableLocales: availableLocales as Locale[] || [],
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

    // Resolve collection layers server-side (for both draft and published)
    // The isPublished parameter controls which collection items to fetch
    let resolvedLayers = pageLayers?.layers
      ? await resolveCollectionLayers(pageLayers.layers, isPublished, undefined, paginationContext, translations)
      : [];

    // Resolve components and apply translations
    resolvedLayers = applyComponentsAndTranslations(
      resolvedLayers,
      matchingPage.id,
      components,
      detectedLocale ? translations : undefined
    );

    // Resolve all AssetVariables to URLs server-side (prevents client-side API calls)
    resolvedLayers = await resolveAllAssets(resolvedLayers);

    return {
      page: matchingPage,
      pageLayers: {
        ...pageLayers,
        layers: resolvedLayers,
      },
      components: [],  // Components already resolved into layers
      locale: detectedLocale,
      availableLocales: availableLocales as Locale[] || [],
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

    // Get all active locales from the database
    const { data: availableLocales } = await supabase
      .from('locales')
      .select('*')
      .eq('is_published', isPublished)
      .is('deleted_at', null);

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

    const components = await fetchComponents(supabase);

    // Resolve collection layers server-side (for both draft and published)
    // The isPublished parameter controls which collection items to fetch
    let resolvedLayers = pageLayers?.layers
      ? await resolveCollectionLayers(pageLayers.layers, isPublished, undefined, undefined, undefined)
      : [];

    // Resolve all AssetVariables to URLs server-side (prevents client-side API calls)
    resolvedLayers = await resolveAllAssets(resolvedLayers);

    return {
      page: errorPage,
      pageLayers: {
        ...pageLayers,
        layers: resolvedLayers,
      },
      components,
      locale: null, // Error pages don't have locale context
      availableLocales: availableLocales as Locale[] || [],
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
): Promise<Pick<PageData, 'page' | 'pageLayers' | 'locale' | 'availableLocales'> | null> {
  try {
    const supabase = await getSupabaseAdmin();

    if (!supabase) {
      return null;
    }

    // Get all active locales from the database
    const { data: availableLocales } = await supabase
      .from('locales')
      .select('*')
      .eq('is_published', isPublished)
      .is('deleted_at', null);

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

    // Resolve collection layers server-side (for both draft and published)
    let resolvedLayers = pageLayers?.layers
      ? await resolveCollectionLayers(pageLayers.layers, isPublished, undefined, paginationContext, undefined)
      : [];

    // Resolve all AssetVariables to URLs server-side (prevents client-side API calls)
    resolvedLayers = await resolveAllAssets(resolvedLayers);

    return {
      page: homepage,
      pageLayers: {
        ...pageLayers,
        layers: resolvedLayers,
      },
      locale: null, // Homepage accessed without locale prefix
      availableLocales: availableLocales as Locale[] || [],
    };
  } catch (error) {
    return null;
  }
}

/**
 * Inject translated text and assets into layers recursively
 * Replaces layer text content and asset sources with translations when available
 * Handles both page-level and component-level translations
 * @param layers - Layer tree to translate
 * @param pageId - Page ID for building translation keys
 * @param translations - Translations map
 * @returns Layers with translated text and assets
 */
function injectTranslatedText(
  layers: Layer[],
  pageId: string,
  translations: Record<string, Translation>
): Layer[] {
  return layers.map(layer => {
    const updates: Partial<Layer> = {};
    const variableUpdates: Partial<Layer['variables']> = {};

    // 1. Inject text translation
    const textTranslationKey = buildLayerTranslationKey(pageId, `layer:${layer.id}:text`, layer._masterComponentId);
    const textTranslation = getTranslationByKey(translations, textTranslationKey);

    const textValue = getTranslationValue(textTranslation);
    if (textValue) {
      variableUpdates.text = createDynamicTextVariable(textValue);
    }

    // 2. Inject asset translations for media layers
    // Image layer - translate src and alt text
    if (layer.name === 'image') {
      const imageSrcKey = buildLayerTranslationKey(pageId, `layer:${layer.id}:image_src`, layer._masterComponentId);
      const imageSrcTranslation = getTranslationByKey(translations, imageSrcKey);
      const imageAltKey = buildLayerTranslationKey(pageId, `layer:${layer.id}:image_alt`, layer._masterComponentId);
      const imageAltTranslation = getTranslationByKey(translations, imageAltKey);

      if (imageSrcTranslation || imageAltTranslation) {
        const imageUpdates: any = { ...layer.variables?.image };

        if (imageSrcTranslation && imageSrcTranslation.content_value) {
          imageUpdates.src = createAssetVariable(imageSrcTranslation.content_value);
        }

        const imageAltValue = getTranslationValue(imageAltTranslation);
        if (imageAltValue) {
          imageUpdates.alt = createDynamicTextVariable(imageAltValue);
        } else {
          // Preserve original alt if no translation
          imageUpdates.alt = layer.variables?.image?.alt || createDynamicTextVariable('');
        }

        variableUpdates.image = imageUpdates;
      }
    }

    // Video layer - translate src and poster
    if (layer.name === 'video') {
      const videoSrcKey = buildLayerTranslationKey(pageId, `layer:${layer.id}:video_src`, layer._masterComponentId);
      const videoSrcTranslation = getTranslationByKey(translations, videoSrcKey);
      const videoPosterKey = buildLayerTranslationKey(pageId, `layer:${layer.id}:video_poster`, layer._masterComponentId);
      const videoPosterTranslation = getTranslationByKey(translations, videoPosterKey);

      if (videoSrcTranslation || videoPosterTranslation) {
        const videoUpdates: any = { ...layer.variables?.video };

        if (videoSrcTranslation && videoSrcTranslation.content_value) {
          videoUpdates.src = createAssetVariable(videoSrcTranslation.content_value);
        }

        if (videoPosterTranslation && videoPosterTranslation.content_value) {
          videoUpdates.poster = createAssetVariable(videoPosterTranslation.content_value);
        }

        variableUpdates.video = videoUpdates;
      }
    }

    // Audio layer - translate src
    if (layer.name === 'audio') {
      const audioSrcKey = buildLayerTranslationKey(pageId, `layer:${layer.id}:audio_src`, layer._masterComponentId);
      const audioSrcTranslation = getTranslationByKey(translations, audioSrcKey);

      if (audioSrcTranslation && audioSrcTranslation.content_value) {
        variableUpdates.audio = {
          src: createAssetVariable(audioSrcTranslation.content_value),
        };
      }
    }

    // Icon layer - translate src
    if (layer.name === 'icon') {
      const iconSrcKey = buildLayerTranslationKey(pageId, `layer:${layer.id}:icon_src`, layer._masterComponentId);
      const iconSrcTranslation = getTranslationByKey(translations, iconSrcKey);

      if (iconSrcTranslation && iconSrcTranslation.content_value) {
        variableUpdates.icon = {
          src: createAssetVariable(iconSrcTranslation.content_value),
        };
      }
    }

    // Apply variable updates if any
    if (Object.keys(variableUpdates).length > 0) {
      updates.variables = {
        ...layer.variables,
        ...variableUpdates,
      };
    }

    // Recursively process children
    if (layer.children && layer.children.length > 0) {
      updates.children = injectTranslatedText(layer.children, pageId, translations);
    }

    return {
      ...layer,
      ...updates,
    };
  });
}

/**
 * Fetch all components from the database
 * @param supabase - Supabase client
 * @returns Array of components or empty array if fetch fails
 */
async function fetchComponents(supabase: any): Promise<Component[]> {
  const { data: components } = await supabase
    .from('components')
    .select('*');
  return components || [];
}

/**
 * Apply component resolution and translations to layers
 * @param layers - Layer tree to process
 * @param pageId - Page ID for translation keys
 * @param components - Available components
 * @param translations - Translations map (optional)
 * @returns Processed layers with components resolved and translations applied
 */
function applyComponentsAndTranslations(
  layers: Layer[],
  pageId: string,
  components: Component[],
  translations?: Record<string, Translation>
): Layer[] {
  // Resolve components first
  let processedLayers = resolveComponents(layers, components);

  // Then apply translations if available
  if (translations && Object.keys(translations).length > 0) {
    processedLayers = injectTranslatedText(processedLayers, pageId, translations);
  }

  return processedLayers;
}

/**
 * Apply CMS translations to collection item values
 * @param itemId - Collection item ID
 * @param itemValues - Original item values (field_id -> value)
 * @param collectionFields - Collection fields to determine field keys
 * @param translations - Translations map
 * @returns Item values with translations applied
 */
function applyCmsTranslations(
  itemId: string,
  itemValues: Record<string, string>,
  collectionFields: CollectionField[],
  translations?: Record<string, Translation>
): Record<string, string> {
  if (!translations || Object.keys(translations).length === 0) {
    return itemValues;
  }

  const translatedValues = { ...itemValues };

  // Create a map of field ID to field key for lookup
  const fieldIdToKey = new Map<string, string | null>();
  for (const field of collectionFields) {
    fieldIdToKey.set(field.id, field.key);
  }

  // Apply translations for each field
  for (const fieldId of Object.keys(itemValues)) {
    const fieldKey = fieldIdToKey.get(fieldId);

    // Build translation key: field:key:{key} or field:id:{id} when key is null
    const contentKey = fieldKey ? `field:key:${fieldKey}` : `field:id:${fieldId}`;
    const translationKey = `cms:${itemId}:${contentKey}`;
    const translation = translations[translationKey];

    const translatedValue = getTranslationValue(translation);
    if (translatedValue) {
      translatedValues[fieldId] = translatedValue;
    }
  }

  return translatedValues;
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

  // Resolve inline variables (DynamicTextVariable format)
  const textVariable = layer.variables?.text;
  if (textVariable && textVariable.type === 'dynamic_text') {
    const textContent = textVariable.data.content;
    if (textContent.includes('<ycode-inline-variable>')) {
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

      updates.variables = {
        ...layer.variables,
        text: {
          type: 'dynamic_text',
          data: { content: resolved }
        }
      };
    }
  }

  // Image src field binding (variables structure)
  const imageSrc = layer.variables?.image?.src;
  if (imageSrc) {
    if (isFieldVariable(imageSrc) && imageSrc.data.field_id) {
      const resolvedUrl = resolveFieldValueWithRelationships(imageSrc, enhancedValues);
      // Update variables.image.src with resolved URL as DynamicTextVariable
      updates.variables = {
        ...layer.variables,
        image: {
          src: resolvedUrl ? createDynamicTextVariable(resolvedUrl) : imageSrc,
          alt: layer.variables?.image?.alt || createDynamicTextVariable(''),
        },
      };
    } else if (isAssetVariable(imageSrc)) {
      // Resolve AssetVariable to URL (server-side)
      const { getAssetById } = await import('@/lib/repositories/assetRepository');
      const assetId = getAssetId(imageSrc);
      if (assetId) {
        const asset = await getAssetById(assetId);
        const resolvedUrl = asset?.public_url || '';
        // Update variables.image.src with resolved URL as DynamicTextVariable
        updates.variables = {
          ...layer.variables,
          image: {
            src: createDynamicTextVariable(resolvedUrl),
            alt: layer.variables?.image?.alt || createDynamicTextVariable(''),
          },
        };
      }
    }
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
  fieldVariable: { type: 'field'; data: { field_id: string | null; relationships?: string[]; format?: string } },
  itemValues: Record<string, string>
): string | undefined {
  const { field_id, relationships = [] } = fieldVariable.data;
  if (!field_id) {
    return undefined;
  }

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
 * @param translations - Optional translations map for CMS field translations
 * @returns Layers with collection data injected
 */
export async function resolveCollectionLayers(
  layers: Layer[],
  isPublished: boolean,
  parentItemValues?: Record<string, string>,
  paginationContext?: PaginationContext,
  translations?: Record<string, Translation>
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

          // Check if pagination is enabled (either 'pages' or 'load_more' mode)
          const paginationConfig = collectionVariable.pagination;
          const isPaginated = paginationConfig?.enabled && (paginationConfig?.mode === 'pages' || paginationConfig?.mode === 'load_more');

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
              // Apply CMS translations to item values before using them
              const translatedValues = applyCmsTranslations(item.id, item.values, collectionFields, translations);

              // Resolve children for THIS specific item's values
              // This ensures nested collection layers filter based on this item's reference fields
              const resolvedChildren = layer.children?.length
                ? await Promise.all(layer.children.map(child => resolveLayer(child, translatedValues)))
                : [];

              // Then inject field data into the resolved children
              const injectedChildren = await Promise.all(
                resolvedChildren.map(child =>
                  injectCollectionData(child, translatedValues, collectionFields, isPublished)
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
                // Store translated item values for visibility filtering (SSR only, not serialized to client)
                _collectionItemValues: translatedValues,
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
              mode: paginationConfig.mode, // 'pages' or 'load_more'
              itemIds: allowedItemIds, // For multi-reference filtering in load_more
              // Store the original layer template for load_more client-side rendering
              layerTemplate: paginationConfig.mode === 'load_more' ? layer.children : undefined,
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
  const { currentPage, totalPages, totalItems, itemsPerPage, mode } = meta;

  // Deep clone to avoid mutation
  const updatedLayer: Layer = JSON.parse(JSON.stringify(layer));

  // Helper to recursively update layers
  function updateLayerRecursive(l: Layer): void {
    // Update page info text (for 'pages' mode)
    if (l.id?.endsWith('-pagination-info')) {
      l.variables = {
        ...l.variables,
        text: {
          type: 'dynamic_text',
          data: { content: `Page ${currentPage} of ${totalPages}` }
        }
      };
    }

    // Update items count text (for 'load_more' mode)
    if (l.id?.endsWith('-pagination-count')) {
      const shownItems = Math.min(itemsPerPage, totalItems);
      l.variables = {
        ...l.variables,
        text: {
          type: 'dynamic_text',
          data: { content: `Showing ${shownItems} of ${totalItems}` }
        }
      };
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

    // Hide load more button when all items shown (in load_more mode)
    if (l.id?.endsWith('-pagination-loadmore')) {
      const allItemsShown = itemsPerPage >= totalItems;
      if (allItemsShown) {
        l.classes = Array.isArray(l.classes)
          ? [...l.classes, 'hidden']
          : `${l.classes || ''} hidden`;
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
            classes: '',
            variables: {
              text: {
                type: 'dynamic_text',
                data: { content: 'Previous' }
              }
            }
          } as Layer,
        ],
      } as Layer,
      // Page indicator
      {
        id: `${collectionLayerId}-pagination-info`,
        name: 'span',
        classes: 'text-sm text-[#4b5563]',
        variables: {
          text: {
            type: 'dynamic_text',
            data: { content: `Page ${currentPage} of ${totalPages}` }
          }
        }
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
            classes: '',
            variables: {
              text: {
                type: 'dynamic_text',
                data: { content: 'Next' }
              }
            }
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

/**
 * Render collection items to HTML string for "Load More" pagination
 * Takes the original layer template and renders each item with injected data
 * @param items - Collection items with values
 * @param layerTemplate - The original layer template (children of the collection layer)
 * @param collectionId - Collection ID for fetching fields
 * @param collectionLayerId - The collection layer ID (for unique item IDs)
 * @param isPublished - Whether to fetch published data
 * @returns HTML string of rendered items
 */
export async function renderCollectionItemsToHtml(
  items: CollectionItemWithValues[],
  layerTemplate: Layer[],
  collectionId: string,
  collectionLayerId: string,
  isPublished: boolean
): Promise<string> {
  // Fetch collection fields for field resolution
  const collectionFields = await getFieldsByCollectionId(collectionId, isPublished);

  // Render each item using the template
  const renderedItems = await Promise.all(
    items.map(async (item, index) => {
      // Deep clone the template for each item
      const clonedTemplate = JSON.parse(JSON.stringify(layerTemplate));

      // Inject collection data into each layer of the template (text, images, etc.)
      const injectedLayers = await Promise.all(
        clonedTemplate.map((layer: Layer) =>
          injectCollectionDataForHtml(layer, item.values, collectionFields, isPublished)
        )
      );

      // Resolve nested collection layers (sub-collections like "shades" inside "colors")
      // Pass item.values so nested collections can filter based on parent item's field values
      const resolvedLayers = await resolveCollectionLayers(
        injectedLayers,
        isPublished,
        item.values, // Parent item values for multi-reference filtering
        undefined, // No pagination context for Load More rendering
        undefined // TODO: Add translation support for Load More pagination
      );

      // Convert layers to HTML (handles fragments from resolved collections)
      const itemHtml = resolvedLayers.map(layer => layerToHtml(layer, item.id)).join('');

      // Wrap in collection item container with the proper layer ID format
      const itemWrapperId = `${collectionLayerId}-item-${item.id}`;
      return `<div data-layer-id="${itemWrapperId}" data-collection-item-id="${item.id}">${itemHtml}</div>`;
    })
  );

  return renderedItems.join('');
}

/**
 * Inject collection data into a layer for HTML rendering
 * Similar to injectCollectionData but simplified for HTML output
 */
async function injectCollectionDataForHtml(
  layer: Layer,
  itemValues: Record<string, string>,
  fields: CollectionField[],
  isPublished: boolean
): Promise<Layer> {
  // Resolve reference fields if we have field definitions
  let enhancedValues = itemValues;
  if (fields && fields.length > 0) {
    enhancedValues = await resolveReferenceFields(itemValues, fields, isPublished);
  }

  const updates: Partial<Layer> = {};

  // Resolve inline variables (DynamicTextVariable format)
  const textVariable = layer.variables?.text;
  if (textVariable && textVariable.type === 'dynamic_text') {
    const textContent = textVariable.data.content;
    if (textContent.includes('<ycode-inline-variable>')) {
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
      const resolved = resolveInlineVariables(textContent, mockItem);
      updates.variables = {
        ...layer.variables,
        text: {
          type: 'dynamic_text',
          data: { content: resolved }
        }
      };
    }
  }

  // Image src field binding (variables structure)
  const imageSrc = layer.variables?.image?.src;
  if (imageSrc) {
    if (isFieldVariable(imageSrc)) {
      const fieldId = imageSrc.data.field_id;
      if (!fieldId) {
        return { ...layer, ...updates };
      }
      const relationships = imageSrc.data.relationships || [];
      const fullPath = relationships.length > 0
        ? [fieldId, ...relationships].join('.')
        : fieldId;
      const resolvedUrl = enhancedValues[fullPath] || '';
      // Update variables.image.src with resolved URL as DynamicTextVariable
      updates.variables = {
        ...layer.variables,
        image: {
          src: resolvedUrl ? createDynamicTextVariable(resolvedUrl) : imageSrc,
          alt: layer.variables?.image?.alt || createDynamicTextVariable(''),
        },
      };
    } else if (isAssetVariable(imageSrc)) {
      // Resolve AssetVariable to URL (server-side)
      const { getAssetById } = await import('@/lib/repositories/assetRepository');
      const assetId = getAssetId(imageSrc);
      if (assetId) {
        const asset = await getAssetById(assetId);
        const resolvedUrl = asset?.public_url || '';
        // Update variables.image.src with resolved URL as DynamicTextVariable
        updates.variables = {
          ...layer.variables,
          image: {
            src: createDynamicTextVariable(resolvedUrl),
            alt: layer.variables?.image?.alt || createDynamicTextVariable(''),
          },
        };
      }
    }
  }

  // Recursively process children
  if (layer.children) {
    const resolvedChildren = await Promise.all(
      layer.children.map(child =>
        injectCollectionDataForHtml(child, enhancedValues, fields, isPublished)
      )
    );
    updates.children = resolvedChildren;
  }

  return {
    ...layer,
    ...updates,
  };
}

/**
 * Resolve all AssetVariables in layer tree to DynamicTextVariables with public URLs
 * This ensures assets are resolved server-side before rendering
 * Should be called after all other layer processing (collections, components, etc.)
 */
async function resolveAllAssets(layers: Layer[]): Promise<Layer[]> {
  const { getAssetsByIds } = await import('@/lib/repositories/assetRepository');

  // Step 1: Collect all asset IDs from the layer tree
  const collectAssetIds = (layer: Layer, assetIds: Set<string>): void => {
    // Collect image asset IDs
    const imageSrc = layer.variables?.image?.src;
    if (imageSrc && isAssetVariable(imageSrc)) {
      const assetId = getAssetId(imageSrc);
      if (assetId) assetIds.add(assetId);
    }

    // Collect video asset IDs
    const videoSrc = layer.variables?.video?.src;
    if (videoSrc && isAssetVariable(videoSrc)) {
      const assetId = getAssetId(videoSrc);
      if (assetId) assetIds.add(assetId);
    }

    // Collect video poster asset IDs
    const videoPoster = layer.variables?.video?.poster;
    if (videoPoster && isAssetVariable(videoPoster)) {
      const assetId = getAssetId(videoPoster);
      if (assetId) assetIds.add(assetId);
    }

    // Collect audio asset IDs
    const audioSrc = layer.variables?.audio?.src;
    if (audioSrc && isAssetVariable(audioSrc)) {
      const assetId = getAssetId(audioSrc);
      if (assetId) assetIds.add(assetId);
    }

    // Collect icon asset IDs
    const iconSrc = layer.variables?.icon?.src;
    if (iconSrc && isAssetVariable(iconSrc)) {
      const assetId = getAssetId(iconSrc);
      if (assetId) assetIds.add(assetId);
    }

    // Recursively collect from children
    if (layer.children) {
      layer.children.forEach(child => collectAssetIds(child, assetIds));
    }
  };

  const assetIds = new Set<string>();
  layers.forEach(layer => collectAssetIds(layer, assetIds));

  // Step 2: Fetch all assets in a single query
  const assetMap = await getAssetsByIds(Array.from(assetIds));

  // Step 3: Resolve layer URLs using the fetched asset map
  const resolveLayer = (layer: Layer): Layer => {
    const updates: Partial<Layer> = {};
    const variableUpdates: Partial<Layer['variables']> = {};

    // Resolve AssetVariable in image src
    const imageSrc = layer.variables?.image?.src;
    if (imageSrc && isAssetVariable(imageSrc)) {
      const assetId = getAssetId(imageSrc);
      if (assetId) {
        const asset = assetMap[assetId];
        const resolvedUrl = asset?.public_url || '';
        variableUpdates.image = {
          src: createDynamicTextVariable(resolvedUrl),
          alt: layer.variables?.image?.alt || createDynamicTextVariable(''),
        };
      }
    }

    // Resolve AssetVariable in video src and poster
    const videoSrc = layer.variables?.video?.src;
    const videoPoster = layer.variables?.video?.poster;
    const videoUpdates: { src?: any; poster?: any } = {};

    if (videoSrc && isAssetVariable(videoSrc)) {
      const assetId = getAssetId(videoSrc);
      if (assetId) {
        const asset = assetMap[assetId];
        const resolvedUrl = asset?.public_url || '';
        videoUpdates.src = createDynamicTextVariable(resolvedUrl);
      }
    }

    if (videoPoster && isAssetVariable(videoPoster)) {
      const assetId = getAssetId(videoPoster);
      if (assetId) {
        const asset = assetMap[assetId];
        const resolvedUrl = asset?.public_url || '';
        videoUpdates.poster = createDynamicTextVariable(resolvedUrl);
      }
    }

    if (Object.keys(videoUpdates).length > 0) {
      variableUpdates.video = {
        ...layer.variables?.video,
        ...videoUpdates,
      };
    }

    // Resolve AssetVariable in audio src
    const audioSrc = layer.variables?.audio?.src;
    if (audioSrc && isAssetVariable(audioSrc)) {
      const assetId = getAssetId(audioSrc);
      if (assetId) {
        const asset = assetMap[assetId];
        const resolvedUrl = asset?.public_url || '';
        variableUpdates.audio = {
          src: createDynamicTextVariable(resolvedUrl),
        };
      }
    }

    // Resolve AssetVariable in icon src (convert to StaticTextVariable with SVG content)
    const iconSrc = layer.variables?.icon?.src;
    if (iconSrc && isAssetVariable(iconSrc)) {
      const assetId = getAssetId(iconSrc);
      if (assetId) {
        const asset = assetMap[assetId];
        const svgContent = asset?.content || '';
        if (svgContent) {
          variableUpdates.icon = {
            src: {
              type: 'static_text' as const,
              data: {
                content: svgContent,
              },
            },
          };
        }
      }
    }

    // Apply all variable updates at once
    if (Object.keys(variableUpdates).length > 0) {
      updates.variables = {
        ...layer.variables,
        ...variableUpdates,
      };
    }

    // Recursively resolve children
    if (layer.children) {
      const resolvedChildren = layer.children.map(child => resolveLayer(child));
      updates.children = resolvedChildren;
    }

    return {
      ...layer,
      ...updates,
    };
  };

  return layers.map(resolveLayer);
}

/**
 * Convert a Layer to HTML string
 * Handles common layer types and their attributes
 */
function layerToHtml(layer: Layer, collectionItemId?: string): string {
  // Handle fragment layers (created by resolveCollectionLayers for nested collections)
  // Fragments render their children directly without a wrapper element
  if (layer.name === '_fragment' && layer.children) {
    return layer.children.map(child => layerToHtml(child, collectionItemId)).join('');
  }

  // Get the HTML tag
  const tag = layer.settings?.tag || layer.name || 'div';

  // Build classes string
  let classesStr = '';
  if (Array.isArray(layer.classes)) {
    classesStr = layer.classes.join(' ');
  } else if (typeof layer.classes === 'string') {
    classesStr = layer.classes;
  }

  // Build attributes
  const attrs: string[] = [];

  if (layer.id) {
    attrs.push(`data-layer-id="${escapeHtml(layer.id)}"`);
  }

  if (classesStr) {
    attrs.push(`class="${escapeHtml(classesStr)}"`);
  }

  if (layer.settings?.id) {
    attrs.push(`id="${escapeHtml(layer.settings.id)}"`);
  }

  // Handle images (variables structure)
  if (tag === 'img') {
    const imageSrc = layer.variables?.image?.src;
    if (imageSrc) {
      // Extract string value from variable (should be DynamicTextVariable after resolution)
      // AssetVariable should have been resolved to DynamicTextVariable in injectCollectionDataForHtml
      let srcValue: string | undefined = undefined;
      if (imageSrc.type === 'dynamic_text') {
        srcValue = imageSrc.data.content || undefined;
      } else if (imageSrc.type === 'asset') {
        // AssetVariable should have been resolved, but if not, skip (don't use asset_id as URL)
        srcValue = undefined;
      }
      // Only add src if we have a valid URL (not empty string)
      if (srcValue && srcValue.trim()) {
        // Use optimized URL for src (default size: 1200px for good quality)
        const optimizedSrc = getOptimizedImageUrl(srcValue, 1200, 1200, 85);
        attrs.push(`src="${escapeHtml(optimizedSrc)}"`);

        // Generate srcset for responsive images
        const srcset = generateImageSrcset(srcValue);
        if (srcset) {
          attrs.push(`srcset="${escapeHtml(srcset)}"`);
          // Add sizes attribute for responsive images
          attrs.push(`sizes="${escapeHtml(getImageSizes())}"`);
        }
      }
    }
    const imageAlt = layer.variables?.image?.alt;
    if (imageAlt && imageAlt.type === 'dynamic_text') {
      attrs.push(`alt="${escapeHtml(imageAlt.data.content)}"`);
    }
  }

  // Handle icons (variables structure)
  let iconHtml = '';
  if (layer.name === 'icon') {
    const iconSrc = layer.variables?.icon?.src;
    if (iconSrc) {
      iconHtml = getVariableStringValue(iconSrc) || '';
    }
    // Add data-icon attribute to trigger CSS styling
    attrs.push('data-icon="true"');
  }

  // Handle links (variables structure)
  if (tag === 'a') {
    const linkHref = layer.variables?.link?.href;
    if (linkHref) {
      // Extract string value from variable (FieldVariable or DynamicTextVariable)
      let hrefValue = '';
      if (linkHref.type === 'dynamic_text') {
        hrefValue = linkHref.data.content;
      }
      if (hrefValue) {
        attrs.push(`href="${escapeHtml(hrefValue)}"`);
      }
    }
    const linkTarget = layer.attributes?.target;
    if (linkTarget) {
      attrs.push(`target="${escapeHtml(linkTarget as string)}"`);
    }
    const linkRel = layer.attributes?.rel;
    if (linkRel) {
      attrs.push(`rel="${escapeHtml(linkRel as string)}"`);
    }
  }

  // Add custom attributes
  if (layer.attributes) {
    for (const [key, value] of Object.entries(layer.attributes)) {
      if (value !== undefined && value !== null) {
        attrs.push(`${escapeHtml(key)}="${escapeHtml(String(value))}"`);
      }
    }
  }

  // Render children
  const childrenHtml = layer.children
    ? layer.children.map(child => layerToHtml(child, collectionItemId)).join('')
    : '';

  // Get text content from variables.text
  const textVariable = layer.variables?.text;
  const textContent = (textVariable && textVariable.type === 'dynamic_text') ? textVariable.data.content : '';

  // Handle self-closing tags
  const selfClosingTags = ['img', 'br', 'hr', 'input', 'meta', 'link'];
  if (selfClosingTags.includes(tag)) {
    return `<${tag} ${attrs.join(' ')} />`;
  }

  // Render the element
  const attrsStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // For icon layers, use raw iconHtml (don't escape SVG content)
  if (layer.name === 'icon' && iconHtml) {
    return `<${tag}${attrsStr}>${iconHtml}${childrenHtml}</${tag}>`;
  }

  return `<${tag}${attrsStr}>${escapeHtml(textContent)}${childrenHtml}</${tag}>`;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
