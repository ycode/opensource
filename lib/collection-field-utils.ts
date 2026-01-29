/**
 * Collection Field Utils
 *
 * Centralized utilities for collection field types and operators.
 * Used across CMS components for consistent field type handling.
 */

import type { IconProps } from '@/components/ui/icon';
import type {
  CollectionField,
  CollectionFieldType,
  CollectionItemWithValues,
  VisibilityOperator,
} from '@/types';

// =============================================================================
// Field Types Configuration
// =============================================================================

export const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: 'text' },
  { value: 'rich_text', label: 'Rich Text', icon: 'rich-text' },
  { value: 'number', label: 'Number', icon: 'hash' },
  { value: 'boolean', label: 'Boolean', icon: 'check' },
  { value: 'date', label: 'Date', icon: 'calendar' },
  { value: 'link', label: 'Link', icon: 'link' },
  { value: 'reference', label: 'Reference', icon: 'database' },
  { value: 'multi_reference', label: 'Multi-Reference', icon: 'database' },
  { value: 'image', label: 'Image', icon: 'image' },
] as const;

export type FieldType = (typeof FIELD_TYPES)[number]['value'];

const FIELD_TYPES_BY_VALUE: Record<FieldType, (typeof FIELD_TYPES)[number]> =
  Object.fromEntries(FIELD_TYPES.map((t) => [t.value, t])) as Record<
    FieldType,
    (typeof FIELD_TYPES)[number]
  >;

/** Get icon name for field type. Returns `defaultIcon` for invalid field types. */
export function getFieldIcon(
  fieldType: FieldType | undefined,
  defaultIcon: IconProps['name'] = 'text'
): IconProps['name'] {
  if (!fieldType) return defaultIcon;
  return FIELD_TYPES_BY_VALUE[fieldType]?.icon ?? defaultIcon;
}

// =============================================================================
// Field Operators Configuration
// =============================================================================

export interface OperatorOption {
  value: VisibilityOperator;
  label: string;
}

export const TEXT_OPERATORS: OperatorOption[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'does_not_contain', label: 'does not contain' },
  { value: 'is_present', label: 'is present' },
  { value: 'is_empty', label: 'is empty' },
];

export const NUMBER_OPERATORS: OperatorOption[] = [
  { value: 'is', label: 'is' },
  { value: 'is_not', label: 'is not' },
  { value: 'lt', label: 'is less than' },
  { value: 'lte', label: 'is less than or equal to' },
  { value: 'gt', label: 'is more than' },
  { value: 'gte', label: 'is more than or equal to' },
];

export const DATE_OPERATORS: OperatorOption[] = [
  { value: 'is', label: 'is' },
  { value: 'is_before', label: 'is before' },
  { value: 'is_after', label: 'is after' },
  { value: 'is_between', label: 'is between' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

export const BOOLEAN_OPERATORS: OperatorOption[] = [{ value: 'is', label: 'is' }];

export const REFERENCE_OPERATORS: OperatorOption[] = [
  { value: 'is_one_of', label: 'is one of' },
  { value: 'is_not_one_of', label: 'is not one of' },
  { value: 'exists', label: 'exists' },
  { value: 'does_not_exist', label: 'does not exist' },
];

export const MULTI_REFERENCE_OPERATORS: OperatorOption[] = [
  { value: 'is_one_of', label: 'is one of' },
  { value: 'is_not_one_of', label: 'is not one of' },
  { value: 'contains_all_of', label: 'contains all of' },
  { value: 'contains_exactly', label: 'contains exactly' },
  { value: 'item_count', label: 'item count' },
  { value: 'has_items', label: 'has items' },
  { value: 'has_no_items', label: 'has no items' },
];

export const PAGE_COLLECTION_OPERATORS: OperatorOption[] = [
  { value: 'item_count', label: 'item count' },
  { value: 'has_items', label: 'has items' },
  { value: 'has_no_items', label: 'has no items' },
];

export const COMPARE_OPERATORS: { value: string; label: string }[] = [
  { value: 'eq', label: 'equals' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less than or equal' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater than or equal' },
];

/** Get operators available for a given field type */
export function getOperatorsForFieldType(
  fieldType: CollectionFieldType | undefined
): OperatorOption[] {
  switch (fieldType) {
    case 'number':
      return NUMBER_OPERATORS;
    case 'date':
      return DATE_OPERATORS;
    case 'boolean':
      return BOOLEAN_OPERATORS;
    case 'reference':
    case 'image':
      return REFERENCE_OPERATORS;
    case 'multi_reference':
      return MULTI_REFERENCE_OPERATORS;
    case 'text':
    case 'rich_text':
    default:
      return TEXT_OPERATORS;
  }
}

/** Check if operator requires a value input */
export function operatorRequiresValue(operator: VisibilityOperator): boolean {
  return ![
    'is_present',
    'is_empty',
    'is_not_empty',
    'has_items',
    'has_no_items',
    'exists',
    'does_not_exist',
  ].includes(operator);
}

/** Check if operator requires collection item selection */
export function operatorRequiresItemSelection(operator: VisibilityOperator): boolean {
  return ['is_one_of', 'is_not_one_of', 'contains_all_of', 'contains_exactly'].includes(
    operator
  );
}

/** Check if operator requires a second value (for date ranges) */
export function operatorRequiresSecondValue(operator: VisibilityOperator): boolean {
  return operator === 'is_between';
}

// =============================================================================
// Field Lookup Utilities
// =============================================================================

/** Find a field by ID from an array of fields */
export function findFieldById(
  fields: CollectionField[],
  fieldId: string
): CollectionField | undefined {
  return fields.find((f) => f.id === fieldId);
}

/** Get field name by ID. Returns 'Unknown field' if not found. */
export function getFieldName(fields: CollectionField[], fieldId: string): string {
  return findFieldById(fields, fieldId)?.name ?? 'Unknown field';
}

/** Get field type by ID. Returns undefined if not found. */
export function getFieldType(
  fields: CollectionField[],
  fieldId: string
): CollectionFieldType | undefined {
  return findFieldById(fields, fieldId)?.type;
}

/** Check if field type is a reference type */
export function isReferenceType(fieldType: CollectionFieldType | undefined): boolean {
  return fieldType === 'reference' || fieldType === 'multi_reference';
}

// =============================================================================
// Display Field Utilities
// =============================================================================

/**
 * Find the best display field for a collection.
 * Priority: 'title' key → 'name' key → first fillable text field → first field
 */
export function findDisplayField(
  fields: CollectionField[]
): CollectionField | null {
  const titleField = fields.find((f) => f.key === 'title');
  if (titleField) return titleField;

  const nameField = fields.find((f) => f.key === 'name');
  if (nameField) return nameField;

  const textField = fields.find((f) => f.type === 'text' && f.fillable);
  if (textField) return textField;

  return fields[0] ?? null;
}

/** Get display name for a collection item using the display field */
export function getItemDisplayName(
  item: CollectionItemWithValues,
  displayField: CollectionField | null
): string {
  if (!displayField) return 'Untitled';
  return item.values[displayField.id] || 'Untitled';
}
