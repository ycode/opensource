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
    } else if (node.type === 'paragraph' && node.content) {
      // Flatten paragraph content, preserving marks
      result.push(...extractInlineNodesFromRichText(node.content, parentMarks));
      // Add space between paragraphs when flattening
      result.push({ type: 'text', text: ' ' });
    } else if (node.type === 'dynamicVariable') {
      // Preserve dynamic variables with combined marks
      result.push({
        ...node,
        marks: [...parentMarks, ...(node.marks || [])],
      });
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
