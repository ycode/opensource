/**
 * Tiptap Utilities
 *
 * Shared utilities for working with Tiptap JSON content
 * Used by both client-side rendering (text-format-utils) and server-side (page-fetcher)
 */

/**
 * Extract inline nodes from nested Tiptap rich text content
 * Flattens paragraphs and preserves marks for inline rendering
 * @param content - Array of Tiptap nodes to extract from
 * @param parentMarks - Marks to inherit from parent nodes
 */
export function extractInlineNodesFromRichText(
  content: any[],
  parentMarks: any[] = []
): any[] {
  const result: any[] = [];

  for (const node of content) {
    if (node.type === 'text') {
      // Merge marks from parent with node marks
      const combinedMarks = [...parentMarks, ...(node.marks || [])];
      result.push({
        type: 'text',
        text: node.text,
        marks: combinedMarks.length > 0 ? combinedMarks : undefined,
      });
    } else if (node.type === 'paragraph') {
      // Preserve paragraph styling by adding a dynamicStyle mark
      const paragraphMark = { type: 'dynamicStyle', attrs: { styleKeys: ['paragraph'] } };
      const marksWithParagraph = [...parentMarks, paragraphMark];
      if (node.content && node.content.length > 0) {
        result.push(...extractInlineNodesFromRichText(node.content, marksWithParagraph));
      } else {
        // Empty paragraphs use non-breaking space to preserve the empty line
        result.push({
          type: 'text',
          text: '\u00A0',
          marks: marksWithParagraph,
        });
      }
      // Add space between paragraphs when flattening
      result.push({ type: 'text', text: ' ' });
    } else if (node.type === 'heading') {
      // Preserve heading styling by adding a dynamicStyle mark with the heading level
      const level = node.attrs?.level || 1;
      const headingMark = { type: 'dynamicStyle', attrs: { styleKeys: [`h${level}`] } };
      const marksWithHeading = [...parentMarks, headingMark];
      if (node.content && node.content.length > 0) {
        result.push(...extractInlineNodesFromRichText(node.content, marksWithHeading));
      } else {
        // Empty headings use non-breaking space to preserve the empty line
        result.push({
          type: 'text',
          text: '\u00A0',
          marks: marksWithHeading,
        });
      }
      // Add space after heading when flattening
      result.push({ type: 'text', text: ' ' });
    } else if (node.type === 'dynamicVariable') {
      // Preserve dynamic variables with combined marks
      result.push({
        ...node,
        marks: [...parentMarks, ...(node.marks || [])],
      });
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      // Preserve list nodes as-is - they'll be rendered as block elements
      // Add the node directly so it can be handled by the renderer
      result.push({
        ...node,
        marks: parentMarks.length > 0 ? parentMarks : undefined,
      });
      // Add space after list when flattening
      result.push({ type: 'text', text: ' ' });
    } else if (node.type === 'listItem') {
      // List items should be handled by their parent list
      // But if we encounter one directly, extract its content
      if (node.content) {
        result.push(...extractInlineNodesFromRichText(node.content, parentMarks));
      }
    } else if (node.content) {
      // Recursively extract from other nodes with content
      result.push(...extractInlineNodesFromRichText(node.content, parentMarks));
    }
  }

  return result;
}

/**
 * Check if a value is a valid Tiptap doc structure
 */
export function isTiptapDoc(value: unknown): value is { type: 'doc'; content: any[] } {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as any).type === 'doc' &&
    Array.isArray((value as any).content)
  );
}

/**
 * Check if Tiptap JSON content contains block-level elements (lists)
 * These cannot be nested inside restrictive tags (p, h1-h6, span, a, button)
 */
export function contentHasBlockElements(content: any): boolean {
  if (!content || typeof content !== 'object') {
    return false;
  }

  // Handle Tiptap doc structure
  if (content.type === 'doc' && Array.isArray(content.content)) {
    return content.content.some((block: any) =>
      block.type === 'bulletList' || block.type === 'orderedList'
    );
  }

  return false;
}

/**
 * Value resolver function type for looking up field values
 */
export type FieldValueResolver = (fieldId: string, relationships?: string[], source?: string) => string | null | undefined;

/**
 * Check if rich text content contains block elements, including from inline variables
 * Uses a resolver function to look up field values, making it reusable for both
 * client-side (React) and server-side (HTML string) rendering
 *
 * @param content - Tiptap JSON content (doc structure)
 * @param resolveValue - Function to resolve field values by fieldId
 */
export function hasBlockElementsWithResolver(
  content: any,
  resolveValue: FieldValueResolver
): boolean {
  if (!content || typeof content !== 'object') {
    return false;
  }

  // Check direct content for lists
  if (contentHasBlockElements(content)) {
    return true;
  }

  if (content.type !== 'doc' || !Array.isArray(content.content)) {
    return false;
  }

  // Recursively check for dynamicVariable nodes that point to rich_text with lists
  const checkNode = (node: any): boolean => {
    if (node.type === 'dynamicVariable') {
      const variable = node.attrs?.variable;
      if (variable?.type === 'field' && variable.data?.field_type === 'rich_text') {
        const fieldId = variable.data.field_id;
        const relationships = variable.data.relationships;
        const source = variable.data.source;

        let value: any = resolveValue(fieldId, relationships, source);

        // Parse JSON string if needed
        if (typeof value === 'string') {
          try {
            value = JSON.parse(value);
          } catch {
            value = null;
          }
        }

        // Check if the resolved value contains block elements
        if (value && contentHasBlockElements(value)) {
          return true;
        }
      }
    }

    // Recursively check content arrays
    if (Array.isArray(node.content)) {
      return node.content.some(checkNode);
    }

    return false;
  };

  return content.content.some(checkNode);
}

/**
 * Extract plain text from Tiptap JSON content
 * Useful for previews, search indexing, or fallback display
 */
export function extractPlainTextFromTiptap(content: any): string {
  if (!content || typeof content !== 'object') return '';

  let result = '';

  const extractFromNode = (node: any): void => {
    if (node.type === 'text' && node.text) {
      result += node.text;
    } else if (node.type === 'dynamicVariable' && node.attrs?.label) {
      result += `[${node.attrs.label}]`;
    } else if (node.type === 'paragraph') {
      if (result.length > 0 && !result.endsWith(' ')) {
        result += ' ';
      }
      if (Array.isArray(node.content)) {
        node.content.forEach(extractFromNode);
      }
    } else if (Array.isArray(node.content)) {
      node.content.forEach(extractFromNode);
    }
  };

  if (content.type === 'doc' && Array.isArray(content.content)) {
    content.content.forEach(extractFromNode);
  } else if (Array.isArray(content)) {
    content.forEach(extractFromNode);
  } else {
    extractFromNode(content);
  }

  return result.trim();
}
