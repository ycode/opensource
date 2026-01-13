/**
 * Tiptap Utilities
 *
 * Helper functions for working with Tiptap JSON content in the YCode editor.
 * Supports rendering Tiptap JSON to HTML and converting between formats.
 */

import type { TiptapContent, TiptapNode, TiptapMark } from '@/lib/iframe-bridge';
import type { TextStyle } from '@/types';
import { DEFAULT_TEXT_STYLES } from '@/lib/text-styles';

// Re-export for backward compatibility
export { DEFAULT_TEXT_STYLES };

/**
 * Check if content is Tiptap JSON format
 */
export function isTiptapContent(content: unknown): content is TiptapContent {
  return (
    typeof content === 'object' &&
    content !== null &&
    'type' in content &&
    (content as TiptapContent).type === 'doc'
  );
}

/**
 * Render Tiptap JSON content to HTML string
 * Resolves inline variables if collectionItemData is provided
 * Uses textStyles for formatting if provided, falls back to DEFAULT_TEXT_STYLES
 */
export function renderTiptapToHtml(
  content: TiptapContent,
  collectionItemData?: Record<string, string> | null,
  textStyles?: Record<string, TextStyle>
): string {
  if (!content.content) return '';

  // Merge DEFAULT_TEXT_STYLES with provided textStyles (provided styles override defaults)
  const mergedTextStyles: Record<string, TextStyle> = {
    ...DEFAULT_TEXT_STYLES,
    ...textStyles,
  };

  // Render all blocks directly - paragraphs are now wrapped in <span class="block"> tags
  // Lists are block elements with their own margins, so no need for separators
  const blocks: string[] = [];
  content.content.forEach(node => {
    if (node.type === 'paragraph') {
      // Paragraphs are now wrapped in <span class="block"> tags by renderNode
      blocks.push(renderNode(node, collectionItemData, mergedTextStyles));
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      // Lists are block elements - render them directly
      blocks.push(renderNode(node, collectionItemData, mergedTextStyles));
    } else {
      // Handle other block types
      blocks.push(renderNode(node, collectionItemData, mergedTextStyles));
    }
  });

  // Join blocks directly - <span class="block"> tags and lists are block elements with their own spacing
  return blocks.join('');
}

/**
 * Render a single Tiptap node to HTML
 */
function renderNode(
  node: TiptapNode,
  collectionItemData?: Record<string, string> | null,
  textStyles?: Record<string, TextStyle>
): string {
  switch (node.type) {
    case 'doc':
      return node.content?.map(n => renderNode(n, collectionItemData, textStyles)).join('') || '';

    case 'paragraph':
      const pContent = node.content?.map(n => renderNode(n, collectionItemData, textStyles)).join('') || '';
      // Use <span class="block"> instead of <p> so it works in inline contexts (like headings)
      // Empty paragraphs get a <br> to preserve the line break
      return `<span class="block">${pContent || '<br>'}</span>`;

    case 'bulletList': {
      const ulContent = node.content?.map(n => renderNode(n, collectionItemData, textStyles)).join('') || '';
      const listStyle = textStyles?.['bulletList'];
      const classes = listStyle?.classes ? ` class="${escapeHtml(listStyle.classes)}"` : '';
      return `<ul${classes}>${ulContent}</ul>`;
    }

    case 'orderedList': {
      const olContent = node.content?.map(n => renderNode(n, collectionItemData, textStyles)).join('') || '';
      const listStyle = textStyles?.['orderedList'];
      const classes = listStyle?.classes ? ` class="${escapeHtml(listStyle.classes)}"` : '';
      return `<ol${classes}>${olContent}</ol>`;
    }

    case 'listItem': {
      const liContent = node.content?.map(n => renderNode(n, collectionItemData, textStyles)).join('') || '';
      const listStyle = textStyles?.['listItem'];
      const classes = listStyle?.classes ? ` class="${escapeHtml(listStyle.classes)}"` : '';
      return `<li${classes}>${liContent}</li>`;
    }

    case 'text':
      let text = escapeHtml(node.text || '');
      // Apply marks (bold, italic, underline, etc.) using textStyles if available
      if (node.marks) {
        text = applyMarks(text, node.marks, textStyles);
      }
      return text;

    case 'dynamicVariable':
      // Resolve variable from collection data
      const variable = node.attrs?.variable as { type: string; data: { field_id?: string } } | undefined;
      if (variable?.type === 'field' && variable.data?.field_id && collectionItemData) {
        const value = collectionItemData[variable.data.field_id];
        return escapeHtml(value || '');
      }
      // Return placeholder if no data available
      const label = (node.attrs?.label as string) || 'variable';
      return `<span class="ycode-inline-var" data-variable='${JSON.stringify(variable)}'>${escapeHtml(label)}</span>`;

    case 'hardBreak':
      return '<br>';

    default:
      // For unknown nodes, try to render children
      return node.content?.map(n => renderNode(n, collectionItemData, textStyles)).join('') || '';
  }
}

/**
 * Apply Tiptap marks (formatting) to text
 * Uses textStyles classes if provided, falls back to DEFAULT_TEXT_STYLES, then HTML tags
 */
function applyMarks(text: string, marks: TiptapMark[], textStyles?: Record<string, TextStyle>): string {
  let result = text;

  // Merge DEFAULT_TEXT_STYLES with provided textStyles (provided styles override defaults)
  const mergedTextStyles: Record<string, TextStyle> = {
    ...DEFAULT_TEXT_STYLES,
    ...textStyles,
  };

  for (const mark of marks) {
    // Check if merged textStyles provides a class for this mark
    const styleConfig = mergedTextStyles[mark.type];

    if (styleConfig?.classes) {
      // Use span with classes from textStyles
      result = `<span class="${styleConfig.classes}">${result}</span>`;
    } else {
      // Fall back to standard HTML tags
      switch (mark.type) {
        case 'bold':
          result = `<strong>${result}</strong>`;
          break;
        case 'italic':
          result = `<em>${result}</em>`;
          break;
        case 'underline':
          result = `<u>${result}</u>`;
          break;
        case 'strike':
          result = `<s>${result}</s>`;
          break;
        case 'code':
          result = `<code>${result}</code>`;
          break;
        case 'textStyle':
          // Handle text color
          const color = mark.attrs?.color as string | undefined;
          if (color) {
            result = `<span style="color: ${color}">${result}</span>`;
          }
          break;
        case 'link':
          const href = mark.attrs?.href as string | undefined;
          const target = mark.attrs?.target as string | undefined;
          if (href) {
            result = `<a href="${escapeHtml(href)}"${target ? ` target="${target}"` : ''}>${result}</a>`;
          }
          break;
      }
    }
  }

  return result;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = typeof document !== 'undefined'
    ? document.createElement('div')
    : null;

  if (div) {
    div.textContent = text;
    return div.innerHTML;
  }

  // Server-side fallback
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Convert Tiptap JSON to plain text (strips formatting, keeps variable tags)
 */
export function tiptapToPlainText(content: TiptapContent): string {
  if (!content.content) return '';

  let result = '';

  function processNode(node: TiptapNode) {
    if (node.type === 'text') {
      result += node.text || '';
    } else if (node.type === 'dynamicVariable') {
      const variable = node.attrs?.variable;
      if (variable) {
        result += `<ycode-inline-variable>${JSON.stringify(variable)}</ycode-inline-variable>`;
      }
    } else if (node.type === 'hardBreak') {
      result += '\n';
    } else if (node.content) {
      node.content.forEach(processNode);
    }
  }

  content.content.forEach(processNode);
  return result;
}

/**
 * Parse plain text with ycode-inline-variable tags to Tiptap JSON
 */
export function parseToTiptapContent(text: string): TiptapContent {
  if (!text) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const content: TiptapNode[] = [];
  const regex = /<ycode-inline-variable(?:\s+id="([^"]+)")?>([\s\S]*?)<\/ycode-inline-variable>/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index);
      if (textBefore) {
        content.push({ type: 'text', text: textBefore });
      }
    }

    // Parse variable
    const variableContent = match[2].trim();
    try {
      const variable = JSON.parse(variableContent);
      content.push({
        type: 'dynamicVariable',
        attrs: { variable, label: variable.data?.field_id?.slice(0, 8) || 'variable' }
      });
    } catch {
      // Invalid JSON, keep as text
      content.push({ type: 'text', text: match[0] });
    }

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    content.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: content.length > 0 ? content : undefined
    }]
  };
}

/**
 * Check if Tiptap content has any inline variables
 */
export function hasInlineVariables(content: TiptapContent): boolean {
  function checkNode(node: TiptapNode): boolean {
    if (node.type === 'dynamicVariable') return true;
    if (node.content) {
      return node.content.some(checkNode);
    }
    return false;
  }

  return content.content?.some(checkNode) || false;
}

/**
 * Get plain text preview (no variables, no formatting)
 */
export function getPlainTextPreview(content: TiptapContent, maxLength = 50): string {
  let result = '';

  function processNode(node: TiptapNode) {
    if (node.type === 'text') {
      result += node.text || '';
    } else if (node.type === 'dynamicVariable') {
      result += '[...]';
    } else if (node.content) {
      node.content.forEach(processNode);
    }
  }

  content.content?.forEach(processNode);

  if (result.length > maxLength) {
    return result.slice(0, maxLength) + '...';
  }
  return result;
}
