/**
 * Field Types Configuration
 *
 * Centralized configuration for collection field types.
 * Used across CMS components for consistent field type handling.
 */

import type { CollectionField } from '@/types';
import type { IconProps } from '@/components/ui/icon';

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

/**
 * Get icon name for field type
 */
export function getFieldIcon(field: CollectionField): IconProps['name'] {
  switch (field.type) {
    case 'text':
    case 'rich_text':
      return 'text';
    case 'number':
      return 'hash';
    case 'boolean':
      return 'check';
    case 'date':
      return 'calendar';
    case 'image':
      return 'image';
    case 'reference':
      return 'database';
    default:
      return 'text';
  }
}
