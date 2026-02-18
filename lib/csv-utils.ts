/**
 * CSV Utilities
 *
 * Parsing and validation utilities for CSV imports.
 */

import type { CollectionField, CollectionFieldType } from '@/types';

// ============================================================================
// Constants
// ============================================================================

/** Value used in column mapping to indicate a column should be skipped */
export const SKIP_COLUMN = '__skip__';

/** Auto-generated field keys that are set automatically during import */
export const AUTO_FIELD_KEYS = ['id', 'created_at', 'updated_at'] as const;

/** Field types that contain asset URLs and need to be downloaded */
export const ASSET_FIELD_TYPES: CollectionFieldType[] = ['image', 'video', 'audio', 'document'];

/**
 * Check if a field type is an asset type that needs URL downloading
 */
export function isAssetFieldType(type: CollectionFieldType): boolean {
  return ASSET_FIELD_TYPES.includes(type);
}

/**
 * Check if a value looks like a URL
 */
export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// ============================================================================
// Helper utilities
// ============================================================================

/** Truncate a value for display in error messages */
export function truncateValue(value: string, maxLength: number = 50): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

/** Extract error message from unknown error */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

// TipTap JSON types
interface TipTapMark {
  type: string;
  attrs?: Record<string, unknown>;
}

interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
  attrs?: Record<string, unknown>;
}

/**
 * Convert HTML string to TipTap JSON format
 * Handles common HTML tags: p, strong, b, em, i, u, s, strike, ol, ul, li, h1-h6, blockquote, br, a
 * Preserves the original order of elements
 */
function htmlToTipTapJSON(html: string): TipTapNode {
  // Check if the string looks like HTML
  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(html);

  if (!hasHtmlTags) {
    // Plain text - wrap in paragraph
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: html ? [{ type: 'text', text: html }] : [],
        },
      ],
    };
  }

  const content: TipTapNode[] = [];

  // Clean up the HTML
  const cleanHtml = html
    .replace(/\s+class="[^"]*"/gi, '') // Remove class attributes
    .replace(/<br\s*\/?>/gi, '\n'); // Normalize br tags

  // Regex to match block-level elements in order
  // Matches: <p>, <ol>, <ul>, <h1-6>, <blockquote>, <div>
  const blockRegex = /<(p|ol|ul|h[1-6]|blockquote|div)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi;

  let lastIndex = 0;
  let match;

  while ((match = blockRegex.exec(cleanHtml)) !== null) {
    const tagName = match[1].toLowerCase();
    const fullMatch = match[0];

    // Process any text between the last match and this one
    if (match.index > lastIndex) {
      const textBetween = cleanHtml.slice(lastIndex, match.index).trim();
      if (textBetween) {
        const plainText = decodeHtmlEntities(textBetween.replace(/<[^>]+>/g, '').trim());
        if (plainText) {
          content.push({
            type: 'paragraph',
            content: [{ type: 'text', text: plainText }],
          });
        }
      }
    }

    // Process the matched element
    if (tagName === 'p' || tagName === 'div') {
      // Paragraph
      const innerContent = fullMatch.replace(/<\/?(?:p|div)[^>]*>/gi, '').trim();
      const textContent = decodeHtmlEntities(innerContent.replace(/<[^>]+>/g, '').trim());
      if (textContent) {
        content.push({
          type: 'paragraph',
          content: [{ type: 'text', text: textContent }],
        });
      }
    } else if (tagName === 'ol' || tagName === 'ul') {
      // List
      const isOrdered = tagName === 'ol';
      const listItems: TipTapNode[] = [];

      // Extract list items
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liRegex.exec(fullMatch)) !== null) {
        let itemContent = liMatch[1].trim();
        // Remove nested <p> tags inside list items
        itemContent = itemContent.replace(/<\/?p[^>]*>/gi, '').trim();
        const itemText = decodeHtmlEntities(itemContent.replace(/<[^>]+>/g, '').trim());

        if (itemText) {
          listItems.push({
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: itemText }],
              },
            ],
          });
        }
      }

      if (listItems.length > 0) {
        content.push({
          type: isOrdered ? 'orderedList' : 'bulletList',
          content: listItems,
        });
      }
    } else if (tagName.match(/^h[1-6]$/)) {
      // Heading
      const level = parseInt(tagName[1], 10);
      const innerContent = fullMatch.replace(/<\/?h[1-6][^>]*>/gi, '').trim();
      const textContent = decodeHtmlEntities(innerContent.replace(/<[^>]+>/g, '').trim());
      if (textContent) {
        content.push({
          type: 'heading',
          attrs: { level },
          content: [{ type: 'text', text: textContent }],
        });
      }
    } else if (tagName === 'blockquote') {
      // Blockquote
      const innerContent = fullMatch.replace(/<\/?blockquote[^>]*>/gi, '').trim();
      const textContent = decodeHtmlEntities(innerContent.replace(/<[^>]+>/g, '').trim());
      if (textContent) {
        content.push({
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: textContent }],
            },
          ],
        });
      }
    }

    lastIndex = match.index + fullMatch.length;
  }

  // Process any remaining text after the last match
  if (lastIndex < cleanHtml.length) {
    const remaining = cleanHtml.slice(lastIndex).trim();
    if (remaining) {
      const plainText = decodeHtmlEntities(remaining.replace(/<[^>]+>/g, '').trim());
      if (plainText) {
        content.push({
          type: 'paragraph',
          content: [{ type: 'text', text: plainText }],
        });
      }
    }
  }

  // Ensure we have at least one content node
  if (content.length === 0) {
    content.push({
      type: 'paragraph',
      content: [],
    });
  }

  return {
    type: 'doc',
    content,
  };
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export interface ParsedCSV {
  headers: string[];
  rows: Record<string, string>[];
}

/**
 * Parse CSV text into headers and rows
 * Handles quoted fields and escaped quotes
 */
export function parseCSVText(csvText: string): ParsedCSV {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse a single line handling quoted fields
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Parse CSV file and return headers and rows
 */
export async function parseCSVFile(file: File): Promise<ParsedCSV> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = parseCSVText(text);
        resolve(result);
      } catch (error) {
        reject(new Error('Failed to parse CSV file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read CSV file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Convert CSV value to appropriate type based on field type
 */
export function convertValueForFieldType(
  value: string,
  fieldType: CollectionFieldType
): string | null {
  if (!value || value.trim() === '') {
    return null;
  }

  const trimmedValue = value.trim();

  switch (fieldType) {
    case 'text':
    case 'email':
    case 'phone':
    case 'link':
      return trimmedValue;

    case 'number': {
      const num = parseFloat(trimmedValue);
      if (isNaN(num)) {
        return null;
      }
      return String(num);
    }

    case 'boolean': {
      const lower = trimmedValue.toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(lower)) {
        return 'true';
      }
      if (['false', '0', 'no', 'n'].includes(lower)) {
        return 'false';
      }
      return null;
    }

    case 'date': {
      // Try to parse as date
      const date = new Date(trimmedValue);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date.toISOString();
    }

    case 'rich_text':
      // Convert HTML to TipTap JSON format
      return JSON.stringify(htmlToTipTapJSON(trimmedValue));

    case 'image':
    case 'video':
    case 'audio':
    case 'document':
      // Assume URL is provided
      return trimmedValue;

    case 'reference':
    case 'multi_reference':
      // Reference IDs should be provided as-is or comma-separated
      return trimmedValue;

    default:
      return trimmedValue;
  }
}

/**
 * Validate CSV data against collection fields
 * Returns array of validation errors
 */
export function validateCSVMapping(
  columnMapping: Record<string, string>,
  fields: CollectionField[]
): string[] {
  const errors: string[] = [];
  const fieldMap = new Map(fields.map(f => [f.id, f]));
  const mappedFieldIds = new Set<string>();

  // Check for duplicate field mappings
  Object.entries(columnMapping).forEach(([, fieldId]) => {
    // Skip empty or skipped values
    if (!fieldId || fieldId === SKIP_COLUMN) return;

    if (mappedFieldIds.has(fieldId)) {
      const field = fieldMap.get(fieldId);
      errors.push(`Field "${field?.name || fieldId}" is mapped to multiple columns`);
    }
    mappedFieldIds.add(fieldId);
  });

  return errors;
}

/**
 * Get suggested field mapping based on CSV header names
 * Matches by name (case-insensitive) or key
 */
export function suggestColumnMapping(
  headers: string[],
  fields: CollectionField[]
): Record<string, string> {
  const mapping: Record<string, string> = {};

  headers.forEach(header => {
    const normalizedHeader = header.toLowerCase().trim();

    // Try to match by field name or key
    const matchedField = fields.find(field => {
      const fieldName = field.name.toLowerCase().trim();
      const fieldKey = field.key?.toLowerCase().trim();
      return fieldName === normalizedHeader || fieldKey === normalizedHeader;
    });

    if (matchedField) {
      mapping[header] = matchedField.id;
    } else {
      mapping[header] = SKIP_COLUMN; // No match, skip this column
    }
  });

  return mapping;
}

/**
 * Get field type label for display
 */
export function getFieldTypeLabel(type: CollectionFieldType): string {
  const labels: Record<CollectionFieldType, string> = {
    text: 'Text',
    number: 'Number',
    boolean: 'Boolean',
    date: 'Date',
    color: 'Color',
    reference: 'Reference',
    multi_reference: 'Multi Reference',
    rich_text: 'Rich Text',
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    document: 'Document',
    link: 'Link',
    email: 'Email',
    phone: 'Phone',
  };
  return labels[type] || type;
}
