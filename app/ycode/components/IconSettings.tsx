'use client';

/**
 * Icon Settings Component
 *
 * Settings panel for icon layers with icon library selection
 */

import React, { useState, useCallback, useMemo } from 'react';

import { Label } from '@/components/ui/label';
import SettingsPanel from './SettingsPanel';
import type { Layer } from '@/types';
import { createAssetVariable, isAssetVariable, getAssetId, isStaticTextVariable, getStaticTextContent } from '@/lib/variable-utils';
import { DEFAULT_ASSETS } from '@/lib/asset-utils';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/stores/useEditorStore';
import { useAssetsStore } from '@/stores/useAssetsStore';
import { toast } from 'sonner';
import Icon from '@/components/ui/icon';

interface IconSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function IconSettings({ layer, onLayerUpdate }: IconSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);

  // Get icon source variable
  const iconSrc = layer?.variables?.icon?.src;

  const openFileManager = useEditorStore((state) => state.openFileManager);
  const getAsset = useAssetsStore((state) => state.getAsset);

  // Icons only support AssetVariable in the UI (StaticTextVariable is for internal use only)
  // If we have a StaticTextVariable, treat it as if no source is set (user can't edit it)

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

  // Get current icon source (always SVG code string) for preview
  const currentIconSource = (() => {
    let iconContent = '';

    if (iconSrc) {
      if (isStaticTextVariable(iconSrc)) {
        iconContent = getStaticTextContent(iconSrc);
      } else if (isAssetVariable(iconSrc)) {
        const assetId = getAssetId(iconSrc);
        const asset = assetId ? getAsset(assetId) : null;
        iconContent = asset?.content || '';
      }
    }

    // Return default icon if no valid content
    return iconContent && iconContent.trim() !== '' ? iconContent : DEFAULT_ASSETS.ICON;
  })();

  return (
    <SettingsPanel
      title="Icon"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="flex flex-col gap-2.5">
        {/* File Manager Upload */}
        <div className="grid grid-cols-3 items-center">
          <Label variant="muted">File</Label>

          <div className="col-span-2 flex gap-2">
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

            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={handleBrowseAsset}
            >
              Browse
            </Button>
          </div>
        </div>
      </div>
    </SettingsPanel>
  );
}
