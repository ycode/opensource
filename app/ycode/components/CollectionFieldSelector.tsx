'use client';

/**
 * Collection Field Selector
 *
 * Recursive component for selecting fields from a collection with nested reference support.
 * Reference fields appear as collapsible group headers, and their linked collection's fields
 * appear nested underneath. Multi-reference fields are excluded.
 */

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import Icon from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { selectVariants } from '@/components/ui/select';
import type { CollectionField, Collection } from '@/types';
import { getFieldIcon, filterFieldGroupsByType, flattenFieldGroups, DISPLAYABLE_FIELD_TYPES } from '@/lib/collection-field-utils';

// Import and re-export from centralized location for backwards compatibility
import type { FieldSourceType, FieldGroup } from '@/lib/collection-field-utils';
export type { FieldSourceType, FieldGroup } from '@/lib/collection-field-utils';

interface CollectionFieldListProps {
  /** Fields to display at the current level */
  fields: CollectionField[];
  /** All fields keyed by collection ID for resolving nested references */
  allFields: Record<string, CollectionField[]>;
  /** All collections for looking up collection names */
  collections: Collection[];
  /** Callback when a field is selected */
  onSelect: (fieldId: string, relationshipPath: string[], source?: FieldSourceType, layerId?: string) => void;
  /** Current relationship path (used internally for recursion) */
  relationshipPath?: string[];
  /** Label for the current collection group */
  collectionLabel?: string;
  /** Source type for these fields (used internally for recursion) */
  source?: FieldSourceType;
  /** ID of the collection layer these fields belong to */
  layerId?: string;
  /** Depth level for indentation (used internally) */
  depth?: number;
}

/**
 * Single field item (selectable)
 */
function FieldItem({
  field,
  onSelect,
  depth = 0,
}: {
  field: CollectionField;
  onSelect: () => void;
  depth?: number;
}) {
  const iconName = getFieldIcon(field.type);

  return (
    <DropdownMenuItem
      onClick={onSelect}
      className="gap-2"
      style={{ paddingLeft: `${8 + depth * 16}px` }}
    >
      <Icon name={iconName} className="size-3 text-muted-foreground shrink-0" />
      <span className="truncate">{field.name}</span>
    </DropdownMenuItem>
  );
}

/**
 * Reference field group (submenu)
 */
function ReferenceFieldGroup({
  field,
  allFields,
  collections,
  onSelect,
  relationshipPath,
  source,
  layerId,
  depth = 0,
}: {
  field: CollectionField;
  allFields: Record<string, CollectionField[]>;
  collections: Collection[];
  onSelect: (fieldId: string, relationshipPath: string[], source?: FieldSourceType, layerId?: string) => void;
  relationshipPath: string[];
  source?: FieldSourceType;
  layerId?: string;
  depth?: number;
}) {
  const referencedCollectionId = field.reference_collection_id;
  const referencedFields = referencedCollectionId ? allFields[referencedCollectionId] || [] : [];
  const referencedCollection = collections.find((c) => c.id === referencedCollectionId);

  // Filter out multi-reference fields from nested display
  const displayableFields = referencedFields.filter((f) => f.type !== 'multi_reference');
  const hasNestedFields = displayableFields.length > 0;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        className="gap-2"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        disabled={!hasNestedFields}
      >
        <Icon name="database" className="size-3 text-muted-foreground shrink-0" />
        <span className="truncate">{field.name}</span>
      </DropdownMenuSubTrigger>

      {hasNestedFields && (
        <DropdownMenuSubContent className="min-w-45">
          {referencedCollection && (
            <DropdownMenuLabel className="text-xs text-foreground/80 flex items-center justify-between gap-2">
              <span>{referencedCollection.name}</span>
              <DropdownMenuShortcut className="tracking-normal">Ref. field</DropdownMenuShortcut>
            </DropdownMenuLabel>
          )}
          <CollectionFieldSelectorInner
            fields={displayableFields}
            allFields={allFields}
            collections={collections}
            onSelect={onSelect}
            relationshipPath={[...relationshipPath, field.id]}
            source={source}
            layerId={layerId}
            depth={0}
          />
        </DropdownMenuSubContent>
      )}
    </DropdownMenuSub>
  );
}

/**
 * Inner recursive component
 */
function CollectionFieldSelectorInner({
  fields,
  allFields,
  collections,
  onSelect,
  relationshipPath = [],
  source,
  layerId,
  depth = 0,
}: CollectionFieldListProps) {
  // Filter out multi-reference fields
  const displayableFields = fields.filter((f) => f.type !== 'multi_reference');

  return (
    <div className="flex flex-col">
      {displayableFields.map((field) => {
        // Reference fields become collapsible groups
        if (field.type === 'reference' && field.reference_collection_id) {
          return (
            <ReferenceFieldGroup
              key={field.id}
              field={field}
              allFields={allFields}
              collections={collections}
              onSelect={onSelect}
              relationshipPath={relationshipPath}
              source={source}
              layerId={layerId}
              depth={depth}
            />
          );
        }

        // Regular fields are selectable
        return (
          <FieldItem
            key={field.id}
            field={field}
            depth={depth}
            onSelect={() => {
              if (relationshipPath.length > 0) {
                // Nested field: include relationship path
                onSelect(relationshipPath[0], [...relationshipPath.slice(1), field.id], source, layerId);
              } else {
                // Root field: no relationship path
                onSelect(field.id, [], source, layerId);
              }
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Collection Field List - Renders a single group's fields with reference submenus.
 * Used internally by CollectionFieldSelector.
 */
function CollectionFieldList({
  fields,
  allFields,
  collections,
  onSelect,
  collectionLabel,
  source,
  layerId,
  relationshipPath = [],
  depth = 0,
}: CollectionFieldListProps) {
  // Filter out multi-reference fields at root level
  const displayableFields = fields.filter((f) => f.type !== 'multi_reference');

  if (displayableFields.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-zinc-500">
        No fields available
      </div>
    );
  }

  return (
    <div>
      {collectionLabel && (
        <DropdownMenuLabel>{collectionLabel}</DropdownMenuLabel>
      )}
      <CollectionFieldSelectorInner
        fields={displayableFields}
        allFields={allFields}
        collections={collections}
        onSelect={onSelect}
        relationshipPath={relationshipPath}
        source={source}
        layerId={layerId}
        depth={depth}
      />
    </div>
  );
}

interface CollectionFieldSelectorProps {
  /** Field groups to display, each with their own source and label */
  fieldGroups: FieldGroup[];
  /** All fields keyed by collection ID for resolving nested references */
  allFields: Record<string, CollectionField[]>;
  /** All collections for looking up collection names */
  collections: Collection[];
  /** Callback when a field is selected */
  onSelect: (fieldId: string, relationshipPath: string[], source?: FieldSourceType, layerId?: string) => void;
}

/**
 * Collection Field Selector
 *
 * Renders multiple field groups (e.g. collection layer + page collection) with labels.
 * Reference fields use submenus for their nested fields.
 */
export function CollectionFieldSelector({
  fieldGroups,
  allFields,
  collections,
  onSelect,
}: CollectionFieldSelectorProps) {
  // Filter to groups with displayable fields (excludes multi_reference)
  const nonEmptyGroups = filterFieldGroupsByType(fieldGroups, DISPLAYABLE_FIELD_TYPES);

  if (nonEmptyGroups.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-zinc-500">
        No fields available
      </div>
    );
  }

  return (
    <div>
      {nonEmptyGroups.map((group, index) => {
        const displayableFields = group.fields.filter((f) => f.type !== 'multi_reference');
        if (displayableFields.length === 0) return null;

        return (
          <div key={group.label || index}>
            {/* Add separator between groups (not before first) */}
            {index > 0 && <DropdownMenuSeparator />}
            {(group.label || group.detail) && (
              <DropdownMenuLabel className="text-xs text-foreground/80 flex items-center justify-between gap-2">
                <span>{group.label}</span>
                {group.detail && (
                  <DropdownMenuShortcut className="tracking-normal">
                    {group.detail}
                  </DropdownMenuShortcut>
                )}
              </DropdownMenuLabel>
            )}
            <CollectionFieldSelectorInner
              fields={displayableFields}
              allFields={allFields}
              collections={collections}
              onSelect={onSelect}
              relationshipPath={[]}
              source={group.source}
              layerId={group.layerId}
              depth={0}
            />
          </div>
        );
      })}
    </div>
  );
}

export default CollectionFieldSelector;

interface FieldSelectDropdownProps {
  /** Field groups with labels and sources */
  fieldGroups: FieldGroup[];
  /** All fields keyed by collection ID for resolving nested references */
  allFields: Record<string, CollectionField[]>;
  /** All collections for looking up collection names */
  collections: Collection[];
  /** Currently selected field ID */
  value?: string | null;
  /** Callback when a field is selected - receives encoded value with source/layerId */
  onSelect: (fieldId: string, relationshipPath: string[], source?: FieldSourceType, layerId?: string) => void;
  /** Placeholder text when no field is selected */
  placeholder?: string;
  /** Whether the dropdown is disabled */
  disabled?: boolean;
  /** Additional class names for the trigger button */
  className?: string;
  /** Field types to filter to (defaults to all displayable types) */
  allowedFieldTypes?: string[];
}

/**
 * Field Select Dropdown
 *
 * A complete dropdown component for selecting CMS fields with submenu support.
 * Use this as a drop-in replacement for Select-based field selectors.
 */
export function FieldSelectDropdown({
  fieldGroups,
  allFields,
  collections,
  value,
  onSelect,
  placeholder = 'Select a field',
  disabled = false,
  className,
  allowedFieldTypes,
}: FieldSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Filter field groups by allowed types
  const filteredGroups = useMemo(() => {
    if (allowedFieldTypes && allowedFieldTypes.length > 0) {
      return filterFieldGroupsByType(fieldGroups, allowedFieldTypes as any);
    }
    return filterFieldGroupsByType(fieldGroups, DISPLAYABLE_FIELD_TYPES);
  }, [fieldGroups, allowedFieldTypes]);

  // Find the selected field for display
  const selectedField = useMemo(() => {
    if (!value) return null;
    const allFlatFields = flattenFieldGroups(filteredGroups);
    return allFlatFields.find(f => f.id === value) || null;
  }, [value, filteredGroups]);

  const handleSelect = (fieldId: string, relationshipPath: string[], source?: FieldSourceType, layerId?: string) => {
    onSelect(fieldId, relationshipPath, source, layerId);
    setIsOpen(false);
  };

  const hasFields = filteredGroups.length > 0;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            selectVariants({ variant: 'default', size: 'sm' }),
            'w-full cursor-pointer',
            className
          )}
          disabled={disabled || !hasFields}
        >
          <span className="flex items-center gap-2 truncate">
            {selectedField ? (
              <>
                <Icon name={getFieldIcon(selectedField.type)} className="size-3 text-muted-foreground shrink-0" />
                <span className="truncate">{selectedField.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{hasFields ? placeholder : 'No fields available'}</span>
            )}
          </span>
          <Icon name="chevronCombo" className="size-2.5 opacity-50 shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56 max-h-none!" align="end">
        <CollectionFieldSelector
          fieldGroups={filteredGroups}
          allFields={allFields}
          collections={collections}
          onSelect={handleSelect}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
