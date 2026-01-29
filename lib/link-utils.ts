import type { Page, PageFolder, Locale, LinkSettings, Layer, DynamicTextVariable, CollectionLinkValue } from '@/types';
import { buildLocalizedSlugPath, buildLocalizedDynamicPageUrl } from '@/lib/page-utils';

// ============================================================================
// LinkSettings Validation
// ============================================================================

/**
 * Check if link settings have valid content (not just a type set)
 */
export function isValidLinkSettings(link: LinkSettings | undefined | null): boolean {
  if (!link || !link.type) return false;

  switch (link.type) {
    case 'url':
      return !!link.url?.data?.content;
    case 'email':
      return !!link.email?.data?.content;
    case 'phone':
      return !!link.phone?.data?.content;
    case 'asset':
      return !!link.asset?.id;
    case 'page':
      return !!link.page?.id;
    case 'field':
      return !!link.field?.data?.field_id;
    default:
      return false;
  }
}

// ============================================================================
// LinkSettings Creation
// ============================================================================

/**
 * Create a DynamicTextVariable for link content
 */
function createDynamicTextVariable(content: string): DynamicTextVariable {
  return {
    type: 'dynamic_text',
    data: { content },
  };
}

/**
 * Create a URL link settings object
 */
export function createUrlLinkSettings(url: string, anchorLayerId?: string | null): LinkSettings {
  return {
    type: 'url',
    url: createDynamicTextVariable(url),
    anchor_layer_id: anchorLayerId || null,
  };
}

/**
 * Create an email link settings object
 */
export function createEmailLinkSettings(email: string): LinkSettings {
  return {
    type: 'email',
    email: createDynamicTextVariable(email),
  };
}

/**
 * Create a phone link settings object
 */
export function createPhoneLinkSettings(phone: string): LinkSettings {
  return {
    type: 'phone',
    phone: createDynamicTextVariable(phone),
  };
}

/**
 * Create an asset link settings object
 */
export function createAssetLinkSettings(assetId: string): LinkSettings {
  return {
    type: 'asset',
    asset: { id: assetId },
  };
}

/**
 * Create a page link settings object
 */
export function createPageLinkSettings(
  pageId: string,
  collectionItemId?: string | null,
  anchorLayerId?: string | null
): LinkSettings {
  return {
    type: 'page',
    page: {
      id: pageId,
      collection_item_id: collectionItemId || null,
    },
    anchor_layer_id: anchorLayerId || null,
  };
}

/**
 * Create a field link settings object (CMS field containing URL)
 */
export function createFieldLinkSettings(
  fieldId: string,
  relationships: string[] = []
): LinkSettings {
  return {
    type: 'field',
    field: {
      type: 'field',
      data: {
        field_id: fieldId,
        relationships,
      },
    },
  };
}

// ============================================================================
// Layer Link Checking
// ============================================================================

/**
 * Check if a layer has link settings configured
 */
export function layerHasLink(layer: Layer): boolean {
  return !!(layer.variables?.link && layer.variables.link.type);
}

/**
 * Check if a layer has rich text links in its content
 */
export function hasRichTextLinks(layer: Layer): boolean {
  const textVariable = layer.variables?.text;
  if (!textVariable || textVariable.type !== 'dynamic_rich_text') {
    return false;
  }

  const content = textVariable.data?.content;
  if (!content || typeof content !== 'object') {
    return false;
  }

  // Recursively check for richTextLink marks in the content
  const checkNode = (node: any): boolean => {
    if (node.marks && Array.isArray(node.marks)) {
      if (node.marks.some((mark: any) => mark.type === 'richTextLink')) {
        return true;
      }
    }
    if (node.content && Array.isArray(node.content)) {
      return node.content.some((child: any) => checkNode(child));
    }
    return false;
  };

  return checkNode(content);
}

/**
 * Check if a layer or any of its descendants has link settings or rich text links
 */
export function hasLinkInTree(layer: Layer): boolean {
  if (layerHasLink(layer)) {
    return true;
  }

  if (hasRichTextLinks(layer)) {
    return true;
  }

  if (layer.children) {
    return layer.children.some(child => hasLinkInTree(child));
  }

  return false;
}

/**
 * Context for resolving links (page, asset, field types)
 */
export interface LinkResolutionContext {
  pages?: Page[];
  folders?: PageFolder[];
  collectionItemSlugs?: Record<string, string>;
  collectionItemId?: string;
  pageCollectionItemId?: string;
  collectionItemData?: Record<string, string>;
  pageCollectionItemData?: Record<string, string>;
  isPreview?: boolean;
  locale?: Locale | null;
  translations?: Record<string, any> | null;
  getAsset?: (id: string) => { public_url?: string | null } | null;
  anchorMap?: Record<string, string>;
}

/**
 * Resolve inline variables in URL/email/phone content
 * This is a simplified version - the full version is in text-format-utils.ts
 */
function resolveInlineVariables(
  text: string,
  collectionItemData?: Record<string, string>,
  pageCollectionItemData?: Record<string, string>
): string {
  if (!text) return '';
  if (!collectionItemData && !pageCollectionItemData) {
    return text.replace(/<ycode-inline-variable>[\s\S]*?<\/ycode-inline-variable>/g, '');
  }

  const regex = /<ycode-inline-variable>([\s\S]*?)<\/ycode-inline-variable>/g;
  return text.replace(regex, (match, variableContent) => {
    try {
      const parsed = JSON.parse(variableContent.trim());
      if (parsed.type === 'field' && parsed.data?.field_id) {
        const fieldId = parsed.data.field_id;
        const source = parsed.data.source;

        let fieldValue: string | undefined;
        if (source === 'page') {
          fieldValue = pageCollectionItemData?.[fieldId];
        } else if (source === 'collection') {
          fieldValue = collectionItemData?.[fieldId];
        } else {
          fieldValue = collectionItemData?.[fieldId] ?? pageCollectionItemData?.[fieldId];
        }
        return fieldValue || '';
      }
    } catch {
      // Invalid JSON
    }
    return match;
  });
}

/**
 * Parse a string or object value as CollectionLinkValue
 * Returns null if the value is not a valid CollectionLinkValue
 */
export function parseCollectionLinkValue(value: string | CollectionLinkValue | unknown): CollectionLinkValue | null {
  if (!value) return null;

  // If already an object, validate and return it
  if (typeof value === 'object' && 'type' in value) {
    if (value.type === 'url' || value.type === 'page') {
      return value as CollectionLinkValue;
    }
    return null;
  }

  // If string, parse JSON
  if (typeof value === 'string') {
    if (!value.startsWith('{')) return null;
    try {
      const parsed = JSON.parse(value);
      // Validate it has the expected structure
      if (parsed && typeof parsed === 'object' && 'type' in parsed) {
        if (parsed.type === 'url' || parsed.type === 'page') {
          return parsed as CollectionLinkValue;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Resolve a CollectionLinkValue to an href string
 */
export function resolveCollectionLinkValue(
  linkValue: CollectionLinkValue,
  context: LinkResolutionContext
): string | null {
  const { pages, folders, collectionItemSlugs, isPreview, locale, translations } = context;

  if (linkValue.type === 'url') {
    return linkValue.url || null;
  }

  if (linkValue.type === 'page') {
    if (!linkValue.page?.id || !pages || !folders) return null;

    const page = pages.find(p => p.id === linkValue.page?.id);
    if (!page) return null;

    let href: string;

    // Handle dynamic pages with specific collection item
    if (page.is_dynamic && linkValue.page.collection_item_id && collectionItemSlugs) {
      const itemSlug = collectionItemSlugs[linkValue.page.collection_item_id];
      href = buildLocalizedDynamicPageUrl(page, folders, itemSlug || null, locale, translations || undefined);
    } else {
      // Static page or dynamic page without specific item
      href = buildLocalizedSlugPath(page, folders, 'page', locale, translations || undefined);
    }

    // Prefix with /ycode/preview in preview mode
    if (isPreview && href) {
      href = `/ycode/preview${href}`;
    }

    // Append anchor if present
    if (href && linkValue.page.anchor_layer_id) {
      href = `${href}#${linkValue.page.anchor_layer_id}`;
    }

    return href || null;
  }

  return null;
}

/**
 * Generate href from link settings using provided context
 * Shared utility for both layer-level links and rich text links
 */
export function generateLinkHref(
  linkSettings: LinkSettings | undefined,
  context: LinkResolutionContext
): string | null {
  if (!linkSettings || !linkSettings.type) return null;

  const {
    pages,
    folders,
    collectionItemSlugs,
    collectionItemId,
    pageCollectionItemId,
    collectionItemData,
    pageCollectionItemData,
    isPreview,
    locale,
    translations,
    getAsset,
    anchorMap,
  } = context;

  let href = '';

  switch (linkSettings.type) {
    case 'url': {
      const urlContent = linkSettings.url?.data?.content || '';
      href = resolveInlineVariables(urlContent, collectionItemData, pageCollectionItemData) || '';
      break;
    }
    case 'email': {
      const emailContent = linkSettings.email?.data?.content || '';
      const resolvedEmail = resolveInlineVariables(emailContent, collectionItemData, pageCollectionItemData);
      href = resolvedEmail ? `mailto:${resolvedEmail}` : '';
      break;
    }
    case 'phone': {
      const phoneContent = linkSettings.phone?.data?.content || '';
      const resolvedPhone = resolveInlineVariables(phoneContent, collectionItemData, pageCollectionItemData);
      href = resolvedPhone ? `tel:${resolvedPhone}` : '';
      break;
    }
    case 'asset':
      if (linkSettings.asset?.id && getAsset) {
        const asset = getAsset(linkSettings.asset.id);
        href = asset?.public_url || '';
      }
      break;
    case 'page':
      if (linkSettings.page?.id && pages && folders) {
        const page = pages.find(p => p.id === linkSettings.page?.id);
        if (page) {
          // Check if this is a dynamic page with a specific collection item
          if (page.is_dynamic && linkSettings.page.collection_item_id && collectionItemSlugs) {
            let itemSlug: string | undefined;

            // Handle special "current" keywords
            if (linkSettings.page.collection_item_id === 'current-page') {
              // Use the page's collection item (for dynamic pages)
              itemSlug = pageCollectionItemId ? collectionItemSlugs[pageCollectionItemId] : undefined;
            } else if (linkSettings.page.collection_item_id === 'current-collection') {
              // Use the current collection layer's item
              itemSlug = collectionItemId ? collectionItemSlugs[collectionItemId] : undefined;
            } else {
              // Use the specific item slug
              itemSlug = collectionItemSlugs[linkSettings.page.collection_item_id];
            }

            href = buildLocalizedDynamicPageUrl(page, folders, itemSlug || null, locale, translations || undefined);
          } else {
            // Static page or dynamic page without specific item
            href = buildLocalizedSlugPath(page, folders, 'page', locale, translations || undefined);
          }

          // Prefix with /ycode/preview in preview mode
          if (isPreview && href) {
            href = `/ycode/preview${href}`;
          }
        }
      }
      break;
    case 'field': {
      // For field-based links, prefer collection layer data, fall back to page data
      const fieldData = collectionItemData || pageCollectionItemData;
      if (linkSettings.field?.data?.field_id && fieldData) {
        const fieldId = linkSettings.field.data.field_id;
        const relationships = linkSettings.field.data.relationships || [];

        let rawValue: string | undefined;
        if (relationships.length > 0) {
          const fullPath = [fieldId, ...relationships].join('.');
          rawValue = fieldData[fullPath];
        } else {
          rawValue = fieldData[fieldId];
        }

        if (rawValue) {
          // Check if value is a CollectionLinkValue JSON (for 'link' field type)
          const linkValue = parseCollectionLinkValue(rawValue);
          if (linkValue) {
            // Resolve the link value using the same context
            href = resolveCollectionLinkValue(linkValue, context) || '';
          } else {
            // Use raw value directly (for text fields containing URLs)
            href = rawValue;
          }
        }
      }
      break;
    }
  }

  // Append anchor if present (anchor_layer_id references a layer's ID attribute)
  // Resolve layer ID to actual anchor value using pre-built map (O(1) lookup)
  if (linkSettings.anchor_layer_id) {
    const anchorValue = anchorMap?.[linkSettings.anchor_layer_id] || linkSettings.anchor_layer_id;
    if (href) {
      href = `${href}#${anchorValue}`;
    } else {
      // Anchor-only link (same page)
      href = `#${anchorValue}`;
    }
  }

  return href || null;
}
