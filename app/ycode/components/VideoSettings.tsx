/* eslint-disable @next/next/no-img-element */
'use client';

/**
 * Video Settings Component
 *
 * Settings panel for video layers with file manager integration
 */

import React, { useState, useCallback } from 'react';

import { Label } from '@/components/ui/label';
import SettingsPanel from './SettingsPanel';
import type { Layer, CollectionField, Collection } from '@/types';
import { createAssetVariable, getVideoUrlFromVariable, isAssetVariable, getAssetId, isFieldVariable } from '@/lib/variable-utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

interface VideoSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  fields?: CollectionField[];
  fieldSourceLabel?: string;
  allFields?: Record<string, CollectionField[]>;
  collections?: Collection[];
}

export default function VideoSettings({ layer, onLayerUpdate, fields, fieldSourceLabel, allFields, collections }: VideoSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Initialize selectedField from current field variable if it exists
  const videoSrc = layer?.variables?.video?.src;
  const initialFieldId = videoSrc && isFieldVariable(videoSrc) && 'data' in videoSrc && 'field_id' in videoSrc.data
    ? videoSrc.data.field_id
    : null;
  const [selectedField, setSelectedField] = useState<string | null>(initialFieldId);

  const openFileManager = useEditorStore((state) => state.openFileManager);
  const getAsset = useAssetsStore((state) => state.getAsset);

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
        video: {
          src: fieldVariable,
          poster: layer.variables?.video?.poster,
        },
      },
    });

    setSelectedField(fieldId);
  }, [layer, onLayerUpdate]);

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
      newAttributes.muted = 'true';
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
      newAttributes.controls = 'true';
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
      newAttributes.loop = 'true';
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
      newAttributes.autoplay = 'true';
      // Autoplay requires muted
      newAttributes.muted = 'true';
    } else {
      delete newAttributes.autoplay;
    }

    onLayerUpdate(layer.id, {
      attributes: newAttributes,
    });
  }, [layer, onLayerUpdate]);

  // Only show for video layers
  if (!layer || layer.name !== 'video') {
    return null;
  }

  // Get current video URL from variables.video.src
  const videoUrl = getVideoUrlFromVariable(
    videoSrc,
    getAsset
  ) || '';

  // Check if current src is a field variable
  const isFieldVariableSrc = videoSrc ? isFieldVariable(videoSrc) : false;
  const currentFieldId = isFieldVariableSrc && videoSrc && 'data' in videoSrc && 'field_id' in videoSrc.data
    ? videoSrc.data.field_id
    : null;

  // Get video fields (image type fields can store any asset including videos)
  const videoFields = fields?.filter(f => f.type === 'image') || [];

  // Check if current poster is set
  const hasPoster = layer.variables?.video?.poster !== undefined;

  // Get current poster URL from variables.video.poster
  const posterUrl = (() => {
    const posterVariable = layer.variables?.video?.poster;
    if (!posterVariable) return '';
    if (isAssetVariable(posterVariable)) {
      const assetId = getAssetId(posterVariable);
      const asset = assetId ? getAsset(assetId) : null;
      return asset?.public_url || '';
    }
    return '';
  })();

  // Get current behavior values from attributes
  const isMuted = layer.attributes?.muted === 'true';
  const hasControls = layer.attributes?.controls === 'true';
  const isLoop = layer.attributes?.loop === 'true';
  const isAutoplay = layer.attributes?.autoplay === 'true';

  return (
    <>
      <SettingsPanel
        title="Video"
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
                      <Icon name="video" className="size-4 text-muted-foreground" />
                    </div>

                    <ButtonGroup className="divide-x flex-1">
                      <Button
                        variant="secondary"
                        className="w-full"
                        size="sm"
                        onClick={() => {
                          // Get current asset ID if video src is an AssetVariable
                          const currentAssetId = (() => {
                            const src = layer.variables?.video?.src;
                            if (isAssetVariable(src)) {
                              return getAssetId(src);
                            }
                            return null;
                          })();

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
                            currentAssetId
                          );
                        }}
                      >
                        Browse
                      </Button>

                      {videoFields.length > 0 && (
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
                              {videoFields.map((field) => (
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
                      {videoFields.find(f => f.id === (selectedField || currentFieldId))?.name || 'Field'}
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
          </div>

          {/* Behavior Section */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label variant="muted">Behavior</Label>
            </div>

            <div className="col-span-2 flex flex-col gap-3">
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

              {!isMuted ? (
                <Tooltip>
                  <TooltipTrigger asChild>
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
                        className="opacity-60 cursor-pointer"
                      >
                        Autoplay
                      </Label>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Only available when video sound is muted</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
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
                    className="cursor-pointer"
                  >
                    Autoplay
                  </Label>
                </div>
              )}
            </div>
          </div>

          {/* Poster Section */}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 items-start">
              <Label variant="muted">Poster</Label>

              <div className="col-span-2 flex flex-col gap-2">
                <div className="relative group w-full h-20 aspect-video rounded-lg overflow-hidden bg-input flex items-center justify-center gap-1.5">
                  {posterUrl && (
                    <img
                      src={posterUrl}
                      className="absolute inset-0 w-full h-full object-cover"
                      alt="Video poster"
                    />
                  )}

                  <Button
                    variant={hasPoster ? 'overlay' : 'secondary'}
                    size="sm"
                    className="relative"
                    onClick={() => {
                      // Get current poster asset ID
                      const currentPosterAssetId = (() => {
                        const poster = layer.variables?.video?.poster;
                        if (isAssetVariable(poster)) {
                          return getAssetId(poster);
                        }
                        return null;
                      })();

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
                        currentPosterAssetId
                      );
                    }}
                  >
                    Browse
                  </Button>

                  {hasPoster && (
                    <Button
                      variant="overlay"
                      size="sm"
                      className="relative"
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
              </div>
            </div>
          </div>
        </div>
      </SettingsPanel>
    </>
  );
}
