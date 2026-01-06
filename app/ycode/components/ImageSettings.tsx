/* eslint-disable @next/next/no-img-element */
'use client';

/**
 * Image Settings Component
 *
 * Settings panel for image layers (URL and alt text)
 */

import React, { useState, useCallback } from 'react';

import { Label } from '@/components/ui/label';
import SettingsPanel from './SettingsPanel';
import InputWithInlineVariables from './InputWithInlineVariables';
import { convertContentToValue } from '@/lib/cms-variables-utils';
import type { Layer, CollectionField, Collection } from '@/types';
import { createDynamicTextVariable, getDynamicTextContent, getVariableStringValue } from '@/lib/variable-utils';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ButtonGroup } from '@/components/ui/button-group';
import {
  DropdownMenu,
  DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { useEditorStore } from '@/stores/useEditorStore';
import { getDefaultAssetByType, ASSET_CATEGORIES } from '@/lib/asset-utils';

interface ImageSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  fields?: CollectionField[];
  fieldSourceLabel?: string;
  allFields?: Record<string, CollectionField[]>;
  collections?: Collection[];
}

export default function ImageSettings({ layer, onLayerUpdate, fields, fieldSourceLabel, allFields, collections }: ImageSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const openFileManager = useEditorStore((state) => state.openFileManager);

  const handleUrlChange = useCallback((value: string) => {
    if (!layer) return;

    // Convert the value to proper format (string with embedded variables)
    const convertedValue = convertContentToValue(value);

    // Create DynamicTextVariable from the content
    const srcVariable = createDynamicTextVariable(convertedValue);

    // Update variables.image.src
    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        image: {
          src: srcVariable,
          alt: layer.variables?.image?.alt || createDynamicTextVariable(''),
        },
      },
    });
  }, [layer, onLayerUpdate]);

  const handleAltChange = useCallback((value: string) => {
    if (!layer) return;

    // Convert content format to value - extract text content
    const convertedValue = convertContentToValue(value);

    // Create DynamicTextVariable from the content
    const altVariable = createDynamicTextVariable(convertedValue);

    // Update variables.image.alt
    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        image: {
          ...layer.variables?.image,
          src: layer.variables?.image?.src || createDynamicTextVariable(''),
          alt: altVariable,
        },
      },
    });
  }, [layer, onLayerUpdate]);

  const handleWidthChange = useCallback((value: string) => {
    if (!layer) return;

    const newAttributes = { ...layer.attributes };

    if (value) {
      newAttributes.width = value;
    } else {
      delete newAttributes.width;
    }

    onLayerUpdate(layer.id, {
      attributes: newAttributes,
    });
  }, [layer, onLayerUpdate]);

  const handleHeightChange = useCallback((value: string) => {
    if (!layer) return;

    const newAttributes = { ...layer.attributes };

    if (value) {
      newAttributes.height = value;
    } else {
      delete newAttributes.height;
    }

    onLayerUpdate(layer.id, {
      attributes: newAttributes,
    });
  }, [layer, onLayerUpdate]);

  const handleLazyChange = useCallback((checked: boolean) => {
    if (!layer) return;

    onLayerUpdate(layer.id, {
      attributes: {
        ...layer.attributes,
        loading: checked ? 'lazy' : 'eager',
      },
    });
  }, [layer, onLayerUpdate]);

  // Only show for image layers
  if (!layer || layer.name !== 'image') {
    return null;
  }

  // Get current URL value from variables.image.src
  const urlValue = (() => {
    const src = layer.variables?.image?.src;
    if (!src) return '';

    // Extract content from the variable
    return getVariableStringValue(src);
  })();

  // Get current alt value from variables.image.alt
  const altValue = getDynamicTextContent(layer.variables?.image?.alt);

  // Get current width, height, and lazy values from attributes
  const widthValue = (layer.attributes?.width as string) || '';
  const heightValue = (layer.attributes?.height as string) || '';
  const lazyValue = layer.attributes?.loading === 'lazy';

  // Placeholder fields for UI (just for display purposes)
  const placeholderFields: CollectionField[] = [
    {
      id: 'placeholder-1',
      name: 'Alt Text',
      key: null,
      type: 'text',
      default: null,
      fillable: true,
      order: 0,
      collection_id: 'placeholder',
      reference_collection_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      hidden: false,
      data: {},
      is_published: true,
    },
    {
      id: 'placeholder-2',
      name: 'Description',
      key: null,
      type: 'text',
      default: null,
      fillable: true,
      order: 1,
      collection_id: 'placeholder',
      reference_collection_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      hidden: false,
      data: {},
      is_published: true,
    },
    {
      id: 'placeholder-3',
      name: 'Title',
      key: null,
      type: 'text',
      default: null,
      fillable: true,
      order: 2,
      collection_id: 'placeholder',
      reference_collection_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      hidden: false,
      data: {},
      is_published: true,
    },
  ];

  return (
    <>
      <SettingsPanel
        title="Image"
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3">
            <Label variant="muted">Image</Label>

            <div className="col-span-2 flex">
              {!selectedField && (
                <div className="flex-1 flex gap-2">
                  <div className="bg-input rounded-lg h-8 flex-1 overflow-hidden">
                    <img
                      src={urlValue || getDefaultAssetByType(ASSET_CATEGORIES.IMAGES)}
                      className="w-full h-full object-contain"
                      alt="Image preview"
                    />
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <ButtonGroup className="divide-x">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          openFileManager((asset) => {
                            if (!layer) return;
                            handleUrlChange(asset.public_url);
                          });
                        }}
                      >
                        Browse
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="secondary" size="sm"
                            aria-label="More Options"
                          >
                            <Icon name="database" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end">
                          <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => setSelectedField('Name')}>
                              Name
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSelectedField('Slug')}>
                              Slug
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </ButtonGroup>
                  </div>
                </div>
              )}

              {selectedField && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 justify-start"
                >
                  <Icon name="database" />
                  <span>{selectedField}</span>
                  <Button
                    className="!size-5 !p-0 -mr-1 ml-auto"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedField(null);
                    }}
                  >
                    <Icon name="x" className="size-2.5" />
                  </Button>
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3">
            <Label variant="muted">ALT</Label>

            <div className="col-span-2 *:w-full">
              <InputWithInlineVariables
                value={altValue}
                onChange={handleAltChange}
                placeholder="Image description"
                fields={placeholderFields}
                fieldSourceLabel="Fields"
                allFields={allFields}
                collections={collections}
              />
            </div>
          </div>

          <div className="grid grid-cols-3">
            <Label variant="muted">Size</Label>

            <div className="col-span-2 *:w-full grid grid-cols-2 gap-2">
              <InputGroup>
                <InputGroupAddon>
                  <div className="flex">
                    <Tooltip>
                      <TooltipTrigger>
                        <Icon name="maxSize" className="size-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Width</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </InputGroupAddon>
                <InputGroupInput
                  type="number"
                  value={widthValue}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  placeholder="Auto"
                />
              </InputGroup>
              <InputGroup>
                <InputGroupAddon>
                  <div className="flex">
                    <Tooltip>
                      <TooltipTrigger>
                        <Icon name="maxSize" className="size-3 rotate-90" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Height</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </InputGroupAddon>
                <InputGroupInput
                  type="number"
                  value={heightValue}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  placeholder="Auto"
                />
              </InputGroup>
            </div>
          </div>

          <div className="grid grid-cols-3">
            <Label variant="muted" htmlFor="image-lazy">
              Lazy load
            </Label>
            <div className="col-span-2 py-2">
              <Switch
                id="image-lazy"
                checked={lazyValue}
                onCheckedChange={handleLazyChange}
              />
            </div>
          </div>
        </div>
      </SettingsPanel>
    </>
  );
}
