'use client';

import React, { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface InputAutocompleteProps<T extends Record<string, any>> {
  options: T[];
  selected?: T | null;
  onSelect: (option: T | null) => void;
  search?: string;
  onSearchChange?: (search: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
  searchableKeys?: (keyof T)[];
  filterFn?: (option: T, search: string) => boolean;
  renderItem?: (option: T, isSelected: boolean) => ReactNode;
  renderEmpty?: () => ReactNode;
}

export function InputAutocomplete<T extends Record<string, any>>({
  options,
  selected,
  onSelect,
  search: searchProp,
  onSearchChange,
  placeholder = 'Search...',
  id,
  className,
  disabled = false,
  searchableKeys,
  filterFn,
  renderItem,
  renderEmpty,
}: InputAutocompleteProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [internalSearch, setInternalSearch] = useState('');

  // Use controlled or uncontrolled search
  const search = searchProp !== undefined ? searchProp : internalSearch;
  const setSearch = onSearchChange || setInternalSearch;

  // Get searchable text from option based on searchableKeys
  const getSearchableText = (option: T): string => {
    if (searchableKeys && searchableKeys.length > 0) {
      return searchableKeys
        .map((key) => String(option[key] || ''))
        .join(' ');
    }
    return Object.values(option).join(' ');
  };

  const defaultFilterFn = (option: T, searchValue: string) => {
    const searchableText = getSearchableText(option);
    return searchableText.toLowerCase().includes(searchValue.toLowerCase());
  };

  const filteredOptions = search
    ? options.filter((opt) => (filterFn || defaultFilterFn)(opt, search))
    : options;

  const handleSelect = (option: T) => {
    onSelect(option);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearch('');
    onSelect(null);
  };

  return (
    <Popover open={isOpen && !disabled} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className={cn('relative', className)}>
          <Input
            id={id}
            placeholder={placeholder}
            value={search}
            onChange={(e) => {
              if (!disabled) {
                setSearch(e.target.value);
                setIsOpen(true);
              }
            }}
            onFocus={() => {
              if (!disabled) {
                setIsOpen(true);
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) {
                setIsOpen(true);
              }
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            autoComplete="off"
            className="pr-8"
            disabled={disabled}
          />
          {search && !disabled && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleClear();
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            >
              <Icon name="x" className="h-3 w-3" />
            </Button>
          )}
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1 max-h-[315px] overflow-hidden"
        align="start"
        onWheel={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (id && (e.target as HTMLElement).closest(`#${id}`)) {
            e.preventDefault();
          }
        }}
      >
        <div className="overflow-y-auto max-h-[inherit] overscroll-contain no-scrollbar">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => {
              const isSelected = selected === option;

              return (
                <div
                  key={index}
                  onClick={() => handleSelect(option)}
                  className={cn(
                    'w-full rounded-md hover:bg-secondary cursor-pointer transition-colors',
                    isSelected && 'bg-secondary'
                  )}
                >
                  {renderItem ? renderItem(option, isSelected) : (
                    <div className="flex items-center justify-between px-1.75 py-1.25 text-xs">
                      <span>{getSearchableText(option)}</span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            renderEmpty ? renderEmpty() : (
              <div className="px-3 py-6 text-center text-muted-foreground text-xs">
                No results found
              </div>
            )
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
