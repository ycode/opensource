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
import { DEFAULT_ASSETS, isAssetOfType, ASSET_CATEGORIES } from '@/lib/asset-utils';
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

        // Validate that it's an SVG file (icon)
        if (!asset.mime_type || !isAssetOfType(asset.mime_type, ASSET_CATEGORIES.ICONS)) {
          toast.error('Invalid asset type', {
            description: 'Please select an SVG file.',
          });
          return false; // Don't close file manager
        }

        handleAssetSelect(asset.id);
      },
      currentAssetId,
      ASSET_CATEGORIES.ICONS
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

  // Get current asset ID and asset for display
  const currentAssetId = (() => {
    const src = layer?.variables?.icon?.src;
    if (isAssetVariable(src)) {
      return getAssetId(src);
    }
    return null;
  })();

  const currentAsset = currentAssetId ? getAsset(currentAssetId) : null;
  const assetFilename = currentAsset?.filename || null;

  return (
    <SettingsPanel
      title="Icon"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="flex flex-col gap-2.5">
        {/* File Manager Upload */}
        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="pt-2">File</Label>

          <div className="col-span-2">
            <div
              className="relative group bg-secondary/30 hover:bg-secondary/60 rounded-md w-full aspect-3/2 overflow-hidden cursor-pointer"
              onClick={handleBrowseAsset}
            >
              <div className="w-full h-full flex items-center justify-center p-4">
                {currentIconSource ? (
                  <div
                    data-icon="true"
                    className="w-full h-full flex items-center justify-center"
                    dangerouslySetInnerHTML={{ __html: currentIconSource }}
                  />
                ) : (
                  <Icon name="icon" className="size-4 text-muted-foreground" />
                )}
              </div>

              <div className="absolute inset-0 bg-black/50 text-white text-xs flex flex-col gap-3 items-center justify-center px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="overlay" size="sm">{assetFilename ? 'Change file' : 'Choose file'}</Button>
                {assetFilename && <div className="max-w-full truncate text-center">{assetFilename}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingsPanel>
  );
}
