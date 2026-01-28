'use client';

/**
 * Rich Text Link Settings Component
 *
 * Settings panel for rich text links in TipTap editors.
 * Supports all link types: URL, email, phone, asset, page, field.
 * Extracted from LinkSettings to work with LinkSettings object directly.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';

import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import Icon, { type IconProps } from '@/components/ui/icon';
import InputWithInlineVariables from './InputWithInlineVariables';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Layer, CollectionField, Collection, LinkSettings, LinkType, CollectionItemWithValues } from '@/types';
import {
  createDynamicTextVariable,
  getDynamicTextContent,
} from '@/lib/variable-utils';
import { usePagesStore } from '@/stores/usePagesStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useAssetsStore } from '@/stores/useAssetsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { getAssetIcon } from '@/lib/asset-utils';
import { collectionsApi } from '@/lib/api';
import { getLayerIcon, getLayerName, getCollectionVariable } from '@/lib/layer-utils';
import { getPageIcon } from '@/lib/page-utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { FieldGroup } from './FieldTreeSelect';

export interface RichTextLinkSettingsProps {
  /** Current link settings */
  value: LinkSettings | null;
  /** Callback when link settings change */
  onChange: (settings: LinkSettings | null) => void;
  /** Field groups with labels and sources for inline variable selection */
  fieldGroups?: FieldGroup[];
  /** All fields by collection ID */
  allFields?: Record<string, CollectionField[]>;
  /** Available collections */
  collections?: Collection[];
  /** Whether this is inside a collection layer */
  isInsideCollectionLayer?: boolean;
  /** Current layer (for context - collection layer detection) */
  layer?: Layer | null;
}

/**
 * Rich text link settings UI for TipTap editors
 */
export default function RichTextLinkSettings({
  value,
  onChange,
  fieldGroups,
  allFields,
  collections,
  isInsideCollectionLayer = false,
  layer,
}: RichTextLinkSettingsProps) {
  const [collectionItems, setCollectionItems] = useState<CollectionItemWithValues[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Stores
  const pages = usePagesStore((state) => state.pages);
  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);
  const currentPageId = useEditorStore((state) => state.currentPageId);
  const openFileManager = useEditorStore((state) => state.openFileManager);
  const getAsset = useAssetsStore((state) => state.getAsset);
  const collectionsStoreFields = useCollectionsStore((state) => state.fields);

  // Get current link settings
  const linkSettings = value;
  const linkType = linkSettings?.type || 'none';

  // Get current values based on link type
  const urlValue = useMemo(() => {
    if (linkSettings?.url) {
      return getDynamicTextContent(linkSettings.url);
    }
    return '';
  }, [linkSettings?.url]);

  const emailValue = useMemo(() => {
    if (linkSettings?.email) {
      return getDynamicTextContent(linkSettings.email);
    }
    return '';
  }, [linkSettings?.email]);

  const phoneValue = useMemo(() => {
    if (linkSettings?.phone) {
      return getDynamicTextContent(linkSettings.phone);
    }
    return '';
  }, [linkSettings?.phone]);

  const assetId = linkSettings?.asset?.id || null;
  const pageId = linkSettings?.page?.id || null;
  const collectionItemId = linkSettings?.page?.collection_item_id || null;
  const fieldId = linkSettings?.field?.data?.field_id || null;
  const anchorLayerId = linkSettings?.anchor_layer_id || '';

  // Get link behavior from link settings
  const target = linkSettings?.target || '_self';
  const download = linkSettings?.download || false;
  const rel = linkSettings?.rel || '';

  // Filter out error pages from available pages for linking
  const linkablePages = useMemo(() => {
    return pages.filter((page) => page.error_page === null);
  }, [pages]);

  // Get the selected page
  const selectedPage = useMemo(() => {
    if (!pageId) return null;
    return pages.find((p) => p.id === pageId) || null;
  }, [pageId, pages]);

  // Flatten layers and find all layers with attributes.id
  const findLayersWithId = useCallback((layers: Layer[]): Array<{ layer: Layer; id: string }> => {
    const result: Array<{ layer: Layer; id: string }> = [];
    const stack: Layer[] = [...layers];

    while (stack.length > 0) {
      const currLayer = stack.pop()!;

      if (currLayer.attributes?.id) {
        result.push({ layer: currLayer, id: currLayer.attributes.id });
      }

      if (currLayer.children) {
        stack.push(...currLayer.children);
      }
    }

    return result;
  }, []);

  // Get layers for anchor selection based on link type
  const anchorLayers = useMemo(() => {
    let targetPageId: string | null = null;

    if (linkType === 'page' && pageId) {
      targetPageId = pageId;
    } else if (linkType === 'url' && currentPageId) {
      targetPageId = currentPageId;
    }

    if (!targetPageId) {
      return [];
    }

    const draft = draftsByPageId[targetPageId];
    if (!draft || !draft.layers) {
      return [];
    }

    return findLayersWithId(draft.layers);
  }, [linkType, pageId, currentPageId, draftsByPageId, findLayersWithId]);

  // Check if selected page is dynamic
  const isDynamicPage = selectedPage?.is_dynamic || false;

  // Check if the layer itself is a collection layer
  const isCollectionLayer = !!(layer && getCollectionVariable(layer));

  // Derive collection fields from fieldGroups (for internal use like CMS field link)
  const collectionFields = useMemo(() => {
    const collectionGroup = fieldGroups?.find(g => g.source === 'collection');
    return collectionGroup?.fields || [];
  }, [fieldGroups]);

  // Check if we have collection fields available
  const hasCollectionFields = !!(collectionFields.length > 0 && isInsideCollectionLayer);
  const canUseCurrentCollectionItem = hasCollectionFields || isCollectionLayer;

  // Get collection ID from dynamic page settings
  const pageCollectionId = selectedPage?.settings?.cms?.collection_id || null;

  // Load collection items when dynamic page is selected
  useEffect(() => {
    if (!pageCollectionId || !isDynamicPage) {
      setCollectionItems([]);
      return;
    }

    const loadItems = async () => {
      setLoadingItems(true);
      try {
        const response = await collectionsApi.getItems(pageCollectionId);
        if (response.data) {
          setCollectionItems(response.data.items || []);
        }
      } catch (error) {
        console.error('Failed to load collection items:', error);
      } finally {
        setLoadingItems(false);
      }
    };

    loadItems();
  }, [pageCollectionId, isDynamicPage]);

  // Filter fields to show only text/URL fields for CMS field link
  const urlFields = useMemo(() => {
    return collectionFields.filter((field) => field.type === 'text');
  }, [collectionFields]);

  // Link type options for the dropdown
  const linkTypeOptions = useMemo<
    Array<
      | { value: LinkType | 'none'; label: string; icon: string; disabled?: boolean }
      | { type: 'separator' }
    >
  >(() => {
    return [
      { value: 'none', label: 'No link set', icon: 'none' },
      { type: 'separator' },
      { value: 'page', label: 'Page', icon: 'page' },
      { value: 'asset', label: 'Asset', icon: 'paperclip' },
      { value: 'field', label: 'CMS field', icon: 'database', disabled: urlFields.length === 0 },
      { type: 'separator' },
      { value: 'url', label: 'URL', icon: 'link' },
      { value: 'email', label: 'Email', icon: 'email' },
      { value: 'phone', label: 'Phone', icon: 'phone' },
    ];
  }, [urlFields]);

  // Handle link type change
  const handleLinkTypeChange = useCallback(
    (newType: LinkType | 'none') => {
      if (newType === 'none') {
        onChange(null);
        return;
      }

      // Create new link settings with the new type
      const newSettings: LinkSettings = {
        type: newType,
      };

      // Initialize with empty values based on type
      switch (newType) {
        case 'url':
          newSettings.url = createDynamicTextVariable('');
          break;
        case 'email':
          newSettings.email = createDynamicTextVariable('');
          break;
        case 'phone':
          newSettings.phone = createDynamicTextVariable('');
          break;
        case 'asset':
          newSettings.asset = { id: null };
          break;
        case 'page':
          newSettings.page = { id: '', collection_item_id: null };
          break;
        case 'field':
          newSettings.field = { type: 'field', data: { field_id: null, relationships: [] } };
          break;
      }

      onChange(newSettings);
    },
    [onChange]
  );

  // Handle URL change
  const handleUrlChange = useCallback(
    (newValue: string) => {
      if (!linkSettings) return;

      onChange({
        ...linkSettings,
        url: createDynamicTextVariable(newValue),
      });
    },
    [linkSettings, onChange]
  );

  // Handle email change
  const handleEmailChange = useCallback(
    (newValue: string) => {
      if (!linkSettings) return;

      onChange({
        ...linkSettings,
        email: createDynamicTextVariable(newValue),
      });
    },
    [linkSettings, onChange]
  );

  // Handle phone change
  const handlePhoneChange = useCallback(
    (newValue: string) => {
      if (!linkSettings) return;

      onChange({
        ...linkSettings,
        phone: createDynamicTextVariable(newValue),
      });
    },
    [linkSettings, onChange]
  );

  // Handle asset selection
  const handleAssetSelect = useCallback(() => {
    if (!linkSettings) return;

    openFileManager(
      (asset) => {
        onChange({
          ...linkSettings,
          asset: { id: asset.id },
        });
      },
      assetId || undefined,
      undefined
    );
  }, [linkSettings, assetId, openFileManager, onChange]);

  // Handle page selection
  const handlePageChange = useCallback(
    (newPageId: string) => {
      if (!linkSettings) return;

      onChange({
        ...linkSettings,
        page: {
          id: newPageId,
          collection_item_id: null,
        },
        anchor_layer_id: null,
      });
    },
    [linkSettings, onChange]
  );

  // Handle collection item selection
  const handleCollectionItemChange = useCallback(
    (itemId: string) => {
      if (!linkSettings) return;

      let storedValue: string;
      if (itemId === 'current-page') {
        storedValue = 'current-page';
      } else if (itemId === 'current-collection') {
        storedValue = 'current-collection';
      } else {
        storedValue = itemId;
      }

      onChange({
        ...linkSettings,
        page: {
          ...linkSettings.page!,
          collection_item_id: storedValue,
        },
      });
    },
    [linkSettings, onChange]
  );

  // Handle field selection
  const handleFieldChange = useCallback(
    (newFieldId: string) => {
      if (!linkSettings) return;

      onChange({
        ...linkSettings,
        field: {
          type: 'field',
          data: {
            field_id: newFieldId,
            relationships: [],
          },
        },
      });
    },
    [linkSettings, onChange]
  );

  // Handle anchor layer ID change
  const handleAnchorLayerIdChange = useCallback(
    (newValue: string) => {
      if (!linkSettings) return;

      onChange({
        ...linkSettings,
        anchor_layer_id: newValue || null,
      });
    },
    [linkSettings, onChange]
  );

  // Handle target change
  const handleTargetChange = useCallback(
    (checked: boolean) => {
      if (!linkSettings) return;

      const newTarget = checked ? '_blank' : '_self';
      const newRel = checked ? 'noopener noreferrer' : '';

      onChange({
        ...linkSettings,
        target: newTarget,
        rel: newRel,
      });
    },
    [linkSettings, onChange]
  );

  // Handle download change
  const handleDownloadChange = useCallback(
    (checked: boolean) => {
      if (!linkSettings) return;

      onChange({
        ...linkSettings,
        download: checked,
      });
    },
    [linkSettings, onChange]
  );

  // Handle nofollow change
  const handleNofollowChange = useCallback(
    (checked: boolean) => {
      if (!linkSettings) return;

      const currentRel = rel || '';
      const hasNofollow = currentRel.includes('nofollow');
      let newRel = currentRel;

      if (checked && !hasNofollow) {
        newRel = currentRel ? `${currentRel} nofollow` : 'nofollow';
      } else if (!checked && hasNofollow) {
        newRel = currentRel.replace(/\s*nofollow\s*/g, ' ').trim();
      }

      onChange({
        ...linkSettings,
        rel: newRel,
      });
    },
    [linkSettings, rel, onChange]
  );

  // Get asset info for display
  const selectedAsset = assetId ? getAsset(assetId) : null;

  // Get display name for selected collection item
  const getItemDisplayName = useCallback(
    (itemId: string) => {
      if (itemId === 'current') return 'Current Item';
      const item = collectionItems.find((i) => i.id === itemId);
      if (!item) return itemId;

      const collectionFields = pageCollectionId ? collectionsStoreFields[pageCollectionId] : [];
      const nameField = collectionFields?.find((field) => field.key === 'name');
      if (nameField && item.values[nameField.id]) {
        return item.values[nameField.id];
      }

      const values = Object.values(item.values);
      return values[0] || itemId;
    },
    [collectionItems, pageCollectionId, collectionsStoreFields]
  );

  return (
    <div className="space-y-3 p-2">
      {/* Link Type */}
      <div className="grid grid-cols-3 items-center gap-2">
        <Label className="text-xs text-muted-foreground">Type</Label>
        <div className="col-span-2">
          <Select
            value={linkType}
            onValueChange={(newVal) => handleLinkTypeChange(newVal as LinkType | 'none')}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select link type" />
            </SelectTrigger>
            <SelectContent>
              {linkTypeOptions.map((option, index) => {
                if ('type' in option && option.type === 'separator') {
                  return <SelectSeparator key={`separator-${index}`} />;
                }
                if ('value' in option) {
                  return (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                    >
                      <div className="flex items-center gap-2">
                        <Icon name={option.icon as IconProps['name']} className="size-3" />
                        {option.label}
                      </div>
                    </SelectItem>
                  );
                }
                return null;
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* URL Input */}
      {linkType === 'url' && (
        <div className="grid grid-cols-3 items-center gap-2">
          <Label className="text-xs text-muted-foreground">URL</Label>
          <div className="col-span-2">
            <InputWithInlineVariables
              value={urlValue}
              onChange={handleUrlChange}
              placeholder="https://example.com"
              fieldGroups={fieldGroups}
              allFields={allFields}
              collections={collections}
              disableLinks
            />
          </div>
        </div>
      )}

      {/* Email Input */}
      {linkType === 'email' && (
        <div className="grid grid-cols-3 items-center gap-2">
          <Label className="text-xs text-muted-foreground">Email</Label>
          <div className="col-span-2">
            <InputWithInlineVariables
              value={emailValue}
              onChange={handleEmailChange}
              placeholder="email@example.com"
              fieldGroups={fieldGroups}
              allFields={allFields}
              collections={collections}
              disableLinks
            />
          </div>
        </div>
      )}

      {/* Phone Input */}
      {linkType === 'phone' && (
        <div className="grid grid-cols-3 items-center gap-2">
          <Label className="text-xs text-muted-foreground">Phone</Label>
          <div className="col-span-2">
            <InputWithInlineVariables
              value={phoneValue}
              onChange={handlePhoneChange}
              placeholder="+1234567890"
              fieldGroups={fieldGroups}
              allFields={allFields}
              collections={collections}
              disableLinks
            />
          </div>
        </div>
      )}

      {/* Asset Selection */}
      {linkType === 'asset' && (
        <div className="grid grid-cols-3 items-center gap-2">
          <Label className="text-xs text-muted-foreground">Asset</Label>
          <div className="col-span-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAssetSelect}
              className="w-full justify-start"
            >
              <Icon
                name={(selectedAsset ? getAssetIcon(selectedAsset.mime_type) : 'paperclip') as IconProps['name']}
                className="size-3 mr-0.5"
              />
              {selectedAsset ? selectedAsset.filename : 'Select asset...'}
            </Button>
          </div>
        </div>
      )}

      {/* Page Selection */}
      {linkType === 'page' && (
        <>
          <div className="grid grid-cols-3 items-center gap-2">
            <Label className="text-xs text-muted-foreground">Page</Label>
            <div className="col-span-2">
              <Select
                value={pageId || ''}
                onValueChange={handlePageChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select page" />
                </SelectTrigger>
                <SelectContent>
                  {linkablePages.map((page) => (
                    <SelectItem key={page.id} value={page.id}>
                      <div className="flex items-center gap-2">
                        <Icon
                          name={getPageIcon(page)}
                          className="size-3"
                        />
                        {page.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Collection Item Selection (for dynamic pages) */}
          {isDynamicPage && pageId && (
            <div className="grid grid-cols-3 items-center gap-2">
              <Label className="text-xs text-muted-foreground">CMS item</Label>
              <div className="col-span-2">
                <Select
                  value={collectionItemId || ''}
                  onValueChange={handleCollectionItemChange}
                  disabled={loadingItems}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={loadingItems ? 'Loading...' : 'Select a CMS item'} />
                  </SelectTrigger>
                  <SelectContent>
                    {isDynamicPage && (
                      <SelectItem value="current-page">
                        <div className="flex items-center gap-2">
                          Current page item
                        </div>
                      </SelectItem>
                    )}
                    {canUseCurrentCollectionItem && (
                      <SelectItem value="current-collection">
                        <div className="flex items-center gap-2">
                          Current collection item
                        </div>
                      </SelectItem>
                    )}
                    {(isDynamicPage || canUseCurrentCollectionItem) && <SelectSeparator />}
                    {collectionItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {getItemDisplayName(item.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </>
      )}

      {/* Field Selection */}
      {linkType === 'field' && (
        <div className="grid grid-cols-3 items-center gap-2">
          <Label className="text-xs text-muted-foreground">Field</Label>
          <div className="col-span-2">
            <Select
              value={fieldId || ''}
              onValueChange={handleFieldChange}
              disabled={urlFields.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={urlFields.length === 0 ? 'No URL fields' : 'Select field'}
                />
              </SelectTrigger>
              <SelectContent>
                {urlFields.map((field) => (
                  <SelectItem key={field.id} value={field.id}>
                    {field.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Anchor (for page and URL types) */}
      {(linkType === 'page' || linkType === 'url') && (
        <div className="grid grid-cols-3 items-center gap-2">
          <div className="flex items-center gap-1">
            <Label className="text-xs text-muted-foreground">Anchor</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Icon name="info" className="size-3 text-foreground/80" />
              </TooltipTrigger>
              <TooltipContent>Layers with ID attributes are used as anchors</TooltipContent>
            </Tooltip>
          </div>

          <div className="col-span-2">
            <Select
              value={anchorLayerId || undefined}
              onValueChange={handleAnchorLayerIdChange}
              disabled={anchorLayers.length === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    anchorLayers.length === 0
                      ? 'Page has no anchors'
                      : 'Select anchor'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {anchorLayers.map(({ layer: anchorLayer, id }) => (
                  <SelectItem key={id} value={id}>
                    <div className="flex items-center gap-2">
                      <Icon name={getLayerIcon(anchorLayer)} className="size-3" />
                      <span>{getLayerName(anchorLayer)}</span>
                      <span className="text-xs text-muted-foreground">#{id}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Link Behavior (when link is set) */}
      {linkType !== 'none' && (
        <div className="grid grid-cols-3 gap-2 py-1">
          <div>
            <Label variant="muted">Behavior</Label>
          </div>
          <div className="col-span-2 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="richtext-newTab"
                checked={target === '_blank'}
                onCheckedChange={handleTargetChange}
              />
              <Label
                variant="muted"
                htmlFor="richtext-newTab"
                className="cursor-pointer"
              >
                Open in new tab
              </Label>
            </div>
            {linkType === 'asset' && (
              <div className="flex items-center gap-2">
                <Switch
                  id="richtext-download"
                  checked={download}
                  onCheckedChange={handleDownloadChange}
                />
                <Label
                  variant="muted"
                  htmlFor="richtext-download"
                  className="cursor-pointer"
                >
                  Force download
                </Label>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch
                id="richtext-nofollow"
                checked={rel?.includes('nofollow') || false}
                onCheckedChange={handleNofollowChange}
              />
              <Label
                variant="muted"
                htmlFor="richtext-nofollow"
                className="cursor-pointer"
              >
                No follow
              </Label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
