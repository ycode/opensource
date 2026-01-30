import type { Collection, CollectionFieldType } from '@/types';
import { sanitizeSlug } from './page-utils';

/**
 * Collection Utilities
 *
 * Helper functions for working with EAV (Entity-Attribute-Value) collections.
 * Handles value type casting between text storage and typed values.
 */

/**
 * Sort collections by order field
 * If two collections have the same order, sort by name alphabetically
 * If two collections have the same order and name, sort by created_at time
 * @param collections - Array of collections to sort
 * @returns Sorted array of collections
 */
export function sortCollectionsByOrder(collections: Collection[]): Collection[] {
  return [...collections].sort((a, b) => {
    // If orders are different, sort by order
    if (a.order !== b.order) {
      return a.order - b.order;
    }

    // If orders are the same, sort by name
    const nameComparison = a.name.localeCompare(b.name);
    if (nameComparison !== 0) {
      return nameComparison;
    }

    // If names are also the same, sort by created_at (oldest first)
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

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

    case 'rich_text':
      // Parse TipTap JSON from stored string
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }

    case 'link':
      // Parse link settings from stored JSON
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }

    case 'email':
    case 'phone':
    case 'text':
    default:
      // Try to parse JSON for text fields that might contain JSON objects
      if (value.startsWith('{') || value.startsWith('[')) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
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

  // Always JSON.stringify objects to prevent [object Object]
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

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

    case 'link':
      // Store link settings as JSON
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);

    case 'email':
    case 'phone':
    case 'rich_text':
    case 'text':
    default:
      return String(value);
  }
}

/**
 * Generate a slug from a name with international character support
 * Uses the same transliteration logic as page slugs
 * @param name - The name to slugify
 * @returns URL-safe slug with transliterated characters
 *
 * @example
 * slugify('Apie mus') // 'apie-mus'
 * slugify('О нас') // 'o-nas'
 * slugify('Über uns') // 'ueber-uns'
 */
export function slugify(name: string): string {
  return sanitizeSlug(name);
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
