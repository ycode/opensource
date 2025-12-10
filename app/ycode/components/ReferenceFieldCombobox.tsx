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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import Icon from '@/components/ui/icon';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { collectionsApi } from '@/lib/api';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { cn } from '@/lib/utils';
import type { CollectionItemWithValues, CollectionField } from '@/types';

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
  const collectionFields = fields[collectionId] || [];

  // Find the title/name field for display
  const displayField = useMemo(() => {
    // Priority: 'title' key, 'name' key, first text field, first field
    const titleField = collectionFields.find(f => f.key === 'title');
    if (titleField) return titleField;

    const nameField = collectionFields.find(f => f.key === 'name');
    if (nameField) return nameField;

    const textField = collectionFields.find(f => f.type === 'text' && f.fillable);
    if (textField) return textField;

    return collectionFields[0] || null;
  }, [collectionFields]);

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

  // Get display names for selected items
  const getItemDisplayName = useCallback((item: CollectionItemWithValues) => {
    if (!displayField) return 'Untitled';
    return item.values[displayField.id] || 'Untitled';
  }, [displayField]);

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

  // Handle single selection
  const handleSingleSelect = (itemId: string) => {
    onChange(itemId);
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
      return getItemDisplayName(selectedItem);
    }

    // If items not loaded yet, show ID abbreviated
    return 'Loading...';
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !selectedIds.length && 'text-muted-foreground'
          )}
        >
          <span className="truncate">{getDisplayText()}</span>
          <div className="flex items-center gap-1 ml-2">
            {selectedIds.length > 0 && (
              <span
                role="button"
                onClick={handleClear}
                className="hover:bg-secondary rounded p-0.5"
              >
                <Icon name="x" className="size-3" />
              </span>
            )}
            <Icon
              name="chevronCombo"
              className={cn('size-4 transition-transform', open && 'rotate-180')}
            />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        {/* Search Input */}
        <div className="p-2 border-b">
          <Input
            placeholder={`Search ${collection?.name || 'items'}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>

        {/* Items List */}
        <div className="max-h-60 overflow-y-auto p-1">
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
              {searchQuery ? 'No items found' : 'No items in this collection'}
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const displayName = getItemDisplayName(item);

              if (isMulti) {
                return (
                  <label
                    key={item.id}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer',
                      'hover:bg-secondary/50',
                      isSelected && 'bg-secondary'
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleMultiToggle(item.id)}
                    />
                    <span className="truncate text-sm">{displayName}</span>
                  </label>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSingleSelect(item.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left',
                    'hover:bg-secondary/50',
                    isSelected && 'bg-secondary'
                  )}
                >
                  {isSelected && <Icon name="check" className="size-4 text-primary" />}
                  <span className={cn('truncate text-sm', !isSelected && 'ml-6')}>
                    {displayName}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Multi-select footer */}
        {isMulti && selectedIds.length > 0 && (
          <div className="border-t p-2 flex items-center justify-between">
            <Badge variant="secondary">
              {selectedIds.length} selected
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setSearchQuery('');
              }}
            >
              Done
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
