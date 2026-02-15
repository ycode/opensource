'use client';

/**
 * Audio Settings Component
 *
 * Settings panel for audio layers with file manager integration
 */

import React, { useState, useCallback, useMemo } from 'react';

import { Label } from '@/components/ui/label';
import SettingsPanel from './SettingsPanel';
import RichTextEditor from './RichTextEditor';
import { FieldSelectDropdown, type FieldGroup, type FieldSourceType } from './CollectionFieldSelector';
import type { Layer, CollectionField, Collection, FieldVariable } from '@/types';
import { createAssetVariable, createDynamicTextVariable, getDynamicTextContent, isAssetVariable, getAssetId, isFieldVariable, isDynamicTextVariable } from '@/lib/variable-utils';
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
import { ASSET_CATEGORIES, isAssetOfType } from '@/lib/asset-utils';
import { AUDIO_FIELD_TYPES, filterFieldGroupsByType, flattenFieldGroups } from '@/lib/collection-field-utils';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';
import { Slider } from '@/components/ui/slider';

interface AudioSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  /** Field groups with labels and sources for inline variable selection */
  fieldGroups?: FieldGroup[];
  allFields?: Record<string, CollectionField[]>;
  collections?: Collection[];
}

export default function AudioSettings({ layer, onLayerUpdate, fieldGroups, allFields, collections }: AudioSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Get audio source variable
  const audioSrc = layer?.variables?.audio?.src;

  // Initialize selectedField from current field variable if it exists
  const initialFieldId = audioSrc && isFieldVariable(audioSrc) && 'data' in audioSrc && 'field_id' in audioSrc.data
    ? audioSrc.data.field_id
    : null;
  const [selectedField, setSelectedField] = useState<string | null>(initialFieldId);

  const openFileManager = useEditorStore((state) => state.openFileManager);
  const getAsset = useAssetsStore((state) => state.getAsset);

  // Filter field groups to only show audio-bindable field types
  const audioFieldGroups = useMemo(() => {
    return filterFieldGroupsByType(fieldGroups, AUDIO_FIELD_TYPES, { excludeMultipleAsset: true });
  }, [fieldGroups]);

  // Flatten for internal lookups
  const audioFields = useMemo(() => {
    return flattenFieldGroups(audioFieldGroups);
  }, [audioFieldGroups]);

  // Detect current field ID if using FieldVariable
  const currentFieldId = useMemo(() => {
    if (audioSrc && isFieldVariable(audioSrc)) {
      return audioSrc.data.field_id;
    }
    return null;
  }, [audioSrc]);

  // Detect current audio type from src variable
  const audioType = useMemo((): 'upload' | 'custom_url' | 'cms' => {
    if (!audioSrc) return 'upload';
    if (audioSrc.type === 'field') return 'cms';
    if (isDynamicTextVariable(audioSrc)) return 'custom_url';
    return 'upload';
  }, [audioSrc]);

  // Get custom URL value from DynamicTextVariable
  const customUrlValue = useMemo(() => {
    if (audioSrc && isDynamicTextVariable(audioSrc)) {
      return getDynamicTextContent(audioSrc);
    }
    return '';
  }, [audioSrc]);

  // Get current asset ID and asset for display
  const currentAssetId = useMemo(() => {
    const src = layer?.variables?.audio?.src;
    if (isAssetVariable(src)) {
      return getAssetId(src);
    }
    return null;
  }, [layer?.variables?.audio?.src]);

  const currentAsset = useMemo(() => {
    return currentAssetId ? getAsset(currentAssetId) : null;
  }, [currentAssetId, getAsset]);

  const assetFilename = useMemo(() => {
    return currentAsset?.filename || null;
  }, [currentAsset]);

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

  const handleFieldSelect = useCallback((
    fieldId: string,
    relationshipPath: string[],
    source?: FieldSourceType,
    layerId?: string
  ) => {
    if (!layer) return;

    const field = audioFields.find(f => f.id === fieldId);
    const fieldVariable: FieldVariable = {
      type: 'field',
      data: {
        field_id: fieldId,
        relationships: relationshipPath,
        field_type: field?.type || null,
        source,
        collection_layer_id: layerId,
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
  }, [layer, onLayerUpdate, audioFields]);

  const handleTypeChange = useCallback((type: 'upload' | 'custom_url' | 'cms') => {
    if (!layer) return;

    if (type === 'custom_url') {
      // Switch to Custom URL - create DynamicTextVariable
      const urlVariable = createDynamicTextVariable('');

      onLayerUpdate(layer.id, {
        variables: {
          ...layer.variables,
          audio: {
            src: urlVariable,
          },
        },
      });
    } else if (type === 'cms') {
      // Switch to CMS - create FieldVariable with null field_id (user will select a field)
      const fieldVariable: FieldVariable = {
        type: 'field',
        data: {
          field_id: null,
          relationships: [],
          field_type: null,
        },
      };
      onLayerUpdate(layer.id, {
        variables: {
          ...layer.variables,
          audio: {
            src: fieldVariable as any,
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
          audio: {
            src: placeholderVariable,
          },
        },
      });
      setSelectedField(null);
    }
  }, [layer, onLayerUpdate]);

  const handleUrlChange = useCallback((value: string) => {
    if (!layer) return;

    // Value is already a string from RichTextEditor (already converted from Tiptap JSON)
    // Create DynamicTextVariable directly from the string value
    const srcVariable = createDynamicTextVariable(value);

    // Update variables.audio.src
    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        audio: {
          src: srcVariable,
        },
      },
    });
  }, [layer, onLayerUpdate]);

  const handleBrowseAudio = useCallback(() => {
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
  }, [openFileManager, handleAudioChange, layer, currentAssetId]);

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

  return (
    <SettingsPanel
      title="Audio"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="flex flex-col gap-3">
        {/* Source Section */}
        <div className="grid grid-cols-3 items-center">
          <Label variant="muted">Source</Label>

          <div className="col-span-2">
            <Select value={audioType} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upload"><Icon name="folder" className="size-3" /> File manager</SelectItem>
                <SelectItem value="custom_url"><Icon name="link" className="size-3" /> Custom URL</SelectItem>
                <SelectItem value="cms" disabled={audioFields.length === 0}><Icon name="database" className="size-3" /> CMS field</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* File Manager Upload */}
        {audioType === 'upload' && (
          <div className="grid grid-cols-3 items-center">
            <Label variant="muted">File</Label>

            <div className="col-span-2 flex gap-2">
              <div className="bg-input rounded-md h-8 aspect-3/2 flex items-center justify-center">
                <Icon name="audio" className="size-4 text-muted-foreground" />
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={handleBrowseAudio}
              >
                {assetFilename ? 'Change file' : 'Choose file'}
              </Button>
            </div>
          </div>
        )}

        {/* Custom URL Section */}
        {audioType === 'custom_url' && (
          <div className="grid grid-cols-3 items-start">
            <Label variant="muted" className="pt-2">URL</Label>

            <div className="col-span-2">
              <RichTextEditor
                value={customUrlValue}
                onChange={handleUrlChange}
                placeholder="https://example.com/audio.mp3"
                fieldGroups={fieldGroups}
                allFields={allFields}
                collections={collections}
              />
            </div>
          </div>
        )}

        {/* CMS Field Section */}
        {audioType === 'cms' && (
          <div className="grid grid-cols-3 items-center">
            <Label variant="muted">Field</Label>

            <div className="col-span-2 w-full">
              <FieldSelectDropdown
                fieldGroups={audioFieldGroups}
                allFields={allFields || {}}
                collections={collections || []}
                value={selectedField || currentFieldId}
                onSelect={handleFieldSelect}
                placeholder="Select a field"
                allowedFieldTypes={AUDIO_FIELD_TYPES}
              />
            </div>
          </div>
        )}

        {/* Volume Slider */}
        <div className="grid grid-cols-3 gap-2 h-7">
          <div className="flex items-center">
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
