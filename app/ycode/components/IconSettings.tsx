'use client';

/**
 * Icon Settings Component
 *
 * Settings panel for icon layers with icon library selection
 */

import React, { useState, useCallback } from 'react';

import { Label } from '@/components/ui/label';
import SettingsPanel from './SettingsPanel';
import type { Layer, CollectionField, Collection } from '@/types';
import { createStaticTextVariable, createAssetVariable, isAssetVariable, getAssetId, isFieldVariable, isStaticTextVariable, getStaticTextContent } from '@/lib/variable-utils';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useEditorStore } from '@/stores/useEditorStore';
import { useAssetsStore } from '@/stores/useAssetsStore';
import { ASSET_CATEGORIES, isAssetOfType } from '@/lib/asset-utils';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

interface IconSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  fields?: CollectionField[];
  fieldSourceLabel?: string;
  allFields?: Record<string, CollectionField[]>;
  collections?: Collection[];
}

export default function IconSettings({ layer, onLayerUpdate, fields, fieldSourceLabel, allFields, collections }: IconSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Initialize selectedField from current field variable if it exists
  const iconSrc = layer?.variables?.icon?.src;
  const initialFieldId = iconSrc && isFieldVariable(iconSrc) && 'data' in iconSrc && 'field_id' in iconSrc.data
    ? iconSrc.data.field_id
    : null;
  const [selectedField, setSelectedField] = useState<string | null>(initialFieldId);

  const openFileManager = useEditorStore((state) => state.openFileManager);
  const getAsset = useAssetsStore((state) => state.getAsset);

  const handleAssetSelect = useCallback((assetId: string) => {
    if (!layer) return;

    const assetVariable = createAssetVariable(assetId);

    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        icon: {
          src: assetVariable,
        },
      },
    });
  }, [layer, onLayerUpdate]);

  const handleFieldSelect = useCallback((fieldId: string) => {
    if (!layer) return;

    const fieldVariable: { type: 'field'; data: { field_id: string; relationships: string[] } } = {
      type: 'field',
      data: {
        field_id: fieldId,
        relationships: [],
      },
    };

    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        icon: {
          src: fieldVariable,
        },
      },
    });

    setSelectedField(fieldId);
  }, [layer, onLayerUpdate]);

  const handleBrowseAsset = useCallback(() => {
    // Get current asset ID if icon src is an AssetVariable
    const currentAssetId = (() => {
      const src = layer?.variables?.icon?.src;
      if (isAssetVariable(src)) {
        return getAssetId(src);
      }
      return null;
    })();

    openFileManager(
      (asset) => {
        if (!layer) return false;

        // Validate that it's an SVG file (image/svg+xml)
        if (!asset.mime_type || asset.mime_type !== 'image/svg+xml') {
          toast.error('Invalid asset type', {
            description: 'Please select an SVG file.',
          });
          return false; // Don't close file manager
        }

        handleAssetSelect(asset.id);
      },
      currentAssetId
    );
  }, [openFileManager, handleAssetSelect, layer]);

  // Only show for icon layers
  if (!layer || layer.name !== 'icon') {
    return null;
  }

  // Check if current src is a field variable
  const isFieldVariableSrc = iconSrc ? isFieldVariable(iconSrc) : false;
  const currentFieldId = isFieldVariableSrc && iconSrc && 'data' in iconSrc && 'field_id' in iconSrc.data
    ? iconSrc.data.field_id
    : null;

  // Get icon fields (image type fields can store any asset including SVG icons)
  const iconFields = fields?.filter(f => f.type === 'image') || [];

  // Get current icon source (always SVG code string or null)
  const currentIconSource = (() => {
    if (!iconSrc) return null;
    if (isStaticTextVariable(iconSrc)) {
      return getStaticTextContent(iconSrc);
    }
    if (isAssetVariable(iconSrc)) {
      const assetId = getAssetId(iconSrc);
      const asset = assetId ? getAsset(assetId) : null;
      return asset?.content || null;
    }
    return null;
  })();

  return (
    <SettingsPanel
      title="Icon"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="flex flex-col gap-4">
        {/* Source Section */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 items-center">
            <Label variant="muted">Source</Label>

            <div className="col-span-2 flex gap-2">
              {!selectedField && !currentFieldId && (
                <>
                  <div className="bg-input rounded-md h-8 aspect-3/2 flex items-center justify-center">
                    {currentIconSource ? (
                      <div
                        data-icon="true"
                        className="w-full h-full flex items-center justify-center p-2"
                        dangerouslySetInnerHTML={{ __html: currentIconSource }}
                      />
                    ) : (
                      <Icon name="icon" className="size-4 text-muted-foreground" />
                    )}
                  </div>

                  <ButtonGroup className="divide-x flex-1">
                    <Button
                      variant="secondary"
                      className="w-full"
                      size="sm"
                      onClick={handleBrowseAsset}
                    >
                      Browse
                    </Button>

                    {iconFields.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label="More Options"
                          >
                            <Icon name="database" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            {iconFields.map((field) => (
                              <DropdownMenuItem
                                key={field.id}
                                onClick={() => handleFieldSelect(field.id)}
                              >
                                {field.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </ButtonGroup>
                </>
              )}

              {(selectedField || currentFieldId) && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 justify-start"
                >
                  <Icon name="database" />
                  <span>
                    {iconFields.find(f => f.id === (selectedField || currentFieldId))?.name || 'Field'}
                  </span>
                  <Button
                    className="!size-5 !p-0 -mr-1 ml-auto"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedField(null);
                      if (layer) {
                        onLayerUpdate(layer.id, {
                          variables: {
                            ...layer.variables,
                            icon: {
                              src: undefined as any,
                            },
                          },
                        });
                      }
                    }}
                  >
                    <Icon name="x" className="size-2.5" />
                  </Button>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </SettingsPanel>
  );
}
