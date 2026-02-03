/**
 * Inline Variables Utilities
 *
 * Pure string manipulation for resolving inline field variables.
 * CLIENT-SAFE: Can be imported by both client and server components.
 */

import type { CollectionItemWithValues } from '@/types';
import { formatDateInTimezone } from '@/lib/date-format-utils';

/**
 * Resolve inline variables in a text string
 * Replaces <ycode-inline-variable>{"type":"field","data":{"field_id":"...","field_type":"..."}}</ycode-inline-variable>
 * with actual field values from the collection item
 *
 * CLIENT-SAFE: Pure string manipulation, works on both client and server
 * @param timezone - Optional timezone for formatting date values (defaults to UTC)
 */
export function resolveInlineVariables(
  text: string,
  collectionItem: CollectionItemWithValues | null | undefined,
  timezone: string = 'UTC'
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
        const fieldType = parsed.data.field_type;
        const fieldValue = collectionItem.values[fieldId];

        if (!fieldValue) return '';

        // Format date fields using timezone
        if (fieldType === 'date') {
          return formatDateInTimezone(fieldValue, timezone, 'display');
        }

        return fieldValue;
      }
    } catch {
      // Invalid JSON or not a field variable, leave as is
    }

    return match;
  });
}

/**
 * Resolve inline variables using raw field value maps
 * Supports both collection layer data and page collection data (dynamic pages)
 * @param timezone - Optional timezone for formatting date values (defaults to UTC)
 */
export function resolveInlineVariablesFromData(
  text: string,
  collectionItemData?: Record<string, string>,
  pageCollectionItemData?: Record<string, string> | null,
  timezone: string = 'UTC'
): string {
  if (!text) return '';
  if (!collectionItemData && !pageCollectionItemData) {
    // Remove variable tags if no data available
    return text.replace(/<ycode-inline-variable>[\s\S]*?<\/ycode-inline-variable>/g, '');
  }

  const regex = /<ycode-inline-variable>([\s\S]*?)<\/ycode-inline-variable>/g;
  return text.replace(regex, (match, variableContent) => {
    try {
      const parsed = JSON.parse(variableContent.trim());
      if (parsed.type === 'field' && parsed.data?.field_id) {
        const fieldId = parsed.data.field_id;
        const fieldType = parsed.data.field_type;
        const source = parsed.data.source;

        let fieldValue: string | undefined;
        if (source === 'page') {
          fieldValue = pageCollectionItemData?.[fieldId];
        } else if (source === 'collection') {
          fieldValue = collectionItemData?.[fieldId];
        } else {
          // No explicit source - check collection first, then page
          fieldValue = collectionItemData?.[fieldId] ?? pageCollectionItemData?.[fieldId];
        }

        if (!fieldValue) return '';

        // Format date fields using timezone
        if (fieldType === 'date') {
          return formatDateInTimezone(fieldValue, timezone, 'display');
        }

        return fieldValue;
      }
    } catch {
      // Invalid JSON
    }
    return match;
  });
}
