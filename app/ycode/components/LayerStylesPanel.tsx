'use client';

/**
 * Layer Styles Panel
 *
 * UI for managing layer styles in the Right Sidebar
 * Allows creating, applying, editing, detaching, and deleting styles
 */

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Icon } from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';
import type { Layer, LayerStyle } from '@/types';
import { useLayerStylesStore } from '@/stores/useLayerStylesStore';
import { usePagesStore } from '@/stores/usePagesStore';
import {
  applyStyleToLayer,
  detachStyleFromLayer,
  hasStyleOverrides,
  resetLayerToStyle,
} from '@/lib/layer-style-utils';
import { Spinner } from '@/components/ui/spinner';
import { Empty, EmptyTitle, EmptyDescription } from '@/components/ui/empty';

interface LayerStylesPanelProps {
  layer: Layer | null;
  pageId: string | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function LayerStylesPanel({
  layer,
  pageId,
  onLayerUpdate,
}: LayerStylesPanelProps) {
  const {
    styles,
    isLoading,
    createStyle,
    updateStyle,
    deleteStyle,
    getStyleById,
  } = useLayerStylesStore();

  const { updateStyleOnLayers, detachStyleFromAllLayers } = usePagesStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Styles are loaded during app initialization (no need to load here)

  // Get the applied style if any
  const appliedStyle = layer?.styleId ? getStyleById(layer.styleId) : undefined;
  const hasOverrides = layer && appliedStyle ? hasStyleOverrides(layer, appliedStyle) : false;

  // Get current layer's classes and design
  const currentClasses = layer
    ? Array.isArray(layer.classes)
      ? layer.classes.join(' ')
      : layer.classes || ''
    : '';

  const currentDesign = layer?.design;

  /**
   * Create a new style from current layer
   */
  const handleCreateStyle = useCallback(async () => {
    if (!layer || !newStyleName.trim()) return;

    const style = await createStyle(newStyleName.trim(), currentClasses, currentDesign);

    if (style) {
      // Automatically apply the new style to the current layer
      const updatedLayer = applyStyleToLayer(layer, style);
      onLayerUpdate(layer.id, updatedLayer);
      setNewStyleName('');
      setIsCreating(false);
    }
  }, [layer, newStyleName, currentClasses, currentDesign, createStyle, onLayerUpdate]);

  /**
   * Apply a style to the current layer
   */
  const handleApplyStyle = useCallback((styleId: string) => {
    if (!layer || !styleId) return;

    const style = getStyleById(styleId);
    if (!style) return;

    const updatedLayer = applyStyleToLayer(layer, style);
    onLayerUpdate(layer.id, {
      classes: updatedLayer.classes,
      design: updatedLayer.design,
      styleId: updatedLayer.styleId,
      styleOverrides: undefined,
    });
  }, [layer, getStyleById, onLayerUpdate]);

  /**
   * Detach style from current layer
   * Copies the style's values to the layer before detaching
   */
  const handleDetachStyle = useCallback(() => {
    if (!layer) return;

    const updatedLayer = detachStyleFromLayer(layer, appliedStyle);

    // Send only the changed fields to onLayerUpdate
    onLayerUpdate(layer.id, {
      classes: updatedLayer.classes,
      design: updatedLayer.design,
      styleId: undefined,
      styleOverrides: undefined,
    });
  }, [layer, appliedStyle, onLayerUpdate]);

  /**
   * Reset overrides on current layer
   */
  const handleResetOverrides = useCallback(() => {
    if (!layer || !appliedStyle) return;

    const updatedLayer = resetLayerToStyle(layer, appliedStyle);
    onLayerUpdate(layer.id, {
      classes: updatedLayer.classes,
      design: updatedLayer.design,
      styleOverrides: undefined,
    });
  }, [layer, appliedStyle, onLayerUpdate]);

  /**
   * Update style with current layer's values
   */
  const handleUpdateStyle = useCallback(async () => {
    if (!layer || !appliedStyle) return;

    // Update the style in the database
    await updateStyle(appliedStyle.id, {
      classes: currentClasses,
      design: currentDesign,
    });

    // Update all layers using this style across all pages
    updateStyleOnLayers(appliedStyle.id, currentClasses, currentDesign);

    // Clear overrides from the current layer since it now matches the style
    onLayerUpdate(layer.id, {
      styleOverrides: undefined,
    });
  }, [layer, appliedStyle, currentClasses, currentDesign, updateStyle, updateStyleOnLayers, onLayerUpdate]);

  /**
   * Delete a style
   */
  const handleDeleteStyle = useCallback(async (styleId: string) => {
    if (!confirm('Are you sure you want to delete this style? It will be detached from all layers.')) {
      return;
    }

    // Delete the style (backend will detach from all page versions in the database)
    await deleteStyle(styleId);

    // Update local state to detach style from all layers
    // No need to reload draft - this updates all drafts instantly
    detachStyleFromAllLayers(styleId);
  }, [deleteStyle, detachStyleFromAllLayers]);

  /**
   * Rename the applied style
   */
  const handleRenameStyle = useCallback(async () => {
    if (!appliedStyle || !renameValue.trim()) return;

    await updateStyle(appliedStyle.id, { name: renameValue.trim() });
    setIsRenaming(false);
    setRenameValue('');
  }, [appliedStyle, renameValue, updateStyle]);

  if (!layer) {
    return (
      <div className="p-4 text-sm text-zinc-500">
        Select a layer to manage styles
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 pb-4 pt-2">

      {/* Style Selector or Rename Input */}
      {!isCreating && (
        <>
          {appliedStyle && isRenaming ? (
            <div className="flex flex-col gap-2">
              <Input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameStyle();
                  if (e.key === 'Escape') {
                    setIsRenaming(false);
                    setRenameValue('');
                  }
                }}
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={handleRenameStyle}
              >
                Save changes
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setIsRenaming(false);
                  setRenameValue('');
                }}
              >
                Cancel
              </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Select
                  onValueChange={handleApplyStyle}
                  value={layer?.styleId || undefined}
                >
                  <SelectTrigger className="flex-1">
                    {styles.length === 0 ? (
                    <span className="opacity-50">Select a style...</span>
                    ) : (
                    <SelectValue placeholder="Select a style..." />
                    )}
                    {/* Show "Customised" badge when there are overrides */}
                    {hasOverrides && (
                      <span className="ml-auto text-yellow-400 text-[10px] pr-1">Customized</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {styles.length === 0 ? (
                      <Empty>
                        <EmptyTitle>No layers styles</EmptyTitle>
                      </Empty>
                    ) : (
                      <SelectGroup>
                        {styles.map((style) => (
                          <SelectItem key={style.id} value={style.id}>
                            {style.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create New Style Modal/Form */}
      {isCreating && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Style name..."
            value={newStyleName}
            onChange={(e) => setNewStyleName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateStyle();
              if (e.key === 'Escape') {
                setIsCreating(false);
                setNewStyleName('');
              }
            }}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="default"
              onClick={handleCreateStyle}
              disabled={!newStyleName.trim()}
              className="flex-1"
            >
              Create
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setIsCreating(false);
                setNewStyleName('');
              }}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {!isCreating && !isRenaming && (
        <div className="flex">

        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsCreating(true)}
          className="flex-1"
        >
          <Icon name="plus" />
          New
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleUpdateStyle}
          disabled={!hasOverrides}
        >
          Update
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={handleDetachStyle}
          disabled={!appliedStyle}
        >
          Detach
        </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm" variant="ghost"

              >
                <Icon name="more" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={handleResetOverrides}
              disabled={!hasOverrides}
            >
              Reset
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                if (!appliedStyle) return;
                setRenameValue(appliedStyle.name);
                setIsRenaming(true);
              }}
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => appliedStyle && handleDeleteStyle(appliedStyle.id)}
              className="text-red-500"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>
      )}

    </div>
  );
}
