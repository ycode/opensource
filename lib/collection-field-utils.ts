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
  { value: 'email', label: 'Email', icon: 'email' },
  { value: 'phone', label: 'Phone', icon: 'phone' },
  { value: 'image', label: 'Image', icon: 'image' },
  { value: 'audio', label: 'Audio', icon: 'audio' },
  { value: 'video', label: 'Video', icon: 'video' },
  { value: 'document', label: 'Document', icon: 'file-text' },
  { value: 'reference', label: 'Reference', icon: 'database' },
  { value: 'multi_reference', label: 'Multi-Reference', icon: 'database' },
] as const;

export type FieldType = (typeof FIELD_TYPES)[number]['value'];

/** Valid field type values for API validation */
export const VALID_FIELD_TYPES: readonly string[] = FIELD_TYPES.map((t) => t.value);

/** Field types that can be displayed in variable selectors (excludes multi_reference) */
export const DISPLAYABLE_FIELD_TYPES: CollectionFieldType[] = FIELD_TYPES
  .filter(t => t.value !== 'multi_reference')
  .map(t => t.value) as CollectionFieldType[];

/** Check if a string is a valid field type */
export function isValidFieldType(type: string): type is FieldType {
  return VALID_FIELD_TYPES.includes(type);
}

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
    case 'audio':
    case 'video':
    case 'document':
      return REFERENCE_OPERATORS;
    case 'multi_reference':
      return MULTI_REFERENCE_OPERATORS;
    case 'text':
    case 'rich_text':
    case 'email':
    case 'phone':
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

/** Validate field value. Returns null if valid, error message if invalid. Only email and phone have validation. */
export function validateFieldValue(
  fieldType: CollectionFieldType,
  value: string
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  switch (fieldType) {
    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(trimmed) ? null : 'Invalid email format';
    }
    case 'phone': {
      const phoneRegex = /^[\d\s\-\(\)\+\.]*$/;
      const digitCount = (trimmed.match(/\d/g) || []).length;
      if (!phoneRegex.test(trimmed) || digitCount < 7) {
        return 'Phone must contain at least 7 digits';
      }
      return null;
    }
    default:
      return null;
  }
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

  const textField = fields.find(
    (f) => (f.type === 'text' || f.type === 'email' || f.type === 'phone') && f.fillable
  );
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

// =============================================================================
// Field Groups Utilities
// =============================================================================

/** Source of field data: 'page' for dynamic page data, 'collection' for collection layer data */
export type FieldSourceType = 'page' | 'collection';

/** A group of fields with a source and label */
export interface FieldGroup {
  fields: CollectionField[];
  label?: string;
  source?: FieldSourceType;
}

/** Configuration for building field groups */
export interface BuildFieldGroupsConfig {
  /** Parent collection layer (if editing inside a collection layer) */
  collectionLayer?: { collectionId?: string } | null;
  /** Current page (for dynamic page collection) */
  page?: { is_dynamic?: boolean; settings?: { cms?: { collection_id?: string } } } | null;
  /** All collection fields keyed by collection ID */
  fieldsByCollectionId: Record<string, CollectionField[]>;
  /** All collections for looking up names */
  collections: { id: string; name: string }[];
}

/**
 * Build field groups for multi-source field selection.
 * Returns groups for collection layer fields and/or page collection fields.
 */
export function buildFieldGroups(config: BuildFieldGroupsConfig): FieldGroup[] | undefined {
  const { collectionLayer, page, fieldsByCollectionId, collections } = config;
  const groups: FieldGroup[] = [];

  // Add collection layer fields if inside a collection layer
  if (collectionLayer?.collectionId) {
    const collectionId = collectionLayer.collectionId;
    const collectionFields = fieldsByCollectionId[collectionId] || [];
    const collection = collections.find(c => c.id === collectionId);
    if (collectionFields.length > 0) {
      groups.push({
        fields: collectionFields,
        label: collection?.name || 'Collection',
        source: 'collection',
      });
    }
  }

  // Add page collection fields if on a dynamic page
  // Always add even if same collection as layer - page data differs from collection layer data
  if (page?.is_dynamic && page?.settings?.cms?.collection_id) {
    const pageCollectionId = page.settings.cms.collection_id;
    const pageCollectionFields = fieldsByCollectionId[pageCollectionId] || [];
    if (pageCollectionFields.length > 0) {
      groups.push({
        fields: pageCollectionFields,
        label: 'Page data',
        source: 'page',
      });
    }
  }

  return groups.length > 0 ? groups : undefined;
}

/** Field types that can be used as link targets */
export const LINK_FIELD_TYPES: CollectionFieldType[] = ['link', 'email', 'phone', 'image', 'audio', 'video', 'document'];

/** Field types that store media assets (image, audio, video) */
export const MEDIA_FIELD_TYPES: CollectionFieldType[] = ['image', 'audio', 'video'];

/** Field types that store asset IDs (media + documents) */
export const ASSET_FIELD_TYPES: CollectionFieldType[] = ['image', 'audio', 'video', 'document'];

/** Field types that can be bound to image layers (image fields) */
export const IMAGE_FIELD_TYPES: CollectionFieldType[] = ['image'];

/** Field types that can be bound to audio layers (audio fields) */
export const AUDIO_FIELD_TYPES: CollectionFieldType[] = ['audio'];

/** Field types that can be bound to video layers (video) */
export const VIDEO_FIELD_TYPES: CollectionFieldType[] = ['video'];

/** Field types that can be bound to link layers for downloads (document fields) */
export const DOCUMENT_FIELD_TYPES: CollectionFieldType[] = ['document'];

/** Check if a field type uses asset selector (image, audio, video, document) */
export function isAssetFieldType(fieldType: CollectionFieldType | undefined | null): boolean {
  return fieldType != null && ASSET_FIELD_TYPES.includes(fieldType);
}

/** Check if a field type is a media type (image, audio, video) */
export function isMediaFieldType(fieldType: CollectionFieldType | undefined | null): boolean {
  return fieldType != null && MEDIA_FIELD_TYPES.includes(fieldType);
}

/**
 * Filter field groups to only include fields of specified types.
 * Returns empty array if no matching fields exist.
 */
export function filterFieldGroupsByType(
  fieldGroups: FieldGroup[] | undefined,
  allowedTypes: CollectionFieldType[]
): FieldGroup[] {
  if (!fieldGroups || fieldGroups.length === 0) return [];

  return fieldGroups
    .map(group => ({
      ...group,
      fields: group.fields.filter(field => allowedTypes.includes(field.type)),
    }))
    .filter(group => group.fields.length > 0);
}

/**
 * Flatten field groups into a single array of fields.
 */
export function flattenFieldGroups(fieldGroups: FieldGroup[] | undefined): CollectionField[] {
  return fieldGroups?.flatMap(g => g.fields) || [];
}

/**
 * Check if any fields match a predicate across all groups.
 */
export function hasFieldsMatching(
  fieldGroups: FieldGroup[] | undefined,
  predicate: (field: CollectionField) => boolean
): boolean {
  return fieldGroups?.some(g => g.fields.some(predicate)) ?? false;
}
