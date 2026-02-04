/* eslint-disable @next/next/no-img-element */
'use client';

/**
 * Video Settings Component
 *
 * Settings panel for video layers with file manager integration
 */

import React, { useState, useCallback, useMemo } from 'react';

import { Label } from '@/components/ui/label';
import SettingsPanel from './SettingsPanel';
import RichTextEditor from './RichTextEditor';
import type { FieldGroup } from './FieldTreeSelect';
import type { Layer, CollectionField, Collection, VideoVariable, FieldVariable } from '@/types';
import { createAssetVariable, createDynamicTextVariable, getDynamicTextContent, isAssetVariable, getAssetId, isFieldVariable, isDynamicTextVariable } from '@/lib/variable-utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEditorStore } from '@/stores/useEditorStore';
import { useAssetsStore } from '@/stores/useAssetsStore';
import { ASSET_CATEGORIES, isAssetOfType, DEFAULT_ASSETS } from '@/lib/asset-utils';
import { VIDEO_FIELD_TYPES, TEXT_FIELD_TYPES, filterFieldGroupsByType, flattenFieldGroups, getFieldIcon } from '@/lib/collection-field-utils';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';

interface VideoSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  /** Field groups with labels and sources for inline variable selection */
  fieldGroups?: FieldGroup[];
  allFields?: Record<string, CollectionField[]>;
  collections?: Collection[];
}

export default function VideoSettings({ layer, onLayerUpdate, fieldGroups, allFields, collections }: VideoSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Initialize selectedField from current field variable if it exists
  const videoSrc = layer?.variables?.video?.src;
  const initialFieldId = videoSrc && isFieldVariable(videoSrc) && 'data' in videoSrc && 'field_id' in videoSrc.data
    ? videoSrc.data.field_id
    : null;
  const [selectedField, setSelectedField] = useState<string | null>(initialFieldId);

  const openFileManager = useEditorStore((state) => state.openFileManager);
  const getAsset = useAssetsStore((state) => state.getAsset);

  // Detect current video type from src variable
  const videoType = useMemo((): 'upload' | 'youtube' | 'custom_url' | 'cms' => {
    if (!videoSrc) return 'upload';
    if (videoSrc.type === 'video') return 'youtube';
    if (videoSrc.type === 'field') return 'cms';
    if (isDynamicTextVariable(videoSrc)) return 'custom_url';
    return 'upload';
  }, [videoSrc]);

  // Get YouTube video ID and privacy mode if video type is YouTube
  const youtubeVideoId = useMemo(() => {
    if (videoSrc && videoSrc.type === 'video') {
      return (videoSrc as VideoVariable).data.video_id || '';
    }
    return '';
  }, [videoSrc]);

  const youtubePrivacyMode = useMemo(() => {
    return layer?.attributes?.youtubePrivacyMode === true;
  }, [layer?.attributes?.youtubePrivacyMode]);

  // Get custom URL value from DynamicTextVariable
  const customUrlValue = useMemo(() => {
    if (videoSrc && isDynamicTextVariable(videoSrc)) {
      return getDynamicTextContent(videoSrc);
    }
    return '';
  }, [videoSrc]);

  // Get current asset ID and asset for display
  const currentAssetId = useMemo(() => {
    const src = layer?.variables?.video?.src;
    if (isAssetVariable(src)) {
      return getAssetId(src);
    }
    return null;
  }, [layer?.variables?.video?.src]);

  const currentAsset = useMemo(() => {
    return currentAssetId ? getAsset(currentAssetId) : null;
  }, [currentAssetId, getAsset]);

  const assetFilename = useMemo(() => {
    return currentAsset?.filename || null;
  }, [currentAsset]);

  // Get current poster asset ID and asset for display
  const currentPosterAssetId = useMemo(() => {
    const poster = layer?.variables?.video?.poster;
    if (isAssetVariable(poster)) {
      return getAssetId(poster);
    }
    return null;
  }, [layer?.variables?.video?.poster]);

  const currentPosterAsset = useMemo(() => {
    return currentPosterAssetId ? getAsset(currentPosterAssetId) : null;
  }, [currentPosterAssetId, getAsset]);

  const posterAssetFilename = useMemo(() => {
    return currentPosterAsset?.filename || null;
  }, [currentPosterAsset]);

  // Get current poster URL from variables.video.poster
  const posterUrl = useMemo(() => {
    if (currentPosterAsset?.public_url) {
      return currentPosterAsset.public_url;
    }
    return DEFAULT_ASSETS.IMAGE;
  }, [currentPosterAsset]);

  const handleVideoChange = useCallback((assetId: string) => {
    if (!layer) return;

    // Create AssetVariable from asset ID
    const assetVariable = createAssetVariable(assetId);

    // Update layer with AssetVariable
    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        video: {
          src: assetVariable,
          poster: layer.variables?.video?.poster,
        },
      },
    });
  }, [layer, onLayerUpdate]);

  // Filter fields to only show video-bindable field types
  const videoFields = useMemo(() => {
    const filtered = filterFieldGroupsByType(fieldGroups, VIDEO_FIELD_TYPES);
    return flattenFieldGroups(filtered);
  }, [fieldGroups]);

  // Filter field groups to only show text fields (for YouTube Video ID)
  const textFieldGroups = useMemo(() => {
    return filterFieldGroupsByType(fieldGroups, TEXT_FIELD_TYPES);
  }, [fieldGroups]);

  const handleFieldSelect = useCallback((fieldId: string) => {
    if (!layer) return;

    // Create FieldVariable from field ID with actual field type
    const field = videoFields.find(f => f.id === fieldId);
    const fieldVariable: FieldVariable = {
      type: 'field',
      data: {
        field_id: fieldId,
        relationships: [],
        field_type: field?.type || null,
      },
    };

    // Update layer with FieldVariable
    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        video: {
          src: fieldVariable,
          poster: layer.variables?.video?.poster,
        },
      },
    });

    setSelectedField(fieldId);
  }, [layer, onLayerUpdate, videoFields]);

  const handlePosterChange = useCallback((assetId: string) => {
    if (!layer) return;

    // Create AssetVariable from asset ID
    const assetVariable = createAssetVariable(assetId);

    // Update layer with AssetVariable
    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        video: {
          ...(layer.variables?.video || {}),
          src: layer.variables?.video?.src,
          poster: assetVariable,
        },
      },
    });
  }, [layer, onLayerUpdate]);

  const handleMutedChange = useCallback((checked: boolean) => {
    if (!layer) return;

    const newAttributes = { ...layer.attributes };

    if (checked) {
      newAttributes.muted = true;
    } else {
      delete newAttributes.muted;
      // Also remove autoplay if unmuting (autoplay requires muted)
      delete newAttributes.autoplay;
    }

    onLayerUpdate(layer.id, {
      attributes: newAttributes,
    });
  }, [layer, onLayerUpdate]);

  const handleControlsChange = useCallback((checked: boolean) => {
    if (!layer) return;

    const newAttributes = { ...layer.attributes };

    if (checked) {
      newAttributes.controls = true;
    } else {
      delete newAttributes.controls;
    }

    onLayerUpdate(layer.id, {
      attributes: newAttributes,
    });
  }, [layer, onLayerUpdate]);

  const handleLoopChange = useCallback((checked: boolean) => {
    if (!layer) return;

    const newAttributes = { ...layer.attributes };

    if (checked) {
      newAttributes.loop = true;
    } else {
      delete newAttributes.loop;
    }

    onLayerUpdate(layer.id, {
      attributes: newAttributes,
    });
  }, [layer, onLayerUpdate]);

  const handleAutoplayChange = useCallback((checked: boolean) => {
    if (!layer) return;

    const newAttributes = { ...layer.attributes };

    if (checked) {
      newAttributes.autoplay = true;
      // Autoplay requires muted
      newAttributes.muted = true;
    } else {
      delete newAttributes.autoplay;
    }

    onLayerUpdate(layer.id, {
      attributes: newAttributes,
    });
  }, [layer, onLayerUpdate]);

  const handleTypeChange = useCallback((type: 'upload' | 'youtube' | 'custom_url' | 'cms') => {
    if (!layer) return;

    if (type === 'youtube') {
      // Switch to YouTube - create VideoVariable
      const videoVariable: VideoVariable = {
        type: 'video',
        data: {
          provider: 'youtube',
          video_id: '',
        },
      };

      onLayerUpdate(layer.id, {
        variables: {
          ...layer.variables,
          video: {
            src: videoVariable,
            // Remove poster when switching to YouTube
            poster: undefined,
          },
        },
      });
    } else if (type === 'custom_url') {
      // Switch to Custom URL - create DynamicTextVariable
      const urlVariable = createDynamicTextVariable('');

      onLayerUpdate(layer.id, {
        variables: {
          ...layer.variables,
          video: {
            src: urlVariable,
            // Remove poster when switching to custom URL
            poster: undefined,
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
          video: {
            src: fieldVariable as any,
            poster: layer.variables?.video?.poster,
          },
        },
      });
      setSelectedField(null);
    } else {
      // Switch to Upload - clear src (user will need to upload a video)
      onLayerUpdate(layer.id, {
        variables: {
          ...layer.variables,
          video: {
            src: undefined,
            poster: layer.variables?.video?.poster,
          },
        },
      });
      setSelectedField(null);
    }
  }, [layer, onLayerUpdate]);

  const handleYoutubeVideoIdChange = useCallback((videoId: string) => {
    if (!layer) return;

    const videoVariable: VideoVariable = {
      type: 'video',
      data: {
        provider: 'youtube',
        video_id: videoId,
      },
    };

    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        video: {
          src: videoVariable,
          poster: undefined,
        },
      },
    });
  }, [layer, onLayerUpdate]);

  const handleYoutubePrivacyModeChange = useCallback((checked: boolean) => {
    if (!layer) return;

    const newAttributes = { ...layer.attributes };

    if (checked) {
      newAttributes.youtubePrivacyMode = true;
    } else {
      delete newAttributes.youtubePrivacyMode;
    }

    onLayerUpdate(layer.id, {
      attributes: newAttributes,
    });
  }, [layer, onLayerUpdate]);

  const handleCustomUrlChange = useCallback((value: string) => {
    if (!layer) return;

    // Value is already a string from RichTextEditor (already converted from Tiptap JSON)
    // Create DynamicTextVariable directly from the string value
    const urlVariable = createDynamicTextVariable(value);

    // Update variables.video.src
    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        video: {
          src: urlVariable,
          poster: layer.variables?.video?.poster,
        },
      },
    });
  }, [layer, onLayerUpdate]);

  // Only show for video layers
  if (!layer || layer.name !== 'video') {
    return null;
  }

  // Check if current src is a field variable
  const isFieldVariableSrc = videoSrc ? isFieldVariable(videoSrc) : false;
  const currentFieldId = isFieldVariableSrc && videoSrc && 'data' in videoSrc && 'field_id' in videoSrc.data
    ? videoSrc.data.field_id
    : null;

  // Get current behavior values from attributes
  const isMuted = layer.attributes?.muted === true;
  const hasControls = layer.attributes?.controls === true;
  const isLoop = layer.attributes?.loop === true;
  const isAutoplay = layer.attributes?.autoplay === true;

  return (
    <>
      <SettingsPanel
        title="Video"
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-col gap-2.5">
          {/* Source Section */}
          <div className="grid grid-cols-3 items-center">
            <Label variant="muted">Source</Label>

            <div className="col-span-2 flex gap-2">
              <Select value={videoType} onValueChange={handleTypeChange}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upload"><Icon name="folder" className="size-3" /> File manager</SelectItem>
                  <SelectItem value="custom_url"><Icon name="link" className="size-3" /> Custom URL</SelectItem>
                  <SelectItem value="cms" disabled={videoFields.length === 0}><Icon name="database" className="size-3" /> CMS field</SelectItem>
                  <SelectSeparator />
                  <SelectItem value="youtube"><Icon name="video" className="size-3" /> YouTube</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File / URL / Field / YouTube ID - Based on source */}
          {videoType === 'upload' && (
            <div className="grid grid-cols-3 items-center">
              <Label variant="muted">File</Label>

              <div className="col-span-2 flex gap-2">
                {!selectedField && !currentFieldId && (
                  <>
                    <div className="bg-input rounded-md h-8 aspect-3/2 flex items-center justify-center">
                      <Icon name="video" className="size-4 text-muted-foreground" />
                    </div>

                    <Button
                      variant="secondary"
                      className="flex-1"
                      size="sm"
                      onClick={() => {
                        openFileManager(
                          (asset) => {
                            if (!layer) return false;

                            // Validate asset type
                            if (!asset.mime_type || !isAssetOfType(asset.mime_type, ASSET_CATEGORIES.VIDEOS)) {
                              toast.error('Invalid asset type', {
                                description: 'Please select a video file.',
                              });
                              return false; // Don't close file manager
                            }

                            handleVideoChange(asset.id);
                          },
                          currentAssetId,
                          ASSET_CATEGORIES.VIDEOS
                        );
                      }}
                    >
                      {assetFilename ? 'Change file' : 'Choose file'}
                    </Button>
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
                      {videoFields.find(f => f.id === (selectedField || currentFieldId))?.name || 'Field'}
                    </span>
                    <Button
                      className="size-5! p-0! -mr-1 ml-auto"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedField(null);
                        // Clear field variable and reset to asset
                        if (layer) {
                          onLayerUpdate(layer.id, {
                            variables: {
                              ...layer.variables,
                              video: {
                                src: undefined,
                                poster: layer.variables?.video?.poster,
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
          )}

          {/* YouTube Video ID Section */}
          {videoType === 'youtube' && (
            <div className="grid grid-cols-3 items-start">
              <Label variant="muted" className="pt-2">Video ID</Label>

              <div className="col-span-2">
                <RichTextEditor
                  value={youtubeVideoId}
                  onChange={handleYoutubeVideoIdChange}
                  placeholder="i.e. dQw4w9WgXcQ"
                  fieldGroups={textFieldGroups}
                  allFields={allFields}
                  collections={collections}
                />
              </div>
            </div>
          )}

          {/* Custom URL Section */}
          {videoType === 'custom_url' && (
            <div className="grid grid-cols-3 items-start">
              <Label variant="muted" className="pt-2">URL</Label>

              <div className="col-span-2">
                <RichTextEditor
                  value={customUrlValue}
                  onChange={handleCustomUrlChange}
                  placeholder="https://example.com/video.mp4"
                  fieldGroups={fieldGroups}
                  allFields={allFields}
                  collections={collections}
                />
              </div>
            </div>
          )}

          {/* CMS Field Section */}
          {videoType === 'cms' && (
            <div className="grid grid-cols-3 items-center">
              <Label variant="muted">Field</Label>

              <div className="col-span-2 w-full">
                <Select
                  value={selectedField || currentFieldId || ''}
                  onValueChange={handleFieldSelect}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a field" />
                  </SelectTrigger>
                  <SelectContent>
                    {videoFields.map((field) => (
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

          {/* Behavior Section */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label variant="muted">Behavior</Label>
            </div>

            <div className="col-span-2 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="video-controls"
                  checked={hasControls}
                  onCheckedChange={handleControlsChange}
                />
                <Label
                  variant="muted"
                  htmlFor="video-controls"
                  className="cursor-pointer"
                >
                  Display controls
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="video-muted"
                  checked={isMuted}
                  onCheckedChange={handleMutedChange}
                />
                <Label
                  variant="muted"
                  htmlFor="video-muted"
                  className="cursor-pointer"
                >
                  Mute sound
                </Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="video-loop"
                  checked={isLoop}
                  onCheckedChange={handleLoopChange}
                />
                <Label
                  variant="muted"
                  htmlFor="video-loop"
                  className="cursor-pointer"
                >
                  Loop video
                </Label>
              </div>

              {/* YouTube Privacy Mode */}
              {videoType === 'youtube' && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="youtube-privacy"
                    checked={youtubePrivacyMode}
                    onCheckedChange={handleYoutubePrivacyModeChange}
                  />
                  <Label
                    variant="muted"
                    htmlFor="youtube-privacy"
                    className="cursor-pointer"
                  >
                    Privacy mode
                  </Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Icon name="info" className="size-3 opacity-70" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Prevents usage of tracking cookies</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Switch
                  id="video-autoplay"
                  checked={isAutoplay}
                  onCheckedChange={handleAutoplayChange}
                  disabled={!isMuted}
                />
                <Label
                  variant="muted"
                  htmlFor="video-autoplay"
                  className={!isMuted ? 'opacity-60 cursor-pointer' : 'cursor-pointer'}
                >
                  Autoplay
                </Label>
                {!isMuted && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Icon name="info" className="size-3 opacity-70" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Only available when video sound is muted</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
          </div>

          {/* Poster Section - show for Upload, Custom URL, and CMS types (not YouTube) */}
          {(videoType === 'upload' || videoType === 'custom_url' || videoType === 'cms') && (
            <div className="grid grid-cols-3 items-start">
              <Label variant="muted" className="pt-2">Poster</Label>

              <div className="col-span-2">
                <div className="relative group bg-secondary/30 hover:bg-secondary/60 rounded-md w-full aspect-3/2 overflow-hidden">
                  {/* Checkerboard pattern for transparency */}
                  <div className="absolute inset-0 opacity-10 bg-checkerboard" />
                  <img
                    src={posterUrl}
                    className="relative w-full h-full object-contain z-10"
                    alt="Video poster"
                  />

                  <div className="absolute inset-0 bg-black/50 text-white text-xs flex flex-col gap-3 items-center justify-center px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="overlay"
                        size="sm"
                        onClick={() => {
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

                              handlePosterChange(asset.id);
                            },
                            currentPosterAssetId,
                            ASSET_CATEGORIES.IMAGES
                          );
                        }}
                      >
                        {posterAssetFilename ? 'Change' : 'Choose file'}
                      </Button>
                      {posterAssetFilename && (
                        <Button
                          variant="overlay"
                          size="sm"
                          onClick={() => {
                            if (!layer) return;

                            // Remove poster by setting it to undefined
                            onLayerUpdate(layer.id, {
                              variables: {
                                ...layer.variables,
                                video: {
                                  ...layer.variables?.video,
                                  src: layer.variables?.video?.src,
                                  poster: undefined,
                                },
                              },
                            });
                          }}
                        >
                          <Icon name="trash" />
                        </Button>
                      )}
                    </div>
                    {posterAssetFilename && <div className="max-w-full truncate text-center">{posterAssetFilename}</div>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SettingsPanel>
    </>
  );
}
