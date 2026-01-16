/* eslint-disable @next/next/no-img-element */
'use client';

/**
 * Image Settings Component
 *
 * Settings panel for image layers (URL and alt text)
 */

import React, { useState, useCallback, useMemo } from 'react';

import { Label } from '@/components/ui/label';
import SettingsPanel from './SettingsPanel';
import InputWithInlineVariables from './InputWithInlineVariables';
import type { Layer, CollectionField, Collection } from '@/types';
import { createDynamicTextVariable, getDynamicTextContent, createAssetVariable, getImageUrlFromVariable, isAssetVariable, getAssetId, isDynamicTextVariable, isFieldVariable } from '@/lib/variable-utils';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEditorStore } from '@/stores/useEditorStore';
import { useAssetsStore } from '@/stores/useAssetsStore';
import { DEFAULT_ASSETS, ASSET_CATEGORIES, isAssetOfType } from '@/lib/asset-utils';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

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
  const getAsset = useAssetsStore((state) => state.getAsset);

  // Get image source variable
  const imageSrc = layer?.variables?.image?.src;

  // Filter fields to only show image/asset type fields
  // Note: Currently using 'text' type fields as image fields don't have a dedicated type
  const imageFields = useMemo(() => {
    if (!fields) return [];
    // For now, show all text fields that could contain image URLs or asset IDs
    return fields.filter((field) => field.type === 'text');
  }, [fields]);

  // Detect current field ID if using FieldVariable
  const currentFieldId = useMemo(() => {
    if (imageSrc && isFieldVariable(imageSrc)) {
      return imageSrc.data.field_id;
    }
    return null;
  }, [imageSrc]);

  // Detect current image type from src variable
  const imageType = useMemo((): 'upload' | 'custom_url' | 'cms' => {
    if (!imageSrc) return 'upload';
    if (imageSrc.type === 'field') return 'cms';
    if (isDynamicTextVariable(imageSrc)) return 'custom_url';
    return 'upload';
  }, [imageSrc]);

  // Get custom URL value from DynamicTextVariable
  const customUrlValue = useMemo(() => {
    if (imageSrc && isDynamicTextVariable(imageSrc)) {
      return getDynamicTextContent(imageSrc);
    }
    return '';
  }, [imageSrc]);

  const handleImageChange = useCallback((assetId: string) => {
    if (!layer) return;

    // Create AssetVariable from asset ID
    const assetVariable = createAssetVariable(assetId);

    // Update layer with AssetVariable
    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        image: {
          src: assetVariable,
          alt: layer.variables?.image?.alt || createDynamicTextVariable(''),
        },
      },
    });
  }, [layer, onLayerUpdate]);

  const handleFieldSelect = useCallback((fieldId: string) => {
    if (!layer) return;

    // Create FieldVariable from field ID
    const fieldVariable: { type: 'field'; data: { field_id: string; relationships: string[] } } = {
      type: 'field',
      data: {
        field_id: fieldId,
        relationships: [],
      },
    };

    // Update layer with FieldVariable
    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        image: {
          src: fieldVariable,
          alt: layer.variables?.image?.alt || createDynamicTextVariable(''),
        },
      },
    });

    setSelectedField(fieldId);
  }, [layer, onLayerUpdate]);

  const handleTypeChange = useCallback((type: 'upload' | 'custom_url' | 'cms') => {
    if (!layer) return;

    if (type === 'custom_url') {
      // Switch to Custom URL - create DynamicTextVariable
      const urlVariable = createDynamicTextVariable('');

      onLayerUpdate(layer.id, {
        variables: {
          ...layer.variables,
          image: {
            src: urlVariable,
            alt: layer.variables?.image?.alt || createDynamicTextVariable(''),
          },
        },
      });
    } else if (type === 'cms') {
      // Switch to CMS - create empty AssetVariable as placeholder
      const placeholderVariable = createAssetVariable('');
      onLayerUpdate(layer.id, {
        variables: {
          ...layer.variables,
          image: {
            src: placeholderVariable,
            alt: layer.variables?.image?.alt || createDynamicTextVariable(''),
          },
        },
      });
      setSelectedField(null);
    } else {
      // Switch to Upload - create empty AssetVariable as placeholder
      const placeholderVariable = createAssetVariable('');
      onLayerUpdate(layer.id, {
        variables: {
          ...layer.variables,
          image: {
            src: placeholderVariable,
            alt: layer.variables?.image?.alt || createDynamicTextVariable(''),
          },
        },
      });
      setSelectedField(null);
    }
  }, [layer, onLayerUpdate]);

  const handleUrlChange = useCallback((value: string) => {
    if (!layer) return;

    // Value is already a string from InputWithInlineVariables (already converted from Tiptap JSON)
    // Create DynamicTextVariable directly from the string value
    const srcVariable = createDynamicTextVariable(value);

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

    // Value is already a string from InputWithInlineVariables (already converted from Tiptap JSON)
    // Create DynamicTextVariable directly from the string value
    const altVariable = createDynamicTextVariable(value);

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
    const url = getImageUrlFromVariable(
      layer.variables?.image?.src,
      getAsset
    );
    // Return default image if URL is empty or invalid
    return url && url.trim() !== '' ? url : DEFAULT_ASSETS.IMAGE;
  })();

  // Get current alt value from variables.image.alt
  const altValue = getDynamicTextContent(layer.variables?.image?.alt);

  // Get current width, height, and lazy values from attributes
  const widthValue = (layer.attributes?.width as string) || '';
  const heightValue = (layer.attributes?.height as string) || '';
  const lazyValue = layer.attributes?.loading === 'lazy';

  return (
    <>
      <SettingsPanel
        title="Image"
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-col gap-2.5">
          {/* Source Section */}
          <div className="grid grid-cols-3 items-center">
            <Label variant="muted">Source</Label>

            <div className="col-span-2">
              <Select value={imageType} onValueChange={handleTypeChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upload"><Icon name="folder" className="size-3" /> File manager</SelectItem>
                  <SelectItem value="custom_url"><Icon name="link" className="size-3" /> Custom URL</SelectItem>
                  <SelectItem value="cms" disabled={imageFields.length === 0}><Icon name="database" className="size-3" /> CMS field</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File Manager Upload */}
          {imageType === 'upload' && (() => {
            // Get current asset ID and asset for display
            const currentAssetId = (() => {
              const src = layer.variables?.image?.src;
              if (isAssetVariable(src)) {
                return getAssetId(src);
              }
              return null;
            })();

            const currentAsset = currentAssetId ? getAsset(currentAssetId) : null;
            const assetFilename = currentAsset?.filename || null;

            // Handler to open file manager
            const handleOpenFileManager = () => {
              openFileManager(
                (asset) => {
                  if (!layer) return false;

                  // Validate asset type
                  if (!asset.mime_type || !isAssetOfType(asset.mime_type, ASSET_CATEGORIES.IMAGES)) {
                    toast.error('Invalid asset type', {
                      description: 'Please select an image file.',
                    });
                    return false; // Don't close file manager
                  }

                  handleImageChange(asset.id);
                },
                currentAssetId,
                ASSET_CATEGORIES.IMAGES
              );
            };

            return (
              <div className="grid grid-cols-3 items-start">
                <Label variant="muted" className="pt-2">File</Label>

                <div className="col-span-2">
                  <div
                    className="relative group bg-secondary/30 hover:bg-secondary/60 rounded-md w-full aspect-3/2 overflow-hidden cursor-pointer"
                    onClick={handleOpenFileManager}
                  >
                    {/* Checkerboard pattern for transparency */}
                    <div className="absolute inset-0 opacity-5 bg-checkerboard" />
                    <img
                      src={urlValue}
                      className="relative w-full h-full object-contain z-10"
                      alt="Image preview"
                    />

                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center px-2 py-1 opacity-0 group-hover:opacity-100 z-20">
                      <Button variant="overlay" size="sm">{assetFilename ? 'Change file' : 'Choose file'}</Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Custom URL Section */}
          {imageType === 'custom_url' && (
            <div className="grid grid-cols-3 items-start">
              <Label variant="muted" className="pt-2">URL</Label>

              <div className="col-span-2">
                <InputWithInlineVariables
                  value={customUrlValue}
                  onChange={handleUrlChange}
                  placeholder="https://example.com/image.jpg"
                  fields={fields}
                  fieldSourceLabel={fieldSourceLabel}
                  allFields={allFields}
                  collections={collections}
                />
              </div>
            </div>
          )}

          {/* CMS Field Section */}
          {imageType === 'cms' && (
            <div className="grid grid-cols-3 items-center">
              <Label variant="muted">Field</Label>

              <div className="col-span-2">
                <Select
                  value={selectedField || currentFieldId || ''}
                  onValueChange={handleFieldSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a field" />
                  </SelectTrigger>
                  <SelectContent>
                    {imageFields.map((field) => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3">
            <Label variant="muted">ALT</Label>

            <div className="col-span-2 *:w-full">
              <InputWithInlineVariables
                value={altValue}
                onChange={handleAltChange}
                placeholder="Image description"
                fields={fields}
                fieldSourceLabel={fieldSourceLabel}
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
                  stepper
                  value={widthValue}
                  onChange={(e) => handleWidthChange(e.target.value)}
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
                  stepper
                  value={heightValue}
                  onChange={(e) => handleHeightChange(e.target.value)}
                />
              </InputGroup>
            </div>
          </div>

          {/* Behavior Section */}
          <div className="grid grid-cols-3 gap-2">
            <div className="pt-0.5">
              <Label variant="muted">Behavior</Label>
            </div>

            <div className="col-span-2 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="image-lazy"
                  checked={lazyValue}
                  onCheckedChange={handleLazyChange}
                />
                <Label
                  variant="muted"
                  htmlFor="image-lazy"
                  className="cursor-pointer"
                >
                  Lazy load
                </Label>
              </div>
            </div>
          </div>
        </div>
      </SettingsPanel>
    </>
  );
}
