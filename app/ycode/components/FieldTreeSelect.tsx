'use client';

/**
 * Field Tree Select
 *
 * Recursive component for selecting fields from a collection with nested reference support.
 * Reference fields appear as collapsible group headers, and their linked collection's fields
 * appear nested underneath. Multi-reference fields are excluded.
 */

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import Icon from '@/components/ui/icon';
import { DropdownMenuItem, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import type { CollectionField, Collection } from '@/types';
import type { IconProps } from '@/components/ui/icon';
import { getFieldIcon } from '@/lib/collection-field-utils';

/** Field source for inline variable resolution */
export type FieldSourceType = 'page' | 'collection';

/** A group of fields with a source and label */
export interface FieldGroup {
  fields: CollectionField[];
  label?: string;
  source?: FieldSourceType;
}

interface FieldTreeSelectProps {
  /** Fields to display at the current level */
  fields: CollectionField[];
  /** All fields keyed by collection ID for resolving nested references */
  allFields: Record<string, CollectionField[]>;
  /** All collections for looking up collection names */
  collections: Collection[];
  /** Callback when a field is selected (source is passed when available) */
  onSelect: (fieldId: string, relationshipPath: string[], source?: FieldSourceType) => void;
  /** Current relationship path (used internally for recursion) */
  relationshipPath?: string[];
  /** Label for the current collection group */
  collectionLabel?: string;
  /** Source type for these fields (used internally for recursion) */
  source?: FieldSourceType;
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
  return (
    <DropdownMenuItem
      onClick={onSelect}
      className="gap-2"
      style={{ paddingLeft: `${8 + depth * 16}px` }}
    >
      {/*<Icon name={getFieldIcon(field) as IconProps['name']} className="size-3 text-zinc-500 shrink-0" />*/}
      <span className="truncate">{field.name}</span>
    </DropdownMenuItem>
  );
}

/**
 * Reference field group (collapsible)
 */
function ReferenceFieldGroup({
  field,
  allFields,
  collections,
  onSelect,
  relationshipPath,
  source,
  depth = 0,
}: {
  field: CollectionField;
  allFields: Record<string, CollectionField[]>;
  collections: Collection[];
  onSelect: (fieldId: string, relationshipPath: string[], source?: FieldSourceType) => void;
  relationshipPath: string[];
  source?: FieldSourceType;
  depth?: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const referencedCollectionId = field.reference_collection_id;
  const referencedFields = referencedCollectionId ? allFields[referencedCollectionId] || [] : [];
  const referencedCollection = collections.find((c) => c.id === referencedCollectionId);

  // Filter out multi-reference fields from nested display
  const displayableFields = referencedFields.filter((f) => f.type !== 'multi_reference');

  // Always show the reference field header, even if no nested fields are loaded yet
  const hasNestedFields = displayableFields.length > 0;

  return (
    <div className="w-full">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => hasNestedFields && setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 w-full px-2 py-1.5 text-left text-xs rounded-md',
          'transition-colors',
          hasNestedFields
            ? 'hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 cursor-pointer'
            : 'text-zinc-600 cursor-default'
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {hasNestedFields ? (
          <Icon
            name="chevronRight"
            className={cn(
              'size-3 text-zinc-500 shrink-0 transition-transform duration-200',
              isOpen && 'rotate-90'
            )}
          />
        ) : (
          <span className="size-3 shrink-0" /> // Spacer when no chevron
        )}
        <Icon name="database" className="size-3 text-zinc-500 shrink-0" />
        <span className="truncate font-medium">{field.name}</span>
        {referencedCollection && (
          <span className="text-zinc-600 text-[10px] truncate">({referencedCollection.name})</span>
        )}
        {!hasNestedFields && (
          <span className="text-zinc-600 text-[10px]">Loading...</span>
        )}
      </button>

      {/* Nested fields */}
      {isOpen && hasNestedFields && (
        <div className="mt-0.5">
          <FieldTreeSelectInner
            fields={displayableFields}
            allFields={allFields}
            collections={collections}
            onSelect={onSelect}
            relationshipPath={[...relationshipPath, field.id]}
            source={source}
            depth={depth + 1}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Inner recursive component
 */
function FieldTreeSelectInner({
  fields,
  allFields,
  collections,
  onSelect,
  relationshipPath = [],
  source,
  depth = 0,
}: FieldTreeSelectProps) {
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
                onSelect(relationshipPath[0], [...relationshipPath.slice(1), field.id], source);
              } else {
                // Root field: no relationship path
                onSelect(field.id, [], source);
              }
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Field Tree Select - Main export
 *
 * Renders a tree of fields with collapsible reference field groups.
 * Multi-reference fields are excluded from the tree.
 */
export default function FieldTreeSelect({
  fields,
  allFields,
  collections,
  onSelect,
  collectionLabel,
  source,
  relationshipPath = [],
  depth = 0,
}: FieldTreeSelectProps) {
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
    <div className="py-1">
      {collectionLabel && (
        <DropdownMenuLabel>{collectionLabel}</DropdownMenuLabel>
      )}
      <FieldTreeSelectInner
        fields={displayableFields}
        allFields={allFields}
        collections={collections}
        onSelect={onSelect}
        relationshipPath={relationshipPath}
        source={source}
        depth={depth}
      />
    </div>
  );
}

interface MultiSourceFieldTreeSelectProps {
  /** Field groups to display, each with their own source and label */
  fieldGroups: FieldGroup[];
  /** All fields keyed by collection ID for resolving nested references */
  allFields: Record<string, CollectionField[]>;
  /** All collections for looking up collection names */
  collections: Collection[];
  /** Callback when a field is selected */
  onSelect: (fieldId: string, relationshipPath: string[], source?: FieldSourceType) => void;
}

/**
 * Multi-source Field Tree Select
 *
 * Renders multiple field groups with different sources (e.g., collection layer + page collection).
 * Each group is displayed under its own label.
 */
export function MultiSourceFieldTreeSelect({
  fieldGroups,
  allFields,
  collections,
  onSelect,
}: MultiSourceFieldTreeSelectProps) {
  // Filter out empty groups
  const nonEmptyGroups = fieldGroups.filter(
    (group) => group.fields.filter((f) => f.type !== 'multi_reference').length > 0
  );

  if (nonEmptyGroups.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-zinc-500">
        No fields available
      </div>
    );
  }

  return (
    <div className="py-1">
      {nonEmptyGroups.map((group, index) => (
        <div key={group.label || index}>
          <FieldTreeSelect
            fields={group.fields}
            allFields={allFields}
            collections={collections}
            onSelect={onSelect}
            collectionLabel={group.label}
            source={group.source}
          />
        </div>
      ))}
    </div>
  );
}
