/**
 * Resolve CMS Variables Utilities
 *
 * Utilities for resolving CMS field variables to actual values from collection items.
 *
 * This file contains both client-safe and server-only functions:
 * - Client-safe: resolveInlineVariables (re-exported from inline-variables.ts)
 * - Server-only: Asset resolution functions (require database access)
 */

import type { FieldVariable, CollectionItemWithValues, CollectionField } from '@/types';
import { isValidUUID } from '@/lib/utils';

// Re-export client-safe inline variable resolver
export { resolveInlineVariables } from '@/lib/inline-variables';

/**
 * Resolve {{FieldName}} placeholders in custom code
 * Replaces {{FieldName}} with actual field values from the collection item
 *
 * SERVER-ONLY: Requires collection fields to map field names to IDs
 */
export function resolveCustomCodePlaceholders(
  code: string,
  collectionItem: CollectionItemWithValues | null | undefined,
  fields: CollectionField[]
): string {
  if (!collectionItem || !collectionItem.values || !fields.length) {
    return code;
  }

  // Create a map of field name -> field ID for quick lookup
  const fieldNameToId = new Map<string, string>();
  fields.forEach(field => {
    fieldNameToId.set(field.name, field.id);
  });

  // Replace {{FieldName}} placeholders with actual values
  return code.replace(/\{\{([^}]+)\}\}/g, (match, fieldName) => {
    const trimmedFieldName = fieldName.trim();
    const fieldId = fieldNameToId.get(trimmedFieldName);

    if (!fieldId) {
      // Field name not found, return placeholder as-is
      return match;
    }

    // Get the value from collection item
    const fieldValue = collectionItem.values[fieldId];

    // Return the value, or empty string if not found
    // Convert to string if it's not already
    return fieldValue != null ? String(fieldValue) : '';
  });
}

/**
 * SERVER-ONLY FUNCTIONS BELOW
 * These functions require database access and should only be imported server-side.
 * Import them conditionally or use dynamic imports in server components.
 */

/**
 * Resolve a FieldVariable to an asset URL (SERVER-ONLY)
 * Returns the public_url of the asset stored in the field, or null if not found
 *
 * SERVER-ONLY: Requires database access via getAssetById
 * @param isPublished - Whether to fetch published (true) or draft (false) asset (default: false)
 */
export async function resolveFieldVariableToAssetUrl(
  fieldVariable: FieldVariable,
  collectionItem: CollectionItemWithValues | null | undefined,
  isPublished: boolean = false
): Promise<string | null> {
  // Dynamic import to ensure server-only code is only loaded server-side
  const { getAssetById } = await import('@/lib/repositories/assetRepository');

  if (!collectionItem || !collectionItem.values) {
    return null;
  }

  const fieldId = fieldVariable.data.field_id;
  if (!fieldId) {
    return null;
  }
  const assetId = collectionItem.values[fieldId];

  if (!assetId || typeof assetId !== 'string') {
    return null;
  }

  // Validate that assetId is a valid UUID before attempting to fetch
  if (!isValidUUID(assetId)) {
    console.warn(`[resolveFieldVariableToAssetUrl] Invalid UUID format: ${assetId}`);
    return null;
  }

  // Get the asset to retrieve its public_url
  const asset = await getAssetById(assetId, isPublished);
  return asset?.public_url || null;
}

/**
 * Resolve image field variable or asset ID to URL (SERVER-ONLY)
 * Handles both FieldVariable and string (asset ID) cases
 *
 * SERVER-ONLY: Requires database access via getAssetById
 * @param isPublished - Whether to fetch published (true) or draft (false) asset (default: false)
 */
export async function resolveImageUrl(
  image: string | FieldVariable | null,
  collectionItem: CollectionItemWithValues | null | undefined,
  isPublished: boolean = false
): Promise<string | null> {
  // Dynamic import to ensure server-only code is only loaded server-side
  const { getAssetById } = await import('@/lib/repositories/assetRepository');

  if (!image) {
    return null;
  }

  // If it's already a string (asset ID), validate UUID format before fetching
  if (typeof image === 'string') {
    // Validate that it's a valid UUID before attempting to fetch
    if (!isValidUUID(image)) {
      console.warn(`[resolveImageUrl] Invalid UUID format: ${image}`);
      return null;
    }

    const asset = await getAssetById(image, isPublished);
    return asset?.public_url || null;
  }

  // If it's a FieldVariable, resolve it
  if (image.type === 'field') {
    return await resolveFieldVariableToAssetUrl(image, collectionItem, isPublished);
  }

  return null;
}
