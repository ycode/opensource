'use client';

/**
 * Collection Link Field Input
 *
 * Input component for editing link field values in collection items.
 * Supports URL and Page link types (no email, phone, asset, or dynamic options).
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CollectionLinkValue, CollectionLinkType, CollectionItemWithValues, Layer } from '@/types';
import { usePagesStore } from '@/stores/usePagesStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { collectionsApi } from '@/lib/api';
import { getLayerIcon, getLayerName } from '@/lib/layer-utils';
import PageSelector from './PageSelector';

interface CollectionLinkFieldInputProps {
  value: string | CollectionLinkValue | undefined; // JSON string, parsed object, or empty
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Parse link value from JSON string or object
 */
function parseLinkValue(value: string | CollectionLinkValue | undefined): CollectionLinkValue | null {
  if (!value) return null;

  // If already an object, return it
  if (typeof value === 'object' && 'type' in value) {
    return value as CollectionLinkValue;
  }

  // If string, parse JSON
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Stringify link value to JSON
 */
function stringifyLinkValue(linkValue: CollectionLinkValue | null): string {
  if (!linkValue) return '';
  return JSON.stringify(linkValue);
}

export default function CollectionLinkFieldInput({
  value,
  onChange,
  disabled = false,
}: CollectionLinkFieldInputProps) {
  const [collectionItems, setCollectionItems] = useState<CollectionItemWithValues[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Stores
  const pages = usePagesStore((state) => state.pages);
  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);
  const { fields: collectionsFields } = useCollectionsStore();

  // Parse current value
  const linkValue = useMemo(() => parseLinkValue(value), [value]);
  const linkType: CollectionLinkType | 'none' = linkValue?.type || 'none';

  // Current values
  const urlValue = linkValue?.url || '';
  const pageId = linkValue?.page?.id || '';
  const collectionItemId = linkValue?.page?.collection_item_id || null;
  const anchorLayerId = linkValue?.page?.anchor_layer_id || '';

  // Find layers with ID attribute for anchor selection
  const findLayersWithId = useCallback((layers: Layer[]): Array<{ layer: Layer; id: string }> => {
    const result: Array<{ layer: Layer; id: string }> = [];
    const stack: Layer[] = [...layers];

    while (stack.length > 0) {
      const layer = stack.pop()!;

      if (layer.attributes?.id) {
        result.push({ layer, id: layer.attributes.id });
      }

      if (layer.children) {
        stack.push(...layer.children);
      }
    }

    return result;
  }, []);

  // Get layers for anchor selection from the selected page
  const anchorLayers = useMemo(() => {
    if (!pageId) return [];

    const draft = draftsByPageId[pageId];
    if (!draft || !draft.layers) return [];

    return findLayersWithId(draft.layers);
  }, [pageId, draftsByPageId, findLayersWithId]);

  // Get the selected page
  const selectedPage = useMemo(() => {
    if (!pageId) return null;
    return pages.find((p) => p.id === pageId) || null;
  }, [pageId, pages]);

  // Check if selected page is dynamic
  const isDynamicPage = selectedPage?.is_dynamic || false;
  const pageCollectionId = selectedPage?.settings?.cms?.collection_id || null;

  // Get slug field for the collection
  const slugFieldId = selectedPage?.settings?.cms?.slug_field_id || null;
  const collectionFields = pageCollectionId ? collectionsFields[pageCollectionId] || [] : [];
  const nameField = collectionFields.find((f) => f.key === 'name');

  // Load collection items when dynamic page is selected
  useEffect(() => {
    if (!pageCollectionId || !isDynamicPage) {
      setCollectionItems([]);
      return;
    }

    const loadItems = async () => {
      setLoadingItems(true);
      try {
        const response = await collectionsApi.getItems(pageCollectionId);
        if (response.data) {
          setCollectionItems(response.data.items || []);
        }
      } catch (error) {
        console.error('Failed to load collection items:', error);
      } finally {
        setLoadingItems(false);
      }
    };

    loadItems();
  }, [pageCollectionId, isDynamicPage]);

  // Get display name for collection item
  const getItemDisplayName = useCallback((itemId: string): string => {
    const item = collectionItems.find((i) => i.id === itemId);
    if (!item) return itemId;

    // Try name field first
    if (nameField && item.values[nameField.id]) {
      return item.values[nameField.id];
    }

    // Try slug field
    if (slugFieldId && item.values[slugFieldId]) {
      return item.values[slugFieldId];
    }

    // Fallback to first value
    const firstValue = Object.values(item.values)[0];
    return firstValue || itemId;
  }, [collectionItems, nameField, slugFieldId]);

  // Update link value helper
  const updateLinkValue = useCallback(
    (newValue: CollectionLinkValue | null) => {
      onChange(stringifyLinkValue(newValue));
    },
    [onChange]
  );

  // Handle link type change
  const handleLinkTypeChange = useCallback(
    (newType: CollectionLinkType | 'none') => {
      if (newType === 'none') {
        updateLinkValue(null);
        return;
      }

      // Create new link value with the new type
      const newValue: CollectionLinkValue = {
        type: newType,
      };

      // Initialize with empty values based on type
      if (newType === 'url') {
        newValue.url = '';
      } else if (newType === 'page') {
        newValue.page = { id: '', collection_item_id: null };
      }

      updateLinkValue(newValue);
    },
    [updateLinkValue]
  );

  // Handle URL change
  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!linkValue) return;
      updateLinkValue({
        ...linkValue,
        url: e.target.value,
      });
    },
    [linkValue, updateLinkValue]
  );

  // Handle page selection
  const handlePageChange = useCallback(
    (newPageId: string) => {
      if (!linkValue) return;
      updateLinkValue({
        ...linkValue,
        page: {
          id: newPageId,
          collection_item_id: null, // Reset item when page changes
          anchor_layer_id: null, // Reset anchor when page changes
        },
      });
    },
    [linkValue, updateLinkValue]
  );

  // Handle collection item selection
  const handleCollectionItemChange = useCallback(
    (itemId: string) => {
      if (!linkValue || !linkValue.page) return;
      updateLinkValue({
        ...linkValue,
        page: {
          ...linkValue.page,
          collection_item_id: itemId || null,
        },
      });
    },
    [linkValue, updateLinkValue]
  );

  // Handle anchor layer ID change
  const handleAnchorLayerIdChange = useCallback(
    (value: string) => {
      if (!linkValue || !linkValue.page) return;
      updateLinkValue({
        ...linkValue,
        page: {
          ...linkValue.page,
          anchor_layer_id: value === 'none' ? null : value,
        },
      });
    },
    [linkValue, updateLinkValue]
  );

  // Link type options
  const linkTypeOptions = [
    { value: 'none', label: 'No link', detail: null, icon: 'none' },
    { value: 'page', label: 'Page', detail: 'Link to a regular or dynamic page', icon: 'page' },
    { value: 'url', label: 'URL', detail: 'Link to a custom URL', icon: 'link' },
  ];

  return (
    <div className="space-y-3">
      {/* Link Type */}
      <div className="flex flex-col gap-1.5">
        <Select
          value={linkType}
          onValueChange={(value) => handleLinkTypeChange(value as CollectionLinkType | 'none')}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select link type" />
          </SelectTrigger>
          <SelectContent>
            {linkTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center gap-2">
                  <Icon name={option.icon as any} className="size-3" />
                  <span>{option.label}</span>
                  {option.detail && (
                    <>
                      <span className="text-xs text-muted-foreground">-</span>
                      <span className="text-xs text-muted-foreground">{option.detail}</span>
                    </>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* URL Input */}
      {linkType === 'url' && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">URL</Label>
          <Input
            value={urlValue}
            onChange={handleUrlChange}
            placeholder="https://example.com"
            disabled={disabled}
          />
        </div>
      )}

      {/* Page Selection */}
      {linkType === 'page' && (
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Page</Label>
              <PageSelector
                value={pageId}
                onValueChange={handlePageChange}
                disabled={disabled}
              />
            </div>
          </div>

          {/* Collection Item Selection (for dynamic pages) */}
          {isDynamicPage && pageId && (
            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">CMS item</Label>
                <Select
                  value={collectionItemId || ''}
                  onValueChange={handleCollectionItemChange}
                  disabled={disabled || loadingItems}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loadingItems ? 'Loading...' : 'Select a CMS item'} />
                  </SelectTrigger>
                  <SelectContent>
                    {collectionItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {getItemDisplayName(item.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Anchor selection (for page links) */}
          {pageId && (
            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Anchor</Label>
                <Select
                  value={anchorLayerId || 'none'}
                  onValueChange={handleAnchorLayerIdChange}
                  disabled={disabled}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select anchor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <div className="flex items-center gap-2">
                        <Icon name="none" className="size-3" />
                        <span>No anchor</span>
                      </div>
                    </SelectItem>
                    {anchorLayers.map(({ layer, id }) => (
                      <SelectItem key={id} value={id}>
                        <div className="flex items-center gap-2">
                          <Icon name={getLayerIcon(layer)} className="size-3" />
                          <span>{getLayerName(layer)}</span>
                          <span className="text-xs text-muted-foreground">#{id}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
