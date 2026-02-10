/**
 * CMS Variables Utilities
 *
 * Utilities for parsing and converting CMS variable strings
 * Format: <ycode-inline-variable>{"type":"field","data":{"field_id":"..."}}</ycode-inline-variable>
 */

import type { CollectionField, InlineVariable } from '@/types';
import { formatDateInTimezone } from '@/lib/date-format-utils';
import { extractPlainTextFromTiptap } from '@/lib/tiptap-utils';

/**
 * Format a field value for display based on field type
 * - date: formats in user's timezone
 * - rich_text: extracts plain text from Tiptap JSON
 * Returns the original value for other fields
 */
export function formatFieldValue(
  value: unknown,
  fieldType: string | null | undefined,
  timezone: string = 'UTC'
): string {
  if (value === null || value === undefined) return '';

  // Handle rich_text fields - extract plain text from Tiptap JSON
  if (fieldType === 'rich_text') {
    if (typeof value === 'object') {
      return extractPlainTextFromTiptap(value);
    }
    // If it's a string (legacy or unparsed), try to parse and extract
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return extractPlainTextFromTiptap(parsed);
      } catch {
        return value;
      }
    }
    return '';
  }

  // Handle date fields
  if (fieldType === 'date' && typeof value === 'string') {
    return formatDateInTimezone(value, timezone, 'display');
  }

  // For other fields, ensure we return a string
  if (typeof value === 'object') {
    // Safety fallback - if an object slips through, stringify it
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Resolve a field value from data sources based on source preference
 * Used for inline variables with page/collection source selection
 *
 * @param fieldId - The field ID (or field path for nested references)
 * @param source - Optional source preference ('page' | 'collection')
 * @param collectionItemData - Merged collection layer data
 * @param pageCollectionItemData - Page collection data for dynamic pages
 * @param collectionLayerId - Optional specific collection layer ID (for layer-specific resolution)
 * @param layerDataMap - Optional map of layer ID → item data (for layer-specific resolution)
 */
export function resolveFieldFromSources(
  fieldId: string,
  source: string | undefined,
  collectionItemData?: Record<string, string>,
  pageCollectionItemData?: Record<string, string> | null,
  collectionLayerId?: string,
  layerDataMap?: Record<string, Record<string, string>>
): string | undefined {
  // Page source - use page data only
  if (source === 'page') {
    return pageCollectionItemData?.[fieldId];
  }

  // If specific layer ID is provided and exists in layerDataMap, use that layer's data
  if (collectionLayerId && layerDataMap?.[collectionLayerId]) {
    return layerDataMap[collectionLayerId][fieldId];
  }

  // Collection source - use merged collection data
  if (source === 'collection') {
    return collectionItemData?.[fieldId];
  }

  // No explicit source - check collection first, then page (backwards compatibility)
  return collectionItemData?.[fieldId] ?? pageCollectionItemData?.[fieldId];
}

/**
 * Gets the display label for a variable based on its type and data
 * - Root fields: just "FieldName"
 * - Nested fields: "SourceName FieldName" (source = immediate parent reference)
 */
export function getVariableLabel(
  variable: InlineVariable,
  fields?: CollectionField[],
  allFields?: Record<string, CollectionField[]>
): string {
  if (variable.type === 'field' && variable.data?.field_id) {
    const rootField = fields?.find(f => f.id === variable.data.field_id);
    const relationships = variable.data.relationships || [];

    if (relationships.length > 0 && allFields) {
      // For nested references, show "SourceName FieldName"
      // where SourceName is the immediate parent reference field
      let sourceName = rootField?.name || '[Deleted]';
      let currentFields = rootField?.reference_collection_id
        ? allFields[rootField.reference_collection_id]
        : [];
      let finalFieldName = '';

      for (let i = 0; i < relationships.length; i++) {
        const relId = relationships[i];
        const relField = currentFields?.find(f => f.id === relId);

        if (i === relationships.length - 1) {
          // Last field in chain - this is the actual field we're selecting
          finalFieldName = relField?.name || '[Deleted]';
        } else {
          // Intermediate reference - update source name
          sourceName = relField?.name || '[Deleted]';
          currentFields = relField?.reference_collection_id
            ? allFields[relField.reference_collection_id]
            : [];
        }
      }

      return `${sourceName} ${finalFieldName}`;
    }

    return rootField?.name || '[Deleted Field]';
  }
  return variable.type;
}

/**
 * Converts string with variables to Tiptap JSON content
 * Supports both ID-based format and legacy embedded JSON format
 * ID-based: <ycode-inline-variable id="uuid"></ycode-inline-variable>
 * Legacy: <ycode-inline-variable>JSON</ycode-inline-variable>
 */
export function parseValueToContent(
  text: string,
  fields?: CollectionField[],
  variables?: Record<string, InlineVariable>,
  allFields?: Record<string, CollectionField[]>
): {
  type: 'doc';
  content: Array<{
    type: 'paragraph';
    content?: any[];
  }>;
} {
  const content: any[] = [];
  const regex = /<ycode-inline-variable(?:\s+id="([^"]+)")?>([\s\S]*?)<\/ycode-inline-variable>/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const textContent = text.slice(lastIndex, match.index);
      if (textContent) {
        content.push({
          type: 'text',
          text: textContent,
        });
      }
    }

    const variableId = match[1]; // ID from id="..." attribute
    const variableContent = match[2].trim(); // Content inside tag
    let variable: InlineVariable | null = null;
    let label: string = 'variable';

    // Priority 1: Look up by ID if provided and variables map exists
    if (variableId && variables && variables[variableId]) {
      variable = variables[variableId];
      label = getVariableLabel(variable, fields, allFields);
    }
    // Priority 2: Parse embedded JSON (legacy format)
    else if (variableContent) {
      try {
        const parsed = JSON.parse(variableContent);
        if (parsed.type && parsed.data) {
          variable = parsed;
          label = getVariableLabel(parsed, fields, allFields);
        }
      } catch {
        // Invalid JSON, skip this variable
      }
    }

    if (variable) {
      content.push({
        type: 'dynamicVariable',
        attrs: {
          variable,
          label,
        },
      });
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const textContent = text.slice(lastIndex);
    if (textContent) {
      content.push({
        type: 'text',
        text: textContent,
      });
    }
  }

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: content.length > 0 ? content : undefined,
      },
    ],
  };
}

/**
 * Converts Tiptap JSON content back to string
 * Outputs format: <ycode-inline-variable>{"type":"field","data":{"field_id":"..."}}</ycode-inline-variable>
 */
export function convertContentToValue(content: any): string {
  let result = '';

  if (content?.content) {
    for (const block of content.content) {
      if (block.content) {
        for (const node of block.content) {
          if (node.type === 'text') {
            result += node.text;
          } else if (node.type === 'dynamicVariable') {
            if (node.attrs.variable) {
              result += `<ycode-inline-variable>${JSON.stringify(node.attrs.variable)}</ycode-inline-variable>`;
            }
          }
        }
      }
    }
  }

  return result;
}
