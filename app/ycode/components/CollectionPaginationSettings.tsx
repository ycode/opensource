'use client';

/**
 * Collection Pagination Settings Component
 *
 * Settings panel for configuring pagination on collection layers.
 * Supports two modes:
 * - Pages: Previous/Next buttons with URL-based navigation
 * - Load More: Append items on demand (future implementation)
 */

import React, { useState, useCallback } from 'react';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SettingsPanel from './SettingsPanel';
import type { Layer, CollectionPaginationConfig } from '@/types';
import { getCollectionVariable } from '@/lib/layer-utils';

interface CollectionPaginationSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  collectionId: string;
}

export default function CollectionPaginationSettings({
  layer,
  onLayerUpdate,
  collectionId,
}: CollectionPaginationSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Get current collection variable
  const collectionVariable = layer ? getCollectionVariable(layer) : null;

  // Get current pagination config
  const pagination = collectionVariable?.pagination;
  const isEnabled = pagination?.enabled ?? false;
  const mode = pagination?.mode ?? 'pages';
  const itemsPerPage = pagination?.items_per_page ?? 10;

  // Update pagination config
  const updatePagination = useCallback((updates: Partial<CollectionPaginationConfig>) => {
    if (!layer || !collectionVariable) return;

    const newPagination: CollectionPaginationConfig = {
      enabled: pagination?.enabled ?? false,
      mode: pagination?.mode ?? 'pages',
      items_per_page: pagination?.items_per_page ?? 10,
      ...updates,
    };

    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        collection: {
          ...collectionVariable,
          pagination: newPagination.enabled ? newPagination : undefined,
        },
      },
    });
  }, [layer, collectionVariable, pagination, onLayerUpdate]);

  // Handle enable toggle
  const handleEnableChange = (checked: boolean) => {
    updatePagination({ enabled: checked });
  };

  // Handle mode change
  const handleModeChange = (value: string) => {
    updatePagination({ mode: value as 'pages' | 'load_more' });
  };

  // Handle items per page change
  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value > 0) {
      updatePagination({ items_per_page: value });
    }
  };

  if (!layer || !collectionVariable) {
    return null;
  }

  return (
    <SettingsPanel
      title="Pagination"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="flex flex-col gap-3">
        {/* Enable Pagination Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="pagination-enabled" className="text-xs">
            Enable pagination
          </Label>
          <Switch
            id="pagination-enabled"
            checked={isEnabled}
            onCheckedChange={handleEnableChange}
          />
        </div>

        {/* Mode Selection - only show when enabled */}
        {isEnabled && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Mode</Label>
              <Select value={mode} onValueChange={handleModeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="pages">Pages (Previous / Next)</SelectItem>
                    <SelectItem value="load_more" disabled>
                      Load More (coming soon)
                    </SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {mode === 'pages' 
                  ? 'Navigate between pages with Previous/Next buttons'
                  : 'Load additional items without changing pages'
                }
              </p>
            </div>

            {/* Items Per Page */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Items per page</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
                className="w-full"
              />
            </div>
          </>
        )}
      </div>
    </SettingsPanel>
  );
}
