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
  return value && typeof value === 'object' && value.type === 'asset' && value.data?.asset_id;
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
    return variable.data.asset_id;
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
