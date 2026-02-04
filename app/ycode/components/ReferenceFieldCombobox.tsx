/**
 * ReferenceFieldCombobox Component
 *
 * A searchable combobox for selecting referenced collection items.
 * Supports both single reference and multi-reference selection.
 */
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import Icon from '@/components/ui/icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { collectionsApi } from '@/lib/api';
import { findDisplayField, getItemDisplayName } from '@/lib/collection-field-utils';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { cn } from '@/lib/utils';
import type { CollectionItemWithValues } from '@/types';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';

interface ReferenceFieldComboboxProps {
  /** The collection ID to fetch items from */
  collectionId: string;
  /** Current value - single ID for reference, JSON array string for multi_reference */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Whether this is a multi-reference field */
  isMulti?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
}

export default function ReferenceFieldCombobox({
  collectionId,
  value,
  onChange,
  isMulti = false,
  placeholder = 'Select item...',
  disabled = false,
}: ReferenceFieldComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState<CollectionItemWithValues[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the collection info and fields from the store
  const { collections, fields } = useCollectionsStore();
  const collection = collections.find(c => c.id === collectionId);
  /* eslint-disable-next-line react-hooks/exhaustive-deps -- collectionFields derived from store */
  const collectionFields = fields[collectionId] || [];

  // Find the title/name field for display
  const displayField = useMemo(() => findDisplayField(collectionFields), [collectionFields]);

  // Parse value based on isMulti
  const selectedIds = useMemo(() => {
    if (!value) return [];
    if (isMulti) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [value];
  }, [value, isMulti]);

  // Get display name for an item
  const getDisplayName = useCallback(
    (item: CollectionItemWithValues) => getItemDisplayName(item, displayField),
    [displayField]
  );

  // Fetch items when popover opens
  useEffect(() => {
    if (open && collectionId) {
      const fetchItems = async () => {
        setLoading(true);
        setError(null);
        try {
          const response = await collectionsApi.getItems(collectionId, {
            limit: 100, // Reasonable limit for combobox
          });
          if (response.error) {
            throw new Error(response.error);
          }
          setItems(response.data?.items || []);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load items');
        } finally {
          setLoading(false);
        }
      };
      fetchItems();
    }
  }, [open, collectionId]);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;

    const query = searchQuery.toLowerCase();
    return items.filter(item => {
      // Search across all text values
      return Object.values(item.values).some(val =>
        val && String(val).toLowerCase().includes(query)
      );
    });
  }, [items, searchQuery]);

  // Handle single selection with toggle (can deselect)
  const handleSingleSelect = (itemId: string) => {
    // If clicking the same item, deselect it
    if (selectedIds.includes(itemId)) {
      onChange('');
    } else {
      onChange(itemId);
    }
    setOpen(false);
    setSearchQuery('');
  };

  // Handle multi selection toggle
  const handleMultiToggle = (itemId: string) => {
    const newSelectedIds = selectedIds.includes(itemId)
      ? selectedIds.filter(id => id !== itemId)
      : [...selectedIds, itemId];
    onChange(JSON.stringify(newSelectedIds));
  };

  // Clear selection
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(isMulti ? '[]' : '');
  };

  // Get display text for trigger button
  const getDisplayText = () => {
    if (selectedIds.length === 0) return placeholder;

    if (isMulti) {
      return `${selectedIds.length} item${selectedIds.length !== 1 ? 's' : ''} selected`;
    }

    // For single reference, find the item name
    const selectedItem = items.find(item => item.id === selectedIds[0]);
    if (selectedItem) {
      return getDisplayName(selectedItem);
    }

    // If items not loaded yet, show ID abbreviated
    return 'Loading...';
  };

  return (
    <div className="flex items-center gap-1">

      <div className="flex-1">
        <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="input"
            role="combobox"
            size="sm"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              'w-full justify-between font-normal',
              !selectedIds.length && 'text-muted-foreground'
            )}
          >
            <span className="truncate">{getDisplayText()}</span>
            <Icon
              name="chevronCombo"
              className={cn('size-2.5 opacity-50 ml-2', open && '')}
            />
          </Button>
        </DropdownMenuTrigger>

      <DropdownMenuContent className="w-(--radix-dropdown-menu-trigger-width) min-w-50" align="start">
        {/* Search Input */}
        <div className="mb-2">
          <Input
            placeholder={`Search ${collection?.name || 'items'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="xs"
          />
        </div>

        {/* Items List */}
        <div className="max-h-60 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Spinner />
            </div>
          ) : error ? (
            <div className="text-center py-4 text-sm text-destructive">
              {error}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              <Empty>
                <EmptyTitle>{searchQuery ? 'No items found' : 'No items in this collection'}</EmptyTitle>
              </Empty>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const displayName = getDisplayName(item);

              return (
                <DropdownMenuCheckboxItem
                  key={item.id}
                  checked={isSelected}
                  onCheckedChange={() => isMulti ? handleMultiToggle(item.id) : handleSingleSelect(item.id)}
                  onSelect={(e) => {
                    e.preventDefault();
                  }}
                >
                  {displayName}
                </DropdownMenuCheckboxItem>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
      </div>

      {selectedIds.length > 0 && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleClear}
        >
          <Icon name="x" />
        </Button>
      )}

  </div>
  );
}
