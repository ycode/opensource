import React from 'react';
import type { TextStyle, DynamicRichTextVariable } from '@/types';

/**
 * Default text styles for formatting marks (bold, italic, underline, etc.)
 * Used in text element templates and can be overridden per layer
 */
export const DEFAULT_TEXT_STYLES: Record<string, TextStyle> = {
  bold: {
    classes: 'font-bold',
  },
  italic: {
    classes: 'italic'
  },
  underline: {
    classes: 'underline'
  },
  strike: {
    classes: 'line-through'
  },
  code: {
    classes: 'font-mono bg-muted px-1 py-0.5 rounded text-sm'
  },
  bulletList: {
    classes: 'ml-2 pl-4 list-disc'
  },
  orderedList: {
    classes: 'ml-2 pl-5 list-decimal'
  },
  listItem: {
    classes: ''
  },
};

/**
 * Create a Tiptap text object from a plain string
 * Returns the standard Tiptap JSON structure: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: ... }] }] }
 */
export function getTiptapTextContent(text: string): {
  type: 'doc';
  content: Array<{
    type: 'paragraph';
    content: Array<{ type: 'text'; text: string }>;
  }>;
} {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: text ? [{ type: 'text', text }] : [],
      },
    ],
  };
}

/**
 * Resolve inline variable in Tiptap node
 */
function resolveVariableNode(
  node: any,
  collectionItemData?: Record<string, string>
): string {
  if (node.attrs?.variable?.type === 'field' && node.attrs.variable.data?.field_id) {
    const fieldId = node.attrs.variable.data.field_id;
    const relationships = node.attrs.variable.data.relationships || [];

    // Build the full path for relationship resolution
    if (relationships.length > 0 && collectionItemData) {
      const fullPath = [fieldId, ...relationships].join('.');
      return collectionItemData[fullPath] || '';
    }

    // Simple field lookup
    return collectionItemData?.[fieldId] || '';
  }

  return '';
}

/**
 * Render a text node with its marks (bold, italic, underline, strike)
 */
function renderTextNode(
  node: any,
  key: string,
  textStyles?: Record<string, TextStyle>
): React.ReactNode {
  let text: React.ReactNode = node.text || '';

  // Merge with defaults
  const styles = { ...DEFAULT_TEXT_STYLES, ...textStyles };

  // Apply marks in reverse order (innermost to outermost)
  if (node.marks && Array.isArray(node.marks)) {
    for (let i = node.marks.length - 1; i >= 0; i--) {
      const mark = node.marks[i];
      switch (mark.type) {
        case 'bold':
          text = React.createElement('strong', { key: `${key}-bold`, className: styles.bold?.classes }, text);
          break;
        case 'italic':
          text = React.createElement('em', { key: `${key}-italic`, className: styles.italic?.classes }, text);
          break;
        case 'underline':
          text = React.createElement('u', { key: `${key}-underline`, className: styles.underline?.classes }, text);
          break;
        case 'strike':
          text = React.createElement('s', { key: `${key}-strike`, className: styles.strike?.classes }, text);
          break;
      }
    }
  }

  return text;
}

/**
 * Render inline content (text nodes, variables, formatting)
 */
function renderInlineContent(
  content: any[],
  collectionItemData?: Record<string, string>,
  textStyles?: Record<string, TextStyle>
): React.ReactNode[] {
  return content.map((node, idx) => {
    const key = `node-${idx}`;

    if (node.type === 'text') {
      return renderTextNode(node, key, textStyles);
    }

    if (node.type === 'dynamicVariable') {
      const value = resolveVariableNode(node, collectionItemData);
      return React.createElement('span', { key }, value);
    }

    return null;
  }).filter(Boolean);
}

/**
 * Render a paragraph or list item block
 */
function renderBlock(
  block: any,
  idx: number,
  collectionItemData?: Record<string, string>,
  textStyles?: Record<string, TextStyle>,
  useSpanForParagraphs = false
): React.ReactNode {
  const key = `block-${idx}`;
  const styles = { ...DEFAULT_TEXT_STYLES, ...textStyles };

  if (block.type === 'paragraph') {
    if (!block.content || block.content.length === 0) {
      // Use span for empty paragraphs when in restrictive tags
      const tag = useSpanForParagraphs ? 'span' : 'p';
      const attrs = useSpanForParagraphs ? { key, className: 'block' } : { key };
      return React.createElement(tag, attrs, React.createElement('br'));
    }
    // Use span with block class when inside restrictive tags
    if (useSpanForParagraphs) {
      return React.createElement('span', { key, className: 'block' }, ...renderInlineContent(block.content, collectionItemData, textStyles));
    }
    return React.createElement('p', { key }, ...renderInlineContent(block.content, collectionItemData, textStyles));
  }

  if (block.type === 'bulletList') {
    return React.createElement(
      'ul',
      { key, className: styles.bulletList?.classes || DEFAULT_TEXT_STYLES.bulletList.classes },
      block.content?.map((item: any, itemIdx: number) =>
        renderListItem(item, `${key}-${itemIdx}`, collectionItemData, textStyles)
      )
    );
  }

  if (block.type === 'orderedList') {
    return React.createElement(
      'ol',
      { key, className: styles.orderedList?.classes || DEFAULT_TEXT_STYLES.orderedList.classes },
      block.content?.map((item: any, itemIdx: number) =>
        renderListItem(item, `${key}-${itemIdx}`, collectionItemData, textStyles)
      )
    );
  }

  return null;
}

/**
 * Render a list item
 */
function renderListItem(
  item: any,
  key: string,
  collectionItemData?: Record<string, string>,
  textStyles?: Record<string, TextStyle>
): React.ReactNode {
  if (item.type !== 'listItem') return null;

  const styles = { ...DEFAULT_TEXT_STYLES, ...textStyles };

  const children = item.content?.flatMap((block: any, idx: number) => {
    if (block.type === 'paragraph') {
      // For list items, render paragraph content without <p> wrapper
      return renderInlineContent(block.content || [], collectionItemData, textStyles);
    }
    return renderBlock(block, idx, collectionItemData, textStyles);
  });

  return React.createElement('li', { key, className: styles.listItem?.classes || DEFAULT_TEXT_STYLES.listItem.classes }, children);
}

/**
 * Check if rich text content contains block-level elements (lists)
 * These cannot be nested inside restrictive tags and require tag replacement
 */
export function hasBlockElements(variable: DynamicRichTextVariable): boolean {
  const content = variable.data.content;

  if (!content || typeof content !== 'object' || !('type' in content)) {
    return false;
  }

  const doc = content as any;

  if (doc.type !== 'doc' || !doc.content || !Array.isArray(doc.content)) {
    return false;
  }

  // Check if content has lists (these require tag replacement to div)
  return doc.content.some((block: any) =>
    block.type === 'bulletList' || block.type === 'orderedList'
  );
}

/**
 * Render DynamicRichTextVariable content to React elements
 * @param useSpanForParagraphs - If true, renders paragraphs as <span class="block"> instead of <p>
 */
export function renderRichText(
  variable: DynamicRichTextVariable,
  collectionItemData?: Record<string, string>,
  textStyles?: Record<string, TextStyle>,
  useSpanForParagraphs = false
): React.ReactNode {
  const content = variable.data.content;

  if (!content || typeof content !== 'object' || !('type' in content)) {
    return null;
  }

  const doc = content as any;

  if (doc.type !== 'doc' || !doc.content || !Array.isArray(doc.content)) {
    return null;
  }

  // If there's only a single paragraph, render its content inline (no <p> or <span> wrapper)
  if (doc.content.length === 1 && doc.content[0].type === 'paragraph') {
    const paragraph = doc.content[0];
    if (!paragraph.content || paragraph.content.length === 0) {
      return null;
    }
    return renderInlineContent(paragraph.content, collectionItemData, textStyles);
  }

  return doc.content.map((block: any, idx: number) =>
    renderBlock(block, idx, collectionItemData, textStyles, useSpanForParagraphs)
  );
}

/**
 * Convert DynamicRichTextVariable to Tiptap-compatible JSON content
 */
export function richTextToTiptapContent(
  variable: DynamicRichTextVariable
): any {
  return variable.data.content;
}

/**
 * Create DynamicRichTextVariable from Tiptap JSON content
 */
export function createRichTextVariable(content: any): DynamicRichTextVariable {
  return {
    type: 'dynamic_rich_text',
    data: {
      content,
    },
  };
}

/**
 * Extract plain text from DynamicRichTextVariable (strips formatting and variables)
 */
export function extractPlainText(variable: DynamicRichTextVariable): string {
  const content = variable.data.content;

  if (!content || typeof content !== 'object' || !('type' in content)) {
    return '';
  }

  const doc = content as any;
  let text = '';

  const extractFromNode = (node: any): void => {
    if (node.type === 'text') {
      text += node.text || '';
    } else if (node.content && Array.isArray(node.content)) {
      node.content.forEach(extractFromNode);
    }
  };

  if (doc.content && Array.isArray(doc.content)) {
    doc.content.forEach(extractFromNode);
  }

  return text;
}

/**
 * Convert Tiptap JSON content to string format with inline variables
 * Used for InputWithInlineVariables component
 */
export function tiptapContentToString(content: any): string {
  if (!content || typeof content !== 'object' || content.type !== 'doc') {
    return '';
  }

  let result = '';

  const processNode = (node: any): void => {
    if (node.type === 'text') {
      result += node.text || '';
    } else if (node.type === 'dynamicVariable') {
      // Convert variable node to inline variable tag
      if (node.attrs?.variable) {
        result += `<ycode-inline-variable>${JSON.stringify(node.attrs.variable)}</ycode-inline-variable>`;
      }
    } else if (node.content && Array.isArray(node.content)) {
      node.content.forEach(processNode);
    }
  };

  if (content.content && Array.isArray(content.content)) {
    content.content.forEach(processNode);
  }

  return result;
}

/**
 * Convert string with inline variables to Tiptap JSON content
 * Inverse of tiptapContentToString
 */
export function stringToTiptapContent(text: string): any {
  const content: any[] = [];
  const regex = /<ycode-inline-variable>([\s\S]*?)<\/ycode-inline-variable>/g;
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

    // Parse variable JSON
    const variableContent = match[1].trim();
    try {
      const variable = JSON.parse(variableContent);
      content.push({
        type: 'dynamicVariable',
        attrs: {
          variable,
          label: variable.data?.field_id || variable.type || 'variable',
        },
      });
    } catch {
      // Invalid JSON, skip
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
