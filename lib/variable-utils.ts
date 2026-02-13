/**
 * Variable Utilities
 *
 * Helper functions for working with the new variable types:
 * - AssetVariable
 * - FieldVariable
 * - DynamicTextVariable
 * - StaticTextVariable
 */

import type { AssetVariable, FieldVariable, DynamicTextVariable, DynamicRichTextVariable, StaticTextVariable, ComponentVariableValue } from '@/types';
import { resolveInlineVariablesFromData } from '@/lib/inline-variables';
import { resolveFieldFromSources } from '@/lib/cms-variables-utils';
import { DEFAULT_ASSETS } from '@/lib/asset-constants';
import { stringToTiptapContent } from '@/lib/text-format-utils';

/**
 * Create a DynamicTextVariable from a string (with or without inline variables)
 */
export function createDynamicTextVariable(content: string): DynamicTextVariable {
  return {
    type: 'dynamic_text',
    data: {
      content,
    },
  };
}

/**
 * Create a DynamicRichTextVariable from a JSON string
 * Parses JSON string back to Tiptap JSON object to preserve all formatting
 */
export function createDynamicRichTextVariable(content: string): DynamicRichTextVariable {
  try {
    // Parse JSON string back to Tiptap JSON object
    const tiptapContent = JSON.parse(content);
    return {
      type: 'dynamic_rich_text',
      data: {
        content: tiptapContent,
      },
    };
  } catch (error) {
    // Fallback: if content is not valid JSON, treat it as plain text and convert to Tiptap format
    console.error('Failed to parse rich text JSON:', error);
    return {
      type: 'dynamic_rich_text',
      data: {
        content: stringToTiptapContent(content),
      },
    };
  }
}

/**
 * Create an AssetVariable from an asset ID
 */
export function createAssetVariable(assetId: string): AssetVariable {
  return {
    type: 'asset',
    data: {
      asset_id: assetId,
    },
  };
}

/**
 * Component Variable Utilities
 *
 * ComponentVariableValue currently supports text variables (DynamicTextVariable | DynamicRichTextVariable)
 * but will be expanded to support other types (image, link, etc.) in the future
 */

/**
 * Create a text ComponentVariableValue from Tiptap JSON content
 * Used for component variable default values and overrides (text variables only)
 */
export function createTextComponentVariableValue(tiptapContent: object): ComponentVariableValue {
  return {
    type: 'dynamic_rich_text',
    data: {
      content: tiptapContent,
    },
  };
}

/**
 * Extract Tiptap JSON content from text ComponentVariableValue
 * Returns the Tiptap content object or a default empty document
 * Handles both DynamicRichTextVariable (with formatting) and DynamicTextVariable (plain text)
 */
export function extractTiptapFromComponentVariable(value?: ComponentVariableValue): object {
  const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

  if (!value) return emptyDoc;

  // Check if value is a text variable (has 'type' property) vs ImageSettingsValue (has 'src' property)
  if ('type' in value && value.type === 'dynamic_rich_text') {
    return (value as DynamicRichTextVariable).data.content;
  }

  if ('type' in value && value.type === 'dynamic_text') {
    // Convert plain text to Tiptap format
    return stringToTiptapContent((value as DynamicTextVariable).data.content);
  }

  return emptyDoc;
}

/**
 * Create a StaticTextVariable from plain text
 */
export function createStaticTextVariable(content: string): StaticTextVariable {
  return {
    type: 'static_text',
    data: {
      content,
    },
  };
}

/**
 * Extract content string from a DynamicTextVariable
 */
export function getDynamicTextContent(variable: DynamicTextVariable | undefined | null): string {
  return variable?.data?.content || '';
}

/**
 * Extract asset ID from an AssetVariable
 */
export function getAssetId(variable: AssetVariable | undefined | null): string {
  return variable?.data?.asset_id || '';
}

/**
 * Extract content from a StaticTextVariable
 */
export function getStaticTextContent(variable: StaticTextVariable | undefined | null): string {
  return variable?.data?.content || '';
}

/**
 * Check if a value is a FieldVariable
 */
export function isFieldVariable(value: any): value is FieldVariable {
  return value && typeof value === 'object' && value.type === 'field' && value.data?.field_id;
}

/**
 * Check if a value is an AssetVariable
 */
export function isAssetVariable(value: any): value is AssetVariable {
  return value && typeof value === 'object' && value.type === 'asset' && value.data !== undefined;
}

/**
 * Check if a value is a DynamicTextVariable
 */
export function isDynamicTextVariable(value: any): value is DynamicTextVariable {
  return value && typeof value === 'object' && value.type === 'dynamic_text' && value.data?.content !== undefined;
}

/**
 * Check if a value is a DynamicRichTextVariable
 */
export function isDynamicRichTextVariable(value: any): value is DynamicRichTextVariable {
  return value && typeof value === 'object' && value.type === 'dynamic_rich_text' && value.data?.content !== undefined;
}

/**
 * Check if a value is a StaticTextVariable
 */
export function isStaticTextVariable(value: any): value is StaticTextVariable {
  return value && typeof value === 'object' && value.type === 'static_text' && value.data?.content !== undefined;
}

/**
 * Get the string value from any variable type
 * - AssetVariable -> asset_id
 * - FieldVariable -> (needs resolution, returns empty string)
 * - DynamicTextVariable -> content
 * - StaticTextVariable -> content
 */
export function getVariableStringValue(
  variable: AssetVariable | FieldVariable | DynamicTextVariable | StaticTextVariable | undefined | null
): string {
  if (!variable) return '';

  if (isAssetVariable(variable)) {
    return variable.data.asset_id || '';
  }

  if (isDynamicTextVariable(variable)) {
    return variable.data.content;
  }

  if (isStaticTextVariable(variable)) {
    return variable.data.content;
  }

  // FieldVariable needs resolution with collection data
  return '';
}

/**
 * Get image URL from image src variable
 * - AssetVariable -> gets asset URL from store
 * - FieldVariable -> resolves field value using source-aware resolution (page or collection)
 * - DynamicTextVariable -> returns content as URL (resolves inline variables if collectionItemData provided)
 *
 * @param src - The image src variable (AssetVariable | FieldVariable | DynamicTextVariable)
 * @param getAsset - Function to get asset by ID (required for AssetVariable)
 * @param collectionItemData - Collection layer item data for field resolution
 * @param pageCollectionItemData - Page collection item data for dynamic pages
 * @param useDefault - Whether to return default placeholder when asset_id is null
 * @returns Image URL string or undefined
 */
export function getImageUrlFromVariable(
  src: AssetVariable | FieldVariable | DynamicTextVariable | undefined | null,
  getAsset?: (id: string) => { public_url: string | null; content?: string | null } | null,
  collectionItemData?: Record<string, string>,
  pageCollectionItemData?: Record<string, string> | null,
  useDefault: boolean = true
): string | undefined {
  if (!src) return undefined;

  if (isAssetVariable(src)) {
    if (!src.data.asset_id) {
      // asset_id is null - return default placeholder if enabled
      if (useDefault) {
        return DEFAULT_ASSETS.IMAGE;
      }
      return undefined;
    }
    if (!getAsset) return undefined;
    const asset = getAsset(src.data.asset_id);
    // Return public_url if available, otherwise convert SVG content to data URL
    if (asset?.public_url) {
      return asset.public_url;
    }
    // Check for actual SVG content (not just the marker used for link resolution)
    if (asset?.content && !(asset as any)._isSvgMarker) {
      // Convert inline SVG content to data URL
      return `data:image/svg+xml,${encodeURIComponent(asset.content)}`;
    }
    return undefined;
  }

  if (isFieldVariable(src)) {
    const fieldId = src.data.field_id;
    if (!fieldId) return undefined;

    // Use source-aware resolution (respects source: 'page' | 'collection')
    const resolvedValue = resolveFieldFromSources(
      fieldId,
      src.data.source,
      collectionItemData,
      pageCollectionItemData
    );
    if (!resolvedValue) return undefined;

    // The field value may be an asset ID - look up the asset to get the URL
    if (getAsset) {
      const asset = getAsset(resolvedValue);
      if (asset?.public_url) {
        return asset.public_url;
      }
      // Also support SVG content for field variables (not just the marker)
      if (asset?.content && !(asset as any)._isSvgMarker) {
        return `data:image/svg+xml,${encodeURIComponent(asset.content)}`;
      }
    }

    // If getAsset is not available or asset not found, return the raw value
    // (might be a URL in text fields)
    return resolvedValue;
  }

  if (isDynamicTextVariable(src)) {
    const content = src.data.content;
    // Resolve inline variables if present
    if (content.includes('<ycode-inline-variable>')) {
      return resolveInlineVariablesFromData(content, collectionItemData, pageCollectionItemData);
    }
    return content;
  }

  return undefined;
}

/**
 * Get video URL from video src variable
 * - AssetVariable -> gets asset URL from store
 * - FieldVariable -> resolves field value using source-aware resolution (page or collection)
 * - DynamicTextVariable -> returns content as URL (resolves inline variables if collectionItemData provided)
 * - VideoVariable -> returns undefined (YouTube videos are handled separately as iframes)
 *
 * @param src - The video src variable (AssetVariable | FieldVariable | DynamicTextVariable | VideoVariable)
 * @param getAsset - Function to get asset by ID (required for AssetVariable)
 * @param collectionItemData - Collection layer item data for field resolution
 * @param pageCollectionItemData - Page collection item data for dynamic pages
 * @param useDefault - Whether to return default placeholder when asset_id is null
 * @returns Video URL string or undefined
 */
export function getVideoUrlFromVariable(
  src: AssetVariable | FieldVariable | DynamicTextVariable | { type: 'video'; data: any } | undefined | null,
  getAsset?: (id: string) => { public_url: string | null } | null,
  collectionItemData?: Record<string, string>,
  pageCollectionItemData?: Record<string, string> | null,
  useDefault: boolean = false
): string | undefined {
  if (!src) return undefined;

  // VideoVariable (YouTube) - return undefined (handled separately as iframe)
  if (src.type === 'video') return undefined;

  if (isAssetVariable(src)) {
    if (!src.data.asset_id) {
      // asset_id is null - return default placeholder if enabled (videos typically don't have defaults)
      if (useDefault) {
        return DEFAULT_ASSETS.VIDEO;
      }
      return undefined;
    }
    if (!getAsset) return undefined;
    const asset = getAsset(src.data.asset_id);
    return asset?.public_url || undefined;
  }

  if (isFieldVariable(src)) {
    const fieldId = src.data.field_id;
    if (!fieldId) return undefined;

    // Use source-aware resolution (respects source: 'page' | 'collection')
    const resolvedValue = resolveFieldFromSources(
      fieldId,
      src.data.source,
      collectionItemData,
      pageCollectionItemData
    );
    if (!resolvedValue) return undefined;

    // The field value may be an asset ID - look up the asset to get the URL
    if (getAsset) {
      const asset = getAsset(resolvedValue);
      if (asset?.public_url) {
        return asset.public_url;
      }
    }

    // If getAsset is not available or asset not found, return the raw value
    // (might be a URL in text fields)
    return resolvedValue;
  }

  if (isDynamicTextVariable(src)) {
    const content = src.data.content;
    // Resolve inline variables if present
    if (content.includes('<ycode-inline-variable>')) {
      return resolveInlineVariablesFromData(content, collectionItemData, pageCollectionItemData);
    }
    return content;
  }

  return undefined;
}

/**
 * Get iframe URL from iframe src variable
 * - DynamicTextVariable -> returns content as URL
 *
 * @param src - The iframe src variable (DynamicTextVariable)
 * @returns Iframe URL string or undefined
 */
export function getIframeUrlFromVariable(
  src: DynamicTextVariable | undefined | null
): string | undefined {
  if (!src) return undefined;

  if (isDynamicTextVariable(src)) {
    return src.data.content;
  }

  return undefined;
}

/**
 * Design Color Binding Utilities
 */

import type { DesignColorVariable } from '@/types';

/**
 * Convert Tailwind color format (#rrggbb/NN) to valid CSS rgba().
 * Passes through standard hex and other formats unchanged.
 */
function tailwindColorToCss(color: string): string {
  const match = color.match(/^#([0-9a-fA-F]{6})\/(\d+)$/);
  if (!match) return color;
  const r = parseInt(match[1].slice(0, 2), 16);
  const g = parseInt(match[1].slice(2, 4), 16);
  const b = parseInt(match[1].slice(4, 6), 16);
  const a = parseInt(match[2], 10) / 100;
  return `rgba(${r},${g},${b},${a})`;
}

/** Maps design color binding keys to CSS property names for inline styles */
export const DESIGN_COLOR_CSS_MAP: Record<string, string> = {
  backgroundColor: 'backgroundColor',
  color: 'color',
  borderColor: 'borderColor',
  divideColor: '--tw-divide-color',
  textDecorationColor: 'textDecorationColor',
};

/**
 * Resolve a DesignColorVariable to a CSS value string using a field resolver.
 * Returns the resolved CSS value (solid color or gradient string) or null.
 */
export function resolveDesignColorBinding(
  binding: DesignColorVariable,
  resolveField: (fieldVar: FieldVariable) => string | null | undefined,
): string | null {
  // Solid mode
  if (binding.mode === 'solid') {
    return binding.field ? (resolveField(binding.field) ?? null) : null;
  }

  // Gradient mode — read stops from the active mode's storage
  const modeData = binding.mode === 'linear' ? binding.linear : binding.radial;
  const stops = modeData?.stops;
  if (!stops || stops.length === 0) return null;

  const resolvedStops = stops.map(stop => {
    // Normalize static fallback from Tailwind format (#rrggbb/NN) to valid CSS
    const fallback = tailwindColorToCss(stop.color);
    const color = stop.field ? (resolveField(stop.field) || fallback) : fallback;
    return `${color} ${stop.position}%`;
  });

  if (binding.mode === 'linear') {
    const angle = modeData && 'angle' in modeData ? (modeData as { angle?: number }).angle ?? 90 : 90;
    return `linear-gradient(${angle}deg, ${resolvedStops.join(', ')})`;
  }

  return `radial-gradient(circle, ${resolvedStops.join(', ')})`;
}

/**
 * Resolve all design color bindings for a layer to inline CSS styles.
 * Returns a Record of CSS property → value, or undefined if no bindings resolved.
 */
export function resolveDesignStyles(
  designBindings: Record<string, DesignColorVariable> | undefined,
  resolveField: (fieldVar: FieldVariable) => string | null | undefined,
): Record<string, string> | undefined {
  if (!designBindings) return undefined;

  const styles: Record<string, string> = {};
  for (const [designProp, binding] of Object.entries(designBindings)) {
    if (!binding) continue;
    const resolved = resolveDesignColorBinding(binding, resolveField);
    const cssProp = DESIGN_COLOR_CSS_MAP[designProp];
    if (resolved && cssProp) {
      // For gradient values, use 'background' instead of 'backgroundColor'
      const finalProp = cssProp === 'backgroundColor' && resolved.includes('gradient') ? 'background' : cssProp;
      styles[finalProp] = resolved;
    }
  }

  return Object.keys(styles).length > 0 ? styles : undefined;
}

/**
 * Link Variable Utilities
 */

import type { LinkSettings, LinkType } from '@/types';
