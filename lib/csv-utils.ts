/**
 * CSV Utilities
 *
 * Parsing and validation utilities for CSV imports.
 */

import type { CollectionField, CollectionFieldType } from '@/types';

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
      // Wrap in TipTap JSON format
      return JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: trimmedValue,
              },
            ],
          },
        ],
      });

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
    // Skip empty or __skip__ values
    if (!fieldId || fieldId === '__skip__') return;

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
      mapping[header] = '__skip__'; // No match, skip this column
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
