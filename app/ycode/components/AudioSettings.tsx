'use client';

/**
 * Audio Settings Component
 *
 * Settings panel for audio layers with file manager integration
 */

import React, { useState, useCallback } from 'react';

import { Label } from '@/components/ui/label';
import SettingsPanel from './SettingsPanel';
import type { Layer, CollectionField, Collection } from '@/types';
import { createAssetVariable, isAssetVariable, getAssetId, isFieldVariable } from '@/lib/variable-utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
import { getDefaultAssetByType, ASSET_CATEGORIES, isAssetOfType } from '@/lib/asset-utils';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';
import { Slider } from '@/components/ui/slider';

interface AudioSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  fields?: CollectionField[];
  fieldSourceLabel?: string;
  allFields?: Record<string, CollectionField[]>;
  collections?: Collection[];
}

export default function AudioSettings({ layer, onLayerUpdate, fields, fieldSourceLabel, allFields, collections }: AudioSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Initialize selectedField from current field variable if it exists
  const audioSrc = layer?.variables?.audio?.src;
  const initialFieldId = audioSrc && isFieldVariable(audioSrc) && 'data' in audioSrc && 'field_id' in audioSrc.data
    ? audioSrc.data.field_id
    : null;
  const [selectedField, setSelectedField] = useState<string | null>(initialFieldId);

  const openFileManager = useEditorStore((state) => state.openFileManager);
  const getAsset = useAssetsStore((state) => state.getAsset);

  const handleAudioChange = useCallback((assetId: string) => {
    if (!layer) return;

    // Create AssetVariable from asset ID
    const assetVariable = createAssetVariable(assetId);

    // Update layer with AssetVariable
    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        audio: {
          src: assetVariable,
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
        audio: {
          src: fieldVariable,
        },
      },
    });

    setSelectedField(fieldId);
  }, [layer, onLayerUpdate]);

  const handleBrowseAudio = useCallback(() => {
    // Get current asset ID if it exists
    const currentAssetId = (() => {
      const src = layer?.variables?.audio?.src;
      if (isAssetVariable(src)) {
        return getAssetId(src);
      }
      return null;
    })();

    openFileManager(
      (asset) => {
        if (!layer) return false;

        // Validate asset type
        if (!asset.mime_type || !isAssetOfType(asset.mime_type, ASSET_CATEGORIES.AUDIO)) {
          toast.error('Invalid asset type', {
            description: 'Please select an audio file.',
          });
          return false; // Don't close file manager
        }

        handleAudioChange(asset.id);
      },
      currentAssetId
    );
  }, [openFileManager, handleAudioChange, layer]);

  // Get current volume value (0-100)
  const volume = layer?.attributes?.volume ? parseInt(layer.attributes.volume) : 100;

  const handleVolumeChange = useCallback((value: number[]) => {
    if (!layer) return;

    onLayerUpdate(layer.id, {
      attributes: {
        ...layer.attributes,
        volume: value[0].toString(),
      },
    });
  }, [layer, onLayerUpdate]);

  // Get current muted state
  const isMuted = layer?.attributes?.muted === true;

  const handleMutedChange = useCallback((checked: boolean) => {
    if (!layer) return;

    onLayerUpdate(layer.id, {
      attributes: {
        ...layer.attributes,
        muted: checked,
      },
    });
  }, [layer, onLayerUpdate]);

  // Get current controls state
  const hasControls = layer?.attributes?.controls === true;

  const handleControlsChange = useCallback((checked: boolean) => {
    if (!layer) return;

    onLayerUpdate(layer.id, {
      attributes: {
        ...layer.attributes,
        controls: checked,
      },
    });
  }, [layer, onLayerUpdate]);

  // Get current loop state
  const isLoop = layer?.attributes?.loop === true;

  const handleLoopChange = useCallback((checked: boolean) => {
    if (!layer) return;

    onLayerUpdate(layer.id, {
      attributes: {
        ...layer.attributes,
        loop: checked,
      },
    });
  }, [layer, onLayerUpdate]);

  // Only show for audio layers
  if (!layer || layer.name !== 'audio') {
    return null;
  }

  // Check if current src is a field variable
  const isFieldVariableSrc = audioSrc ? isFieldVariable(audioSrc) : false;
  const currentFieldId = isFieldVariableSrc && audioSrc && 'data' in audioSrc && 'field_id' in audioSrc.data
    ? audioSrc.data.field_id
    : null;

  // Get audio fields (image type fields can store any asset including audio)
  const audioFields = fields?.filter(f => f.type === 'image') || [];

  return (
    <SettingsPanel
      title="Audio"
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
                    <Icon name="audio" className="size-4 text-muted-foreground" />
                  </div>

                  <ButtonGroup className="divide-x flex-1">
                    <Button
                      variant="secondary"
                      className="w-full"
                      size="sm"
                      onClick={handleBrowseAudio}
                    >
                      Browse
                    </Button>

                    {audioFields.length > 0 && (
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
                            {audioFields.map((field) => (
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
                    {audioFields.find(f => f.id === (selectedField || currentFieldId))?.name || 'Field'}
                  </span>
                  <Button
                    className="!size-5 !p-0 -mr-1 ml-auto"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedField(null);
                      // Clear field variable and reset to asset
                      if (layer) {
                        onLayerUpdate(layer.id, {
                          variables: {
                            ...layer.variables,
                            audio: {
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

        {/* Volume Slider */}
        <div className="grid grid-cols-3 gap-2">
          <div className="pt-0.5">
            <Label variant="muted">Volume</Label>
          </div>

          <div className="col-span-2 flex items-center gap-3">
            <Slider
              value={[volume]}
              onValueChange={handleVolumeChange}
              min={0}
              max={100}
              step={1}
              className="flex-1"
            />
          </div>
        </div>

        {/* Behavior Section */}
        <div className="grid grid-cols-3 items-start gap-2">
          <div className="pt-0.5">
            <Label variant="muted">Behavior</Label>
          </div>

          <div className="col-span-2 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="audio-controls"
                checked={hasControls}
                onCheckedChange={handleControlsChange}
              />
              <Label
                variant="muted"
                htmlFor="audio-controls"
                className="cursor-pointer"
              >
                Display controls
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="audio-loop"
                checked={isLoop}
                onCheckedChange={handleLoopChange}
              />
              <Label
                variant="muted"
                htmlFor="audio-loop"
                className="cursor-pointer"
              >
                Loop audio
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="audio-muted"
                checked={isMuted}
                onCheckedChange={handleMutedChange}
              />
              <Label
                variant="muted"
                htmlFor="audio-muted"
                className="cursor-pointer"
              >
                Mute sound
              </Label>
            </div>
          </div>
        </div>
      </div>
    </SettingsPanel>
  );
}
