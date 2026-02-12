/* eslint-disable @next/next/no-img-element */
'use client';

/**
 * Reusable card for displaying an asset in CMS (collection item sheet, field default, etc.).
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { getFieldIcon } from '@/lib/collection-field-utils';
import { ASSET_CATEGORIES, getOptimizedImageUrl, isAssetOfType, formatFileSize, getFileExtension } from '@/lib/asset-utils';
import type { Asset, CollectionFieldType } from '@/types';

export interface AssetFieldCardProps {
  asset: Asset | null;
  fieldType: CollectionFieldType;
  onChangeFile: () => void;
  onRemove: () => void;
}

/** Card for a single asset with preview, filename, metadata, and Change/Remove actions */
function AssetFieldCard({ asset, fieldType, onChangeFile, onRemove }: AssetFieldCardProps) {
  const isImageField = fieldType === 'image' && asset;
  const isSvgIcon = isImageField && (!!asset!.content || (asset!.mime_type && isAssetOfType(asset!.mime_type, ASSET_CATEGORIES.ICONS)));
  const imageUrl = isImageField && asset!.public_url ? asset!.public_url : null;
  const showCheckerboard = isImageField && (isSvgIcon || !!imageUrl);

  return (
    <div className="bg-input p-2 rounded-lg flex items-center gap-4">
      <div className="relative group bg-secondary/30 rounded-md w-full aspect-square overflow-hidden max-w-24 shrink-0">
        {showCheckerboard && (
          <div className="absolute inset-0 opacity-10 bg-checkerboard" />
        )}
        {isImageField ? (
          isSvgIcon && asset!.content ? (
            <div
              data-icon
              className="relative w-full h-full flex items-center justify-center p-2 pointer-events-none text-foreground z-10"
              dangerouslySetInnerHTML={{ __html: asset!.content }}
            />
          ) : imageUrl ? (
            <img
              src={getOptimizedImageUrl(imageUrl)}
              className="relative w-full h-full object-contain pointer-events-none z-10"
              alt="Image preview"
              loading="lazy"
            />
          ) : (
            <div className="relative w-full h-full flex items-center justify-center z-10 text-muted-foreground">
              <Icon name="image" className="size-6" />
            </div>
          )
        ) : (
          <div className="relative w-full h-full flex items-center justify-center z-10 text-muted-foreground">
            {asset && <Icon name={getFieldIcon(fieldType)} className="size-6" />}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {asset && (
          <div className="flex flex-col gap-1">
            <Label className="truncate">{asset.filename}</Label>
            <span className="text-xs text-current/60 inline-flex gap-2 items-center flex-wrap">
              {getFileExtension(asset.mime_type)}
              <div className="size-0.5 bg-current/50 rounded-full inline-flex" />
              {formatFileSize(asset.file_size)}
              {asset.width && asset.height && (
                <>
                  <div className="size-0.5 bg-current/50 rounded-full inline-flex" />
                  {asset.width}×{asset.height}
                </>
              )}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onChangeFile(); }}
          >
            {asset ? 'Change file' : 'Choose file'}
          </Button>
          {asset && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AssetFieldCard;
