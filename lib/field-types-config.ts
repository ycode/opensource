/**
 * Field Types Configuration
 *
 * Centralized configuration for collection field types.
 * Used across CMS components for consistent field type handling.
 */

export const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'rich_text', label: 'Rich Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'reference', label: 'Reference' },
  { value: 'multi_reference', label: 'Multi-Reference' },
  { value: 'image', label: 'Image' },
] as const;

export type FieldType = typeof FIELD_TYPES[number]['value'];
