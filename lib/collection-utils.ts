import type { CollectionFieldType } from '@/types';

/**
 * Collection Utilities
 *
 * Helper functions for working with EAV (Entity-Attribute-Value) collections.
 * Handles value type casting between text storage and typed values.
 */

/**
 * Cast a text value to its proper type based on field type
 * @param value - The text value from database
 * @param type - The field type to cast to
 * @returns The value cast to the appropriate type
 */
export function castValue(value: string | null, type: CollectionFieldType): any {
  if (value === null || value === undefined || value === '') return null;

  switch (type) {
    case 'number':
      const num = parseFloat(value);
      return isNaN(num) ? null : num;

    case 'boolean':
      return value === 'true' || value === '1' || value === 'yes';

    case 'date':
      // Return as ISO string for consistency
      return value;

    case 'reference':
      // Return as number (ID of referenced item)
      const refId = parseInt(value, 10);
      return isNaN(refId) ? null : refId;

    case 'text':
    default:
      return value;
  }
}

/**
 * Convert a typed value to string for storage
 * @param value - The typed value
 * @param type - The field type
 * @returns String representation for database storage
 */
export function valueToString(value: any, type: CollectionFieldType): string | null {
  if (value === null || value === undefined) return null;

  switch (type) {
    case 'boolean':
      return value ? 'true' : 'false';

    case 'number':
      return String(value);

    case 'date':
      // Expect ISO string or Date object
      if (value instanceof Date) {
        return value.toISOString();
      }
      return String(value);

    case 'reference':
      // Store ID as string
      return String(value);

    case 'text':
    default:
      return String(value);
  }
}

/**
 * Generate a slug from a name
 * @param name - The name to slugify
 * @returns URL-safe slug
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-')  // Replace spaces and underscores with single dash
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing dashes
}

/**
 * Validate field name format (lowercase, alphanumeric, underscores)
 * @param fieldName - The field name to validate
 * @returns True if valid
 */
export function isValidFieldName(fieldName: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(fieldName);
}

/**
 * Validate collection name format (lowercase, alphanumeric, hyphens)
 * @param collectionName - The collection name to validate
 * @returns True if valid
 */
export function isValidCollectionName(collectionName: string): boolean {
  return /^[a-z][a-z0-9-]*$/.test(collectionName);
}







