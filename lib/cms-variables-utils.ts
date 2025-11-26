/**
 * CMS Variables Utilities
 *
 * Utilities for parsing and converting CMS variable strings
 * Format: <ycode-inline-variable>{"type":"field","data":{"field_id":"..."}}</ycode-inline-variable>
 */

import type { CollectionField, InlineVariable } from '@/types';

/**
 * Gets the display label for a variable based on its type and data
 */
export function getVariableLabel(
  variable: InlineVariable,
  fields?: CollectionField[]
): string {
  if (variable.type === 'field' && variable.data?.field_id) {
    const field = fields?.find(f => f.id === variable.data.field_id);
    return field?.name || '[Deleted Field]';
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
  variables?: Record<string, InlineVariable>
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
      label = getVariableLabel(variable, fields);
    }
    // Priority 2: Parse embedded JSON (legacy format)
    else if (variableContent) {
      try {
        const parsed = JSON.parse(variableContent);
        if (parsed.type && parsed.data) {
          variable = parsed;
          label = getVariableLabel(parsed, fields);
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
