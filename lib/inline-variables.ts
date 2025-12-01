/**
 * Inline Variables Utilities
 *
 * Pure string manipulation for resolving inline field variables.
 * CLIENT-SAFE: Can be imported by both client and server components.
 */

import type { CollectionItemWithValues } from '@/types';

/**
 * Resolve inline variables in a text string
 * Replaces <ycode-inline-variable>{"type":"field","data":{"field_id":"..."}}</ycode-inline-variable>
 * with actual field values from the collection item
 *
 * CLIENT-SAFE: Pure string manipulation, works on both client and server
 */
export function resolveInlineVariables(
  text: string,
  collectionItem: CollectionItemWithValues | null | undefined
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
        const fieldValue = collectionItem.values[fieldId];

        // Replace the variable with the actual value (or empty string if not found)
        return fieldValue || '';
      }
    } catch {
      // Invalid JSON or not a field variable, leave as is
    }

    return match;
  });
}
