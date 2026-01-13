/**
 * CMS Variables Utilities
 *
 * Utilities for parsing and converting CMS variable strings
 * Format: <ycode-inline-variable>{"type":"field","data":{"field_id":"..."}}</ycode-inline-variable>
 */

import type { CollectionField, InlineVariable } from '@/types';

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
  // If text is already Tiptap JSON (stringified), parse and return it directly
  if (text.trim().startsWith('{"type":"doc"')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.type === 'doc') {
        return parsed;
      }
    } catch {
      // If parsing fails, fall through to legacy parsing
    }
  }

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
  // Check if content has any formatting marks (bold, italic, underline, strike)
  const hasFormatting = (content: any): boolean => {
    if (!content?.content) return false;
    
    for (const block of content.content) {
      if (block.content) {
        for (const node of block.content) {
          // Check if node has marks (formatting)
          if (node.marks && node.marks.length > 0) {
            return true;
          }
        }
      }
    }
    return false;
  };

  // If content has formatting, return the full Tiptap JSON as string
  if (hasFormatting(content)) {
    return JSON.stringify(content);
  }

  // Otherwise, convert to legacy string format with inline variable tags
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
