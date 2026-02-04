import React from 'react';
import type { TextStyle, DynamicRichTextVariable, LinkSettings } from '@/types';
import { cn } from '@/lib/utils';
import { formatFieldValue, resolveFieldFromSources } from '@/lib/cms-variables-utils';
import { generateLinkHref, type LinkResolutionContext } from '@/lib/link-utils';
import { extractInlineNodesFromRichText, isTiptapDoc } from '@/lib/tiptap-utils';

/**
 * Context for resolving rich text links - re-exports LinkResolutionContext for backwards compatibility
 */
export type RichTextLinkContext = LinkResolutionContext;

/**
 * Get a human-readable label for a text style
 * Returns the style.label if it exists, otherwise formats the key (camelCase to Title Case)
 * @param key - The text style key (e.g., 'bold', 'bulletList')
 * @param style - Optional TextStyle object that may contain a label
 * @returns Formatted label string
 */
export function getTextStyleLabel(key: string, style?: TextStyle): string {
  // Dynamic styles (dts-*) get a generic label
  if (key.startsWith('dts-')) {
    return 'Dynamic Style';
  }

  // Return the label if it exists
  if (style?.label) {
    return style.label;
  }

  // Convert camelCase to Title Case
  // e.g., 'bulletList' → 'Bullet List', 'bold' → 'Bold'
  return key
    .replace(/([A-Z])/g, ' $1') // Add space before capital letters
    .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
    .trim();
}

/**
 * Default text styles for formatting marks (bold, italic, underline, etc.)
 * Used in text element templates and can be overridden per layer
 */
export const DEFAULT_TEXT_STYLES: Record<string, TextStyle> = {
  bold: {
    label: 'Bold',
    classes: 'font-bold',
    design: {
      typography: { fontWeight: 'bold' },
    },
  },
  italic: {
    label: 'Italic',
    classes: 'italic',
    design: {
      typography: { fontStyle: 'italic' },
    },
  },
  underline: {
    label: 'Underline',
    classes: 'underline',
    design: {
      typography: { textDecoration: 'underline' },
    },
  },
  strike: {
    label: 'Strikethrough',
    classes: 'line-through',
    design: {
      typography: { textDecoration: 'line-through' },
    },
  },
  subscript: {
    label: 'Subscript',
    classes: 'align-sub',
    design: {
      typography: { verticalAlign: 'sub' },
    },
  },
  superscript: {
    label: 'Superscript',
    classes: 'align-super',
    design: {
      typography: { verticalAlign: 'super' },
    },
  },
  code: {
    label: 'Code',
    classes: 'font-mono bg-muted px-1 py-0.5 rounded text-sm',
    design: {
      typography: { fontFamily: 'mono', fontSize: 'sm' },
      backgrounds: { backgroundColor: 'muted' },
      spacing: { paddingLeft: '1', paddingRight: '1', paddingTop: '0.5', paddingBottom: '0.5' },
      borders: { borderRadius: 'rounded' },
    },
  },
  link: {
    label: 'Link',
    classes: 'text-[#1c70d7] underline underline-offset-2',
    design: {
      typography: {
        textDecoration: 'underline',
        color: '#1c70d7',
      },
    },
  },
  bulletList: {
    label: 'Bullet List',
    classes: 'ml-2 pl-4 list-disc',
    design: {
      spacing: { marginLeft: '2', paddingLeft: '4' },
    },
  },
  orderedList: {
    label: 'Ordered List',
    classes: 'ml-2 pl-5 list-decimal',
    design: {
      spacing: { marginLeft: '2', paddingLeft: '5' },
    },
  },
  listItem: {
    label: 'List Item',
    classes: '',
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
 * Get variable node metadata and raw value
 * Returns the field type and raw value (useful for rich_text handling)
 */
function getVariableNodeData(
  node: any,
  collectionItemData?: Record<string, string>,
  pageCollectionItemData?: Record<string, string>
): { fieldType: string | null; rawValue: unknown } {
  if (node.attrs?.variable?.type === 'field' && node.attrs.variable.data?.field_id) {
    const { field_id, field_type, relationships = [], source } = node.attrs.variable.data;

    // Build the full path for relationship resolution
    const fieldPath = relationships.length > 0
      ? [field_id, ...relationships].join('.')
      : field_id;

    const rawValue = resolveFieldFromSources(fieldPath, source, collectionItemData, pageCollectionItemData);
    return { fieldType: field_type || null, rawValue };
  }

  return { fieldType: null, rawValue: undefined };
}

/**
 * Resolve inline variable in Tiptap node
 * @param node - TipTap dynamicVariable node
 * @param collectionItemData - Data from collection layer items
 * @param pageCollectionItemData - Data from page collection (dynamic pages)
 * @param timezone - Timezone for formatting date values
 */
function resolveVariableNode(
  node: any,
  collectionItemData?: Record<string, string>,
  pageCollectionItemData?: Record<string, string>,
  timezone: string = 'UTC'
): string {
  const { fieldType, rawValue } = getVariableNodeData(node, collectionItemData, pageCollectionItemData);
  return formatFieldValue(rawValue, fieldType, timezone);
}

/**
 * Render a text node with its marks (bold, italic, underline, strike)
 * @param isEditMode - If true, adds data-style attributes for style selection on canvas
 * @param collectionItemData - Collection layer item values for resolving inline variables
 * @param pageCollectionItemData - Page collection item values for resolving inline variables (dynamic pages)
 */
function renderTextNode(
  node: any,
  key: string,
  textStyles?: Record<string, TextStyle>,
  isEditMode = false,
  collectionItemData?: Record<string, string>,
  pageCollectionItemData?: Record<string, string>,
  linkContext?: RichTextLinkContext
): React.ReactNode {
  let text: React.ReactNode = node.text || '';

  // Helper: use layer textStyles if set, otherwise fall back to DEFAULT_TEXT_STYLES
  const getMarkClass = (markKey: string) =>
    textStyles?.[markKey]?.classes ?? DEFAULT_TEXT_STYLES[markKey]?.classes;

  // Apply marks in reverse order (innermost to outermost)
  if (node.marks && Array.isArray(node.marks)) {
    for (let i = node.marks.length - 1; i >= 0; i--) {
      const mark = node.marks[i];
      // Build props with optional data-style for edit mode
      const buildProps = (markKey: string, className?: string) => {
        const props: Record<string, any> = { key: `${key}-${markKey}`, className };
        if (isEditMode) {
          props['data-style'] = markKey;
        }
        return props;
      };

      switch (mark.type) {
        case 'bold':
          text = React.createElement('strong', buildProps('bold', getMarkClass('bold')), text);
          break;
        case 'italic':
          text = React.createElement('em', buildProps('italic', getMarkClass('italic')), text);
          break;
        case 'underline':
          text = React.createElement('u', buildProps('underline', getMarkClass('underline')), text);
          break;
        case 'strike':
          text = React.createElement('s', buildProps('strike', getMarkClass('strike')), text);
          break;
        case 'subscript':
          text = React.createElement('sub', buildProps('subscript', getMarkClass('subscript')), text);
          break;
        case 'superscript':
          text = React.createElement('sup', buildProps('superscript', getMarkClass('superscript')), text);
          break;
        case 'dynamicStyle': {
          // Dynamic style stores an array of styleKeys
          const styleKeys: string[] = mark.attrs?.styleKeys || [];
          // Backwards compatibility: single styleKey
          if (styleKeys.length === 0 && mark.attrs?.styleKey) {
            styleKeys.push(mark.attrs.styleKey);
          }
          // Combine classes from all styleKeys using cn() for intelligent merging
          // Later styles override earlier ones for conflicting properties
          const mergedStyles = { ...DEFAULT_TEXT_STYLES, ...textStyles };
          const classesArray = styleKeys
            .map(k => mergedStyles[k]?.classes || '')
            .filter(Boolean);
          const styleClasses = cn(...classesArray);
          const lastKey = styleKeys[styleKeys.length - 1];
          const props: Record<string, any> = {
            key: `${key}-${lastKey || 'dynamicStyle'}`,
            className: styleClasses,
          };
          if (isEditMode) {
            props['data-style-keys'] = JSON.stringify(styleKeys);
            props['data-style-key'] = lastKey; // For click detection
          }
          text = React.createElement('span', props, text);
          break;
        }
        case 'richTextLink': {
          // Rich text link with full LinkSettings stored in attrs
          // In edit mode, skip expensive link resolution and just use '#'
          const href = isEditMode
            ? '#'
            : (() => {
              // Build context with collection item data for inline variable resolution
              const fullContext: LinkResolutionContext = {
                ...linkContext,
                collectionItemData,
                pageCollectionItemData,
              };
              // Use shared link generation utility
              return generateLinkHref(mark.attrs as LinkSettings, fullContext) || '#';
            })();

          const linkProps: Record<string, any> = {
            key: `${key}-richTextLink`,
            href,
            className: getMarkClass('link'),
          };

          if (mark.attrs?.target) {
            linkProps.target = mark.attrs.target;
          }
          if (mark.attrs?.rel || mark.attrs?.target === '_blank') {
            linkProps.rel = mark.attrs.rel || 'noopener noreferrer';
          }
          if (mark.attrs?.download) {
            linkProps.download = true;
          }

          // In edit mode, prevent navigation and add data-style for styling
          if (isEditMode) {
            linkProps.onClick = (e: React.MouseEvent) => e.preventDefault();
            linkProps['data-style'] = 'link';
          }

          text = React.createElement('a', linkProps, text);
          break;
        }
      }
    }
  }

  return text;
}

/**
 * Render nested rich text content from a Tiptap JSON structure
 * Used when a rich_text CMS field is inserted as an inline variable
 * Flattens the content to render inline with surrounding text
 */
function renderNestedRichTextContent(
  richTextValue: any,
  key: string,
  collectionItemData?: Record<string, string>,
  pageCollectionItemData?: Record<string, string>,
  textStyles?: Record<string, TextStyle>,
  isEditMode = false,
  linkContext?: RichTextLinkContext,
  timezone: string = 'UTC'
): React.ReactNode[] {
  // richTextValue should be a Tiptap doc structure: { type: 'doc', content: [...] }
  if (!richTextValue || typeof richTextValue !== 'object') {
    return [];
  }

  // If it's a string (legacy format), try to parse it
  let parsed = richTextValue;
  if (typeof richTextValue === 'string') {
    try {
      parsed = JSON.parse(richTextValue);
    } catch {
      // If parsing fails, return as plain text
      return [React.createElement('span', { key }, richTextValue)];
    }
  }

  // Handle Tiptap doc structure
  if (parsed.type === 'doc' && Array.isArray(parsed.content)) {
    // Extract all inline nodes from the nested content
    const inlineNodes = extractInlineNodesFromRichText(parsed.content);

    if (inlineNodes.length === 0) {
      return [];
    }

    // Render the flattened inline content
    const rendered = renderInlineContent(
      inlineNodes,
      collectionItemData,
      pageCollectionItemData,
      textStyles,
      isEditMode,
      linkContext,
      timezone
    );

    // Add unique keys to each rendered node
    return rendered.map((node, nodeIdx) => {
      if (React.isValidElement(node)) {
        return React.cloneElement(node, { key: `${key}-nested-${nodeIdx}` });
      }
      // Wrap non-element nodes (strings, etc.) in a span
      return React.createElement('span', { key: `${key}-nested-${nodeIdx}` }, node);
    });
  }

  return [];
}

/**
 * Render inline content (text nodes, variables, formatting)
 */
function renderInlineContent(
  content: any[],
  collectionItemData?: Record<string, string>,
  pageCollectionItemData?: Record<string, string>,
  textStyles?: Record<string, TextStyle>,
  isEditMode = false,
  linkContext?: RichTextLinkContext,
  timezone: string = 'UTC'
): React.ReactNode[] {
  return content.flatMap((node, idx) => {
    const key = `node-${idx}`;

    if (node.type === 'text') {
      return [renderTextNode(node, key, textStyles, isEditMode, collectionItemData, pageCollectionItemData, linkContext)];
    }

    if (node.type === 'dynamicVariable') {
      const { fieldType, rawValue } = getVariableNodeData(node, collectionItemData, pageCollectionItemData);

      // Handle rich_text fields - render nested Tiptap content
      if (fieldType === 'rich_text' && rawValue && typeof rawValue === 'object') {
        return renderNestedRichTextContent(
          rawValue,
          key,
          collectionItemData,
          pageCollectionItemData,
          textStyles,
          isEditMode,
          linkContext,
          timezone
        );
      }

      // For other field types, render as text
      const value = formatFieldValue(rawValue, fieldType, timezone);
      const textNode = {
        type: 'text',
        text: value,
        marks: node.marks || [],
      };
      return [renderTextNode(textNode, key, textStyles, isEditMode, collectionItemData, pageCollectionItemData)];
    }

    return [];
  }).filter(Boolean);
}

/**
 * Render a paragraph or list item block
 */
function renderBlock(
  block: any,
  idx: number,
  collectionItemData?: Record<string, string>,
  pageCollectionItemData?: Record<string, string>,
  textStyles?: Record<string, TextStyle>,
  useSpanForParagraphs = false,
  isEditMode = false,
  linkContext?: RichTextLinkContext,
  timezone: string = 'UTC'
): React.ReactNode {
  const key = `block-${idx}`;

  if (block.type === 'paragraph') {
    if (!block.content || block.content.length === 0) {
      // Use span for empty paragraphs when in restrictive tags
      const tag = useSpanForParagraphs ? 'span' : 'p';
      const attrs = useSpanForParagraphs ? { key, className: 'block' } : { key };
      return React.createElement(tag, attrs, React.createElement('br'));
    }
    // Use span with block class when inside restrictive tags
    if (useSpanForParagraphs) {
      return React.createElement('span', { key, className: 'block' }, ...renderInlineContent(block.content, collectionItemData, pageCollectionItemData, textStyles, isEditMode, linkContext, timezone));
    }
    return React.createElement('p', { key }, ...renderInlineContent(block.content, collectionItemData, pageCollectionItemData, textStyles, isEditMode, linkContext, timezone));
  }

  if (block.type === 'bulletList') {
    const ulProps: Record<string, any> = {
      key,
      className: textStyles?.bulletList?.classes ?? DEFAULT_TEXT_STYLES.bulletList?.classes,
    };
    if (isEditMode) {
      ulProps['data-style'] = 'bulletList';
    }
    return React.createElement(
      'ul',
      ulProps,
      block.content?.map((item: any, itemIdx: number) =>
        renderListItem(item, `${key}-${itemIdx}`, collectionItemData, pageCollectionItemData, textStyles, isEditMode, linkContext, timezone)
      )
    );
  }

  if (block.type === 'orderedList') {
    const olProps: Record<string, any> = {
      key,
      className: textStyles?.orderedList?.classes ?? DEFAULT_TEXT_STYLES.orderedList?.classes,
    };
    if (isEditMode) {
      olProps['data-style'] = 'orderedList';
    }
    return React.createElement(
      'ol',
      olProps,
      block.content?.map((item: any, itemIdx: number) =>
        renderListItem(item, `${key}-${itemIdx}`, collectionItemData, pageCollectionItemData, textStyles, isEditMode, linkContext, timezone)
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
  pageCollectionItemData?: Record<string, string>,
  textStyles?: Record<string, TextStyle>,
  isEditMode = false,
  linkContext?: RichTextLinkContext,
  timezone: string = 'UTC'
): React.ReactNode {
  if (item.type !== 'listItem') return null;

  const children = item.content?.flatMap((block: any, idx: number) => {
    if (block.type === 'paragraph') {
      // For list items, render paragraph content without <p> wrapper
      return renderInlineContent(block.content || [], collectionItemData, pageCollectionItemData, textStyles, isEditMode, linkContext, timezone);
    }
    return renderBlock(block, idx, collectionItemData, pageCollectionItemData, textStyles, false, isEditMode, linkContext, timezone);
  });

  const liProps: Record<string, any> = {
    key,
    className: textStyles?.listItem?.classes ?? DEFAULT_TEXT_STYLES.listItem?.classes,
  };
  if (isEditMode) {
    liProps['data-style'] = 'listItem';
  }
  return React.createElement('li', liProps, children);
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
 * @param collectionItemData - Data from collection layer items
 * @param pageCollectionItemData - Data from page collection (dynamic pages)
 * @param useSpanForParagraphs - If true, renders paragraphs as <span class="block"> instead of <p>
 * @param isEditMode - If true, adds data-style attributes for style selection on canvas
 * @param linkContext - Context for resolving page/asset/field links
 * @param timezone - Timezone for formatting date values
 */
export function renderRichText(
  variable: DynamicRichTextVariable,
  collectionItemData?: Record<string, string>,
  pageCollectionItemData?: Record<string, string>,
  textStyles?: Record<string, TextStyle>,
  useSpanForParagraphs = false,
  isEditMode = false,
  linkContext?: RichTextLinkContext,
  timezone: string = 'UTC'
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
    return renderInlineContent(paragraph.content, collectionItemData, pageCollectionItemData, textStyles, isEditMode, linkContext, timezone);
  }

  return doc.content.map((block: any, idx: number) =>
    renderBlock(block, idx, collectionItemData, pageCollectionItemData, textStyles, useSpanForParagraphs, isEditMode, linkContext, timezone)
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
 * Used for RichTextEditor component
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
