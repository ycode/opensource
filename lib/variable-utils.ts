/**
 * Variable Utilities
 * 
 * Helper functions for working with the new variable types:
 * - AssetVariable
 * - FieldVariable  
 * - DynamicTextVariable
 * - StaticTextVariable
 */

import type { AssetVariable, FieldVariable, DynamicTextVariable, StaticTextVariable } from '@/types';
import { resolveInlineVariables } from '@/lib/inline-variables';

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
 * - FieldVariable -> resolves field value (requires collectionItemData and resolveFieldValue)
 * - DynamicTextVariable -> returns content as URL
 * 
 * @param src - The image src variable (AssetVariable | FieldVariable | DynamicTextVariable)
 * @param getAsset - Function to get asset by ID (required for AssetVariable)
 * @param resolveFieldValue - Function to resolve field variable (required for FieldVariable)
 * @param collectionItemData - Collection item data for field resolution (required for FieldVariable)
 * @returns Image URL string or undefined
 */
export function getImageUrlFromVariable(
  src: AssetVariable | FieldVariable | DynamicTextVariable | undefined | null,
  getAsset?: (id: string) => { public_url: string | null } | null,
  resolveFieldValue?: (variable: FieldVariable, collectionItemData?: Record<string, string>) => string | undefined,
  collectionItemData?: Record<string, string>
): string | undefined {
  if (!src) return undefined;

  if (isAssetVariable(src)) {
    if (!getAsset || !src.data.asset_id) return undefined;
    const asset = getAsset(src.data.asset_id);
    return asset?.public_url || undefined;
  }

  if (isFieldVariable(src)) {
    if (!resolveFieldValue) return undefined;
    return resolveFieldValue(src, collectionItemData);
  }

  if (isDynamicTextVariable(src)) {
    return src.data.content;
  }

  return undefined;
}

/**
 * Get video URL from video src variable
 * - AssetVariable -> gets asset URL from store
 * - FieldVariable -> resolves field value (requires collectionItemData and resolveFieldValue)
 * - DynamicTextVariable -> returns content as URL (resolves inline variables if collectionItemData provided)
 * - VideoVariable -> returns undefined (YouTube videos are handled separately as iframes)
 * 
 * @param src - The video src variable (AssetVariable | FieldVariable | DynamicTextVariable | VideoVariable)
 * @param getAsset - Function to get asset by ID (required for AssetVariable)
 * @param resolveFieldValue - Function to resolve field variable (required for FieldVariable)
 * @param collectionItemData - Collection item data for field resolution (required for FieldVariable and inline variables)
 * @returns Video URL string or undefined
 */
export function getVideoUrlFromVariable(
  src: AssetVariable | FieldVariable | DynamicTextVariable | { type: 'video'; data: any } | undefined | null,
  getAsset?: (id: string) => { public_url: string | null } | null,
  resolveFieldValue?: (variable: FieldVariable, collectionItemData?: Record<string, string>) => string | undefined,
  collectionItemData?: Record<string, string>
): string | undefined {
  if (!src) return undefined;

  // VideoVariable (YouTube) - return undefined (handled separately as iframe)
  if (src.type === 'video') return undefined;

  if (isAssetVariable(src)) {
    if (!getAsset || !src.data.asset_id) return undefined;
    const asset = getAsset(src.data.asset_id);
    return asset?.public_url || undefined;
  }

  if (isFieldVariable(src)) {
    if (!resolveFieldValue) return undefined;
    return resolveFieldValue(src, collectionItemData);
  }

  if (isDynamicTextVariable(src)) {
    const content = src.data.content;
    // Resolve inline variables if collectionItemData is available
    if (content.includes('<ycode-inline-variable>') && collectionItemData) {
      const mockItem: any = {
        id: 'temp',
        collection_id: 'temp',
        created_at: '',
        updated_at: '',
        deleted_at: null,
        manual_order: 0,
        is_published: true,
        values: collectionItemData,
      };
      return resolveInlineVariables(content, mockItem);
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
