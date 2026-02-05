/* eslint-disable @next/next/no-img-element */
'use client';

/**
 * Image Settings Component
 *
 * Settings panel for image layers (URL and alt text).
 * Can also be used in standalone mode for just image source selection.
 */

import React, { useState, useCallback, useMemo } from 'react';

import { Label } from '@/components/ui/label';
import SettingsPanel from './SettingsPanel';
import RichTextEditor from './RichTextEditor';
import type { FieldGroup } from './FieldTreeSelect';
import type { Layer, CollectionField, Collection, AssetVariable, DynamicTextVariable, FieldVariable, ImageSettingsValue } from '@/types';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEditorStore } from '@/stores/useEditorStore';
import { useAssetsStore } from '@/stores/useAssetsStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { DEFAULT_ASSETS, ASSET_CATEGORIES, isAssetOfType } from '@/lib/asset-utils';
import { IMAGE_FIELD_TYPES, filterFieldGroupsByType, flattenFieldGroups, getFieldIcon } from '@/lib/collection-field-utils';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

// Image source variable type
export type ImageSourceVariable = AssetVariable | DynamicTextVariable | FieldVariable;

// Re-export ImageSettingsValue from types for convenience
export type { ImageSettingsValue } from '@/types';

// Layer mode props - for editing image layers
interface LayerModeProps {
  mode?: 'layer';
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  value?: never;
  onChange?: never;
}

// Standalone mode props - for complete image settings
interface StandaloneModeProps {
  mode: 'standalone';
  value: ImageSettingsValue | undefined;
  onChange: (value: ImageSettingsValue) => void;
  layer?: never;
  onLayerUpdate?: never;
}

// Common props for both modes
interface CommonProps {
  /** Field groups with labels and sources for inline variable selection */
  fieldGroups?: FieldGroup[];
  allFields?: Record<string, CollectionField[]>;
  collections?: Collection[];
  onOpenVariablesDialog?: () => void;
}

type ImageSettingsProps = (LayerModeProps | StandaloneModeProps) & CommonProps;

export default function ImageSettings(props: ImageSettingsProps) {
  const { fieldGroups, allFields, collections, onOpenVariablesDialog } = props;
  const isStandaloneMode = props.mode === 'standalone';

  // Layer mode props
  const layer = isStandaloneMode ? null : props.layer;
  const onLayerUpdate = isStandaloneMode ? undefined : props.onLayerUpdate;

  // Standalone mode props
  const standaloneValue = isStandaloneMode ? props.value : undefined;
  const standaloneOnChange = isStandaloneMode ? props.onChange : undefined;
  const [isOpen, setIsOpen] = useState(true);
  const [selectedField, setSelectedField] = useState<string | null>(null);
  const openFileManager = useEditorStore((state) => state.openFileManager);
  const editingComponentId = useEditorStore((state) => state.editingComponentId);
  const getAsset = useAssetsStore((state) => state.getAsset);
  const getComponentById = useComponentsStore((state) => state.getComponentById);

  // Get component variables for image linking (when editing a component in layer mode)
  const editingComponent = !isStandaloneMode && editingComponentId ? getComponentById(editingComponentId) : undefined;
  const componentVariables = editingComponent?.variables || [];
  // Filter to only image-type variables
  const imageComponentVariables = componentVariables.filter(v => v.type === 'image');

  // Get image source variable - from layer or standalone value
  const imageSrc = isStandaloneMode ? standaloneValue?.src : layer?.variables?.image?.src;

  // Get linked image variable ID from layer (stored in src.id)
  const linkedImageVariableId = !isStandaloneMode && imageSrc ? (imageSrc as any).id : undefined;
  const linkedImageVariable = imageComponentVariables.find(v => v.id === linkedImageVariableId);

  // Get effective image source - use variable's default value when linked
  const linkedVariableDefaultValue = linkedImageVariable?.default_value as ImageSettingsValue | undefined;
  const effectiveImageSrc = linkedImageVariable ? linkedVariableDefaultValue?.src : imageSrc;

  // Filter fields to only show image-bindable field types (image or text for URL)
  const imageFields = useMemo(() => {
    const filtered = filterFieldGroupsByType(fieldGroups, IMAGE_FIELD_TYPES);
    return flattenFieldGroups(filtered);
  }, [fieldGroups]);

  // Detect current field ID if using FieldVariable
  const currentFieldId = useMemo(() => {
    if (effectiveImageSrc && isFieldVariable(effectiveImageSrc)) {
      return effectiveImageSrc.data.field_id;
    }
    return null;
  }, [effectiveImageSrc]);

  // Detect current image type from src variable (use effective source for display)
  const imageType = useMemo((): 'upload' | 'custom_url' | 'cms' => {
    if (!effectiveImageSrc) return 'upload';
    if (effectiveImageSrc.type === 'field') return 'cms';
    if (isDynamicTextVariable(effectiveImageSrc)) return 'custom_url';
    return 'upload';
  }, [effectiveImageSrc]);

  // Get custom URL value from DynamicTextVariable
  const customUrlValue = useMemo(() => {
    if (effectiveImageSrc && isDynamicTextVariable(effectiveImageSrc)) {
      return getDynamicTextContent(effectiveImageSrc);
    }
    return '';
  }, [effectiveImageSrc]);

  // Helper to update standalone value
  const updateStandaloneValue = useCallback((updates: Partial<ImageSettingsValue>) => {
    if (standaloneOnChange) {
      standaloneOnChange({ ...standaloneValue, ...updates });
    }
  }, [standaloneOnChange, standaloneValue]);

  // Helper to update image source (works in both modes)
  const updateImageSrc = useCallback((newSrc: ImageSourceVariable) => {
    if (isStandaloneMode) {
      updateStandaloneValue({ src: newSrc });
    } else if (layer && onLayerUpdate) {
      onLayerUpdate(layer.id, {
        variables: {
          ...layer.variables,
          image: {
            src: newSrc,
            alt: layer.variables?.image?.alt || createDynamicTextVariable(''),
          },
        },
      });
    }
  }, [isStandaloneMode, updateStandaloneValue, layer, onLayerUpdate]);

  const handleImageChange = useCallback((assetId: string) => {
    const assetVariable = createAssetVariable(assetId);
    updateImageSrc(assetVariable);
  }, [updateImageSrc]);

  const handleFieldSelect = useCallback((fieldId: string) => {
    const field = imageFields.find(f => f.id === fieldId);
    const fieldVariable: FieldVariable = {
      type: 'field',
      data: {
        field_id: fieldId,
        relationships: [],
        field_type: field?.type || null,
      },
    };
    updateImageSrc(fieldVariable);
    setSelectedField(fieldId);
  }, [updateImageSrc, imageFields]);

  const handleTypeChange = useCallback((type: 'upload' | 'custom_url' | 'cms') => {
    if (type === 'custom_url') {
      updateImageSrc(createDynamicTextVariable(''));
    } else if (type === 'cms') {
      const fieldVariable: FieldVariable = {
        type: 'field',
        data: {
          field_id: null,
          relationships: [],
          field_type: null,
        },
      };
      updateImageSrc(fieldVariable);
      setSelectedField(null);
    } else {
      updateImageSrc(createAssetVariable(''));
      setSelectedField(null);
    }
  }, [updateImageSrc]);

  const handleUrlChange = useCallback((value: string) => {
    updateImageSrc(createDynamicTextVariable(value));
  }, [updateImageSrc]);

  // Handle linking image to a component variable
  const handleLinkImageVariable = useCallback((variableId: string) => {
    if (!layer || !onLayerUpdate) return;

    const currentSrc = layer.variables?.image?.src;

    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        image: {
          ...layer.variables?.image,
          src: currentSrc
            ? { ...currentSrc, id: variableId } as any
            : { type: 'asset', id: variableId, data: { asset_id: null } } as any,
          alt: layer.variables?.image?.alt || createDynamicTextVariable(''),
        },
      },
    });
  }, [layer, onLayerUpdate]);

  // Handle unlinking image from a component variable
  const handleUnlinkImageVariable = useCallback(() => {
    if (!layer || !onLayerUpdate) return;

    const currentSrc = layer.variables?.image?.src;

    if (currentSrc) {
      // Remove the variable ID from src
      const { id: _, ...srcWithoutId } = currentSrc as any;

      onLayerUpdate(layer.id, {
        variables: {
          ...layer.variables,
          image: {
            ...layer.variables?.image,
            src: srcWithoutId,
            alt: layer.variables?.image?.alt || createDynamicTextVariable(''),
          },
        },
      });
    }
  }, [layer, onLayerUpdate]);

  const handleAltChange = useCallback((value: string) => {
    const altVariable = createDynamicTextVariable(value);

    if (isStandaloneMode) {
      updateStandaloneValue({ alt: altVariable });
    } else if (layer && onLayerUpdate) {
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
    }
  }, [isStandaloneMode, updateStandaloneValue, layer, onLayerUpdate]);

  const handleWidthChange = useCallback((value: string) => {
    if (isStandaloneMode) {
      updateStandaloneValue({ width: value || undefined });
    } else if (layer && onLayerUpdate) {
      const newAttributes = { ...layer.attributes };
      if (value) {
        newAttributes.width = value;
      } else {
        delete newAttributes.width;
      }
      onLayerUpdate(layer.id, { attributes: newAttributes });
    }
  }, [isStandaloneMode, updateStandaloneValue, layer, onLayerUpdate]);

  const handleHeightChange = useCallback((value: string) => {
    if (isStandaloneMode) {
      updateStandaloneValue({ height: value || undefined });
    } else if (layer && onLayerUpdate) {
      const newAttributes = { ...layer.attributes };
      if (value) {
        newAttributes.height = value;
      } else {
        delete newAttributes.height;
      }
      onLayerUpdate(layer.id, { attributes: newAttributes });
    }
  }, [isStandaloneMode, updateStandaloneValue, layer, onLayerUpdate]);

  const handleLazyChange = useCallback((checked: boolean) => {
    if (isStandaloneMode) {
      updateStandaloneValue({ loading: checked ? 'lazy' : 'eager' });
    } else if (layer && onLayerUpdate) {
      onLayerUpdate(layer.id, {
        attributes: {
          ...layer.attributes,
          loading: checked ? 'lazy' : 'eager',
        },
      });
    }
  }, [isStandaloneMode, updateStandaloneValue, layer, onLayerUpdate]);

  // In layer mode, only show for image layers
  if (!isStandaloneMode && (!layer || layer.name !== 'image')) {
    return null;
  }

  // Get current URL value from variables.image.src (use effective source for display)
  const urlValue = (() => {
    const url = getImageUrlFromVariable(effectiveImageSrc, getAsset);
    return url && url.trim() !== '' ? url : DEFAULT_ASSETS.IMAGE;
  })();

  // Get values from layer or standalone value
  const altValue = isStandaloneMode
    ? getDynamicTextContent(standaloneValue?.alt)
    : getDynamicTextContent(layer?.variables?.image?.alt);
  const widthValue = isStandaloneMode
    ? (standaloneValue?.width || '')
    : ((layer?.attributes?.width as string) || '');
  const heightValue = isStandaloneMode
    ? (standaloneValue?.height || '')
    : ((layer?.attributes?.height as string) || '');
  const lazyValue = isStandaloneMode
    ? (standaloneValue?.loading === 'lazy')
    : (layer?.attributes?.loading === 'lazy');

  // Shared source picker content
  const sourcePickerContent = (
    <div className="flex flex-col gap-2.5">
      {/* Source Section */}
      <div className={isStandaloneMode ? '' : 'grid grid-cols-3 items-center'}>
        {!isStandaloneMode && (
          <div className="flex items-start gap-1 py-1">
            {editingComponentId ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="variable"
                    size="xs"
                    className="has-[>svg]:px-0"
                  >
                    <Icon name="plus-circle-solid" />
                    Source
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {imageComponentVariables.length > 0 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Link to variable</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          {imageComponentVariables.map((variable) => (
                            <DropdownMenuItem
                              key={variable.id}
                              onClick={() => handleLinkImageVariable(variable.id)}
                            >
                              {variable.name}
                              {linkedImageVariableId === variable.id && (
                                <Icon name="check" className="ml-auto size-3" />
                              )}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                  )}
                  {onOpenVariablesDialog && (
                    <DropdownMenuItem onClick={onOpenVariablesDialog}>
                      Manage variables
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Label variant="muted">Source</Label>
            )}
          </div>
        )}

        <div className={isStandaloneMode ? '' : 'col-span-2'}>
          {linkedImageVariable ? (
            <Button
              asChild
              variant="purple"
              className="!justify-between w-full"
              onClick={handleUnlinkImageVariable}
            >
              <div>
                <span>{linkedImageVariable.name}</span>
                <Button
                  className="!size-4 !p-0"
                  variant="outline"
                >
                  <Icon name="x" className="size-2" />
                </Button>
              </div>
            </Button>
          ) : (
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
          )}
        </div>
      </div>

      {/* File Manager Upload - hidden when linked to variable */}
      {!linkedImageVariable && imageType === 'upload' && (() => {
        // Get current asset ID and asset for display
        const currentAssetId = (() => {
          if (isAssetVariable(imageSrc)) {
            return getAssetId(imageSrc);
          }
          return null;
        })();

        const currentAsset = currentAssetId ? getAsset(currentAssetId) : null;
        const assetFilename = currentAsset?.filename || null;

        // Handler to open file manager
        const handleOpenFileManager = () => {
          openFileManager(
            (asset) => {
              // Validate asset type - allow both images and icons (SVGs)
              const isImage = asset.mime_type && isAssetOfType(asset.mime_type, ASSET_CATEGORIES.IMAGES);
              const isSvg = asset.mime_type && isAssetOfType(asset.mime_type, ASSET_CATEGORIES.ICONS);
              
              if (!isImage && !isSvg) {
                toast.error('Invalid asset type', {
                  description: 'Please select an image or SVG file.',
                });
                return false; // Don't close file manager
              }

              handleImageChange(asset.id);
            },
            currentAssetId,
            // Show both images and icons (SVGs)
            [ASSET_CATEGORIES.IMAGES, ASSET_CATEGORIES.ICONS]
          );
        };

        return (
          <div className={isStandaloneMode ? '' : 'grid grid-cols-3 items-start'}>
            {!isStandaloneMode && <Label variant="muted" className="pt-2">File</Label>}

            <div className={isStandaloneMode ? '' : 'col-span-2'}>
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

      {/* Custom URL Section - hidden when linked to variable */}
      {!linkedImageVariable && imageType === 'custom_url' && (
        <div className={isStandaloneMode ? '' : 'grid grid-cols-3 items-start'}>
          {!isStandaloneMode && <Label variant="muted" className="pt-2">URL</Label>}

          <div className={isStandaloneMode ? '' : 'col-span-2'}>
            <RichTextEditor
              value={customUrlValue}
              onChange={handleUrlChange}
              placeholder="https://example.com/image.jpg"
              fieldGroups={fieldGroups}
              allFields={allFields}
              collections={collections}
            />
          </div>
        </div>
      )}

      {/* CMS Field Section - hidden when linked to variable */}
      {!linkedImageVariable && imageType === 'cms' && (
        <div className={isStandaloneMode ? '' : 'grid grid-cols-3 items-center'}>
          {!isStandaloneMode && <Label variant="muted">Field</Label>}

          <div className={isStandaloneMode ? 'w-full' : 'col-span-2 w-full'}>
            <Select
              value={selectedField || currentFieldId || ''}
              onValueChange={handleFieldSelect}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a field" />
              </SelectTrigger>
              <SelectContent>
                {imageFields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    <span className="flex items-center gap-2">
                      <Icon name={getFieldIcon(field.type)} className="size-3 text-muted-foreground shrink-0" />
                      {field.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );

  // Additional fields content (alt, size, behavior)
  const additionalFieldsContent = (
    <>
      <div className={isStandaloneMode ? 'mt-2.5' : 'grid grid-cols-3'}>
        {!isStandaloneMode && <Label variant="muted">ALT</Label>}
        {isStandaloneMode && <Label variant="muted" className="mb-1.5">ALT</Label>}

        <div className={isStandaloneMode ? '' : 'col-span-2 *:w-full'}>
          <RichTextEditor
            value={altValue}
            onChange={handleAltChange}
            placeholder="Image description"
            fieldGroups={fieldGroups}
            allFields={allFields}
            collections={collections}
          />
        </div>
      </div>

      <div className={isStandaloneMode ? 'mt-2.5' : 'grid grid-cols-3'}>
        {!isStandaloneMode && <Label variant="muted">Size</Label>}
        {isStandaloneMode && <Label variant="muted" className="mb-1.5">Size</Label>}

        <div className={isStandaloneMode ? 'grid grid-cols-2 gap-2' : 'col-span-2 *:w-full grid grid-cols-2 gap-2'}>
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
      <div className={isStandaloneMode ? 'mt-2.5' : 'grid grid-cols-3 gap-2'}>
        {!isStandaloneMode && (
          <div className="pt-0.5">
            <Label variant="muted">Behavior</Label>
          </div>
        )}
        {isStandaloneMode && <Label variant="muted" className="mb-1.5">Behavior</Label>}

        <div className={isStandaloneMode ? 'flex flex-col gap-3' : 'col-span-2 flex flex-col gap-3'}>
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
    </>
  );

  // Standalone mode - return source picker + additional fields
  if (isStandaloneMode) {
    return (
      <div className="flex flex-col">
        {sourcePickerContent}
        {additionalFieldsContent}
      </div>
    );
  }

  // Layer mode - return full settings panel
  // Hide additional fields when linked to a variable (settings are managed in ComponentVariablesDialog)
  return (
    <>
      <SettingsPanel
        title="Image"
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        {sourcePickerContent}
        {!linkedImageVariable && additionalFieldsContent}
      </SettingsPanel>
    </>
  );
}
