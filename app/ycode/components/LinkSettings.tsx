'use client';

/**
 * Link Settings Component
 *
 * Settings panel for layer links (URL, email, phone, asset, page, field)
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import Icon, { type IconProps } from '@/components/ui/icon';
import SettingsPanel from './SettingsPanel';
import RichTextEditor from './RichTextEditor';
import { filterFieldGroupsByType, getFieldIcon, LINK_FIELD_TYPES, type FieldGroup } from '@/lib/collection-field-utils';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Layer, CollectionField, Collection, Page, LinkSettings as LinkSettingsType, LinkType, CollectionItemWithValues } from '@/types';
import {
  createDynamicTextVariable,
  getDynamicTextContent,
} from '@/lib/variable-utils';
import { usePagesStore } from '@/stores/usePagesStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useAssetsStore } from '@/stores/useAssetsStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { ASSET_CATEGORIES, getAssetIcon } from '@/lib/asset-utils';
import { toast } from 'sonner';
import { collectionsApi, pagesApi } from '@/lib/api';
import { getLayerIcon, getLayerName, canLayerHaveLink, getCollectionVariable } from '@/lib/layer-utils';
import { getPageIcon } from '@/lib/page-utils';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface LinkSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  /** Field groups with labels and sources for inline variable selection */
  fieldGroups?: FieldGroup[];
  allFields?: Record<string, CollectionField[]>;
  collections?: Collection[];
  isLockedByOther?: boolean;
  isInsideCollectionLayer?: boolean; // Whether fields come from a collection layer (vs page fields)
}

export default function LinkSettings({
  layer,
  onLayerUpdate,
  fieldGroups,
  allFields,
  collections,
  isLockedByOther,
  isInsideCollectionLayer = false,
}: LinkSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);
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
  const linkSettings = layer?.variables?.link;
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
  const fieldSource = linkSettings?.field?.data?.source;
  // Construct select value from source and field_id (e.g., "page-field123" or "collection-field123")
  const fieldSelectValue = fieldId && fieldSource ? `${fieldSource}-${fieldId}` : (fieldId || null);
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

  // Flatten layers and find all layers with attributes.id (faster than recursive traversal)
  const findLayersWithId = useCallback((layers: Layer[]): Array<{ layer: Layer; id: string }> => {
    const result: Array<{ layer: Layer; id: string }> = [];
    const stack: Layer[] = [...layers];

    while (stack.length > 0) {
      const layer = stack.pop()!;

      if (layer.attributes?.id) {
        result.push({ layer, id: layer.attributes.id });
      }

      if (layer.children) {
        stack.push(...layer.children);
      }
    }

    return result;
  }, []);

  // Get layers for anchor selection based on link type
  const anchorLayers = useMemo(() => {
    let targetPageId: string | null = null;

    if (linkType === 'page' && pageId) {
      // For page links, use the selected page
      targetPageId = pageId;
    } else if (linkType === 'url' && currentPageId) {
      // For URL links, use the current page
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

  // Check if the current page is dynamic
  const currentPage = currentPageId ? pages.find(p => p.id === currentPageId) : null;
  const isCurrentPageDynamic = currentPage?.is_dynamic || false;

  // Check if the layer itself is a collection layer
  const isCollectionLayer = !!(layer && getCollectionVariable(layer));

  // Filter fieldGroups for CMS field link: link, email, phone, image (mailto:/tel: added at render for email/phone)
  // Keep groups separate for organized dropdown display
  const linkFieldGroups = useMemo(
    () => filterFieldGroupsByType(fieldGroups, LINK_FIELD_TYPES),
    [fieldGroups]
  );

  // Check if we have collection fields available (from collection layer context)
  // Show current-collection option when inside a collection layer OR when the layer IS a collection layer
  const collectionGroup = fieldGroups?.find(g => g.source === 'collection');
  const hasCollectionFields = !!(collectionGroup && collectionGroup.fields.length > 0 && isInsideCollectionLayer);
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

  // Check if link settings should be disabled due to nesting restrictions
  const linkNestingIssue = useMemo(() => {
    if (!layer || !currentPageId) return null;

    const draft = draftsByPageId[currentPageId];
    if (!draft || !draft.layers) return null;

    // Check if layer can have a layer-level link (includes rich text links check)
    const { canHaveLinks, issue } = canLayerHaveLink(layer, draft.layers);

    // Only show issue if there's no existing link (allow editing existing links)
    if (!canHaveLinks && issue && linkType === 'none') {
      return issue;
    }

    return null;
  }, [layer, currentPageId, draftsByPageId, linkType]);

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
      { value: 'field', label: 'CMS field', icon: 'database', disabled: linkFieldGroups.length === 0 },
      { type: 'separator' },
      { value: 'url', label: 'URL', icon: 'link' },
      { value: 'email', label: 'Email', icon: 'email' },
      { value: 'phone', label: 'Phone', icon: 'phone' },
    ];
  }, [linkFieldGroups]);

  // Update link settings helper
  const updateLinkSettings = useCallback(
    (newSettings: Partial<LinkSettingsType> | null) => {
      if (!layer) return;

      onLayerUpdate(layer.id, {
        variables: {
          ...layer.variables,
          link: newSettings as LinkSettingsType,
        },
      });
    },
    [layer, onLayerUpdate]
  );

  // Handle link type change
  const handleLinkTypeChange = useCallback(
    (newType: LinkType | 'none') => {
      if (!layer) return;

      if (newType === 'none') {
        // Remove link settings
        updateLinkSettings(null);
        return;
      }

      // Create new link settings with the new type
      const newSettings: LinkSettingsType = {
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
          newSettings.field = { type: 'field', data: { field_id: null, relationships: [], field_type: null } };
          break;
      }

      updateLinkSettings(newSettings);
    },
    [layer, updateLinkSettings]
  );

  // Handle URL change
  const handleUrlChange = useCallback(
    (value: string) => {
      if (!layer || !linkSettings) return;

      updateLinkSettings({
        ...linkSettings,
        url: createDynamicTextVariable(value),
      });
    },
    [layer, linkSettings, updateLinkSettings]
  );

  // Handle email change
  const handleEmailChange = useCallback(
    (value: string) => {
      if (!layer || !linkSettings) return;

      updateLinkSettings({
        ...linkSettings,
        email: createDynamicTextVariable(value),
      });
    },
    [layer, linkSettings, updateLinkSettings]
  );

  // Handle phone change
  const handlePhoneChange = useCallback(
    (value: string) => {
      if (!layer || !linkSettings) return;

      updateLinkSettings({
        ...linkSettings,
        phone: createDynamicTextVariable(value),
      });
    },
    [layer, linkSettings, updateLinkSettings]
  );

  // Handle asset selection
  const handleAssetSelect = useCallback(() => {
    if (!layer || !linkSettings) return;

    openFileManager(
      (asset) => {
        updateLinkSettings({
          ...linkSettings,
          asset: { id: asset.id },
        });
      },
      assetId || undefined,
      undefined // All asset types allowed for download
    );
  }, [layer, linkSettings, assetId, openFileManager, updateLinkSettings]);

  // Handle page selection
  const handlePageChange = useCallback(
    (newPageId: string) => {
      if (!layer || !linkSettings) return;

      updateLinkSettings({
        ...linkSettings,
        page: {
          id: newPageId,
          collection_item_id: null, // Reset item when page changes
        },
        anchor_layer_id: null, // Reset anchor when page changes
      });
    },
    [layer, linkSettings, updateLinkSettings]
  );

  // Handle collection item selection
  const handleCollectionItemChange = useCallback(
    (itemId: string) => {
      if (!layer || !linkSettings) return;

      // Map the selection values to the stored values
      let storedValue: string;
      if (itemId === 'current-page') {
        storedValue = 'current-page';
      } else if (itemId === 'current-collection') {
        storedValue = 'current-collection';
      } else {
        storedValue = itemId; // Specific item ID
      }

      updateLinkSettings({
        ...linkSettings,
        page: {
          ...linkSettings.page!,
          collection_item_id: storedValue,
        },
      });
    },
    [layer, linkSettings, updateLinkSettings]
  );

  // Handle field selection (field type is stored for link resolution)
  const handleFieldChange = useCallback(
    (value: string) => {
      if (!layer || !linkSettings) return;

      // Parse source-fieldId format (e.g., "page-field123" -> source: "page", field_id: "field123")
      const parts = value.split('-');
      const source = (parts[0] === 'page' || parts[0] === 'collection') ? parts[0] : undefined;
      const fieldId = source ? parts.slice(1).join('-') : value;

      // Find the field type from linkFieldGroups
      let fieldType: CollectionField['type'] | undefined;
      for (const group of linkFieldGroups) {
        const field = group.fields.find(f => f.id === fieldId);
        if (field) {
          fieldType = field.type;
          break;
        }
      }

      updateLinkSettings({
        ...linkSettings,
        field: {
          type: 'field',
          data: {
            field_id: fieldId,
            relationships: [],
            field_type: fieldType || null,
            ...(source && { source }),
          },
        },
      });
    },
    [layer, linkSettings, updateLinkSettings, linkFieldGroups]
  );

  // Handle anchor layer ID change
  const handleAnchorLayerIdChange = useCallback(
    (value: string) => {
      if (!layer || !linkSettings) return;

      updateLinkSettings({
        ...linkSettings,
        anchor_layer_id: value === 'none' ? null : value,
      });
    },
    [layer, linkSettings, updateLinkSettings]
  );

  // Handle target change
  const handleTargetChange = useCallback(
    (checked: boolean) => {
      if (!layer || !linkSettings) return;

      const newTarget = checked ? '_blank' : '_self';
      // Also add rel="noopener noreferrer" for security when opening in new tab
      const newRel = checked ? 'noopener noreferrer' : '';

      updateLinkSettings({
        ...linkSettings,
        target: newTarget,
        rel: newRel,
      });
    },
    [layer, linkSettings, updateLinkSettings]
  );

  // Handle download change
  const handleDownloadChange = useCallback(
    (checked: boolean) => {
      if (!layer || !linkSettings) return;

      updateLinkSettings({
        ...linkSettings,
        download: checked,
      });
    },
    [layer, linkSettings, updateLinkSettings]
  );

  // Handle nofollow change
  const handleNofollowChange = useCallback(
    (checked: boolean) => {
      if (!layer || !linkSettings) return;

      const currentRel = rel || '';
      const hasNofollow = currentRel.includes('nofollow');
      let newRel = currentRel;

      if (checked && !hasNofollow) {
        newRel = currentRel ? `${currentRel} nofollow` : 'nofollow';
      } else if (!checked && hasNofollow) {
        newRel = currentRel.replace(/\s*nofollow\s*/g, ' ').trim();
      }

      updateLinkSettings({
        ...linkSettings,
        rel: newRel,
      });
    },
    [layer, linkSettings, rel, updateLinkSettings]
  );

  // Get asset info for display
  const selectedAsset = assetId ? getAsset(assetId) : null;

  // Get display name for selected collection item
  const getItemDisplayName = useCallback(
    (itemId: string) => {
      if (itemId === 'current') return 'Current Item';
      const item = collectionItems.find((i) => i.id === itemId);
      if (!item) return itemId;

      // Get fields from store for the page's collection
      const collectionFields = pageCollectionId ? collectionsStoreFields[pageCollectionId] : [];

      // Find the field with key === 'name'
      const nameField = collectionFields?.find((field) => field.key === 'name');
      if (nameField && item.values[nameField.id]) {
        return item.values[nameField.id];
      }

      // Fall back to first available value
      const values = Object.values(item.values);
      return values[0] || itemId;
    },
    [collectionItems, pageCollectionId, collectionsStoreFields]
  );

  if (!layer) return null;

  // Don't show link settings for component layers
  if (layer.componentId) return null;

  // Show empty state if there's a link nesting issue
  if (linkNestingIssue) {
    return (
      <SettingsPanel
        title="Link"
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        <Empty>
          <EmptyDescription>
            {linkNestingIssue.type === 'richText'
              ? 'Cannot add a link to a layer that contains rich text links. Remove the rich text links first.'
              : linkNestingIssue.type === 'ancestor'
                ? `Links cannot be nested. This layer is inside a "${linkNestingIssue.layerName}" layer that already has a link.`
                : 'Links cannot be nested. This layer contains child layers with links.'}
          </EmptyDescription>
        </Empty>
      </SettingsPanel>
    );
  }

  return (
    <SettingsPanel
      title="Link"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="space-y-2">
        {/* Link Type */}
        <div className="grid grid-cols-3 items-center gap-2">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <div className="col-span-2">
            <Select
              value={linkType}
              onValueChange={(value) => handleLinkTypeChange(value as LinkType | 'none')}
              disabled={isLockedByOther}
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
                        disabled={option.disabled || isLockedByOther}
                      >
                        <div className="flex items-center gap-2">
                          <Icon name={option.icon as any} className="size-3" />
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
              <RichTextEditor
                value={urlValue}
                onChange={handleUrlChange}
                placeholder="https://example.com"
                fieldGroups={fieldGroups}
                allFields={allFields}
                collections={collections}
                disabled={isLockedByOther}
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
              <RichTextEditor
                value={emailValue}
                onChange={handleEmailChange}
                placeholder="email@example.com"
                fieldGroups={fieldGroups}
                allFields={allFields}
                collections={collections}
                disabled={isLockedByOther}
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
              <RichTextEditor
                value={phoneValue}
                onChange={handlePhoneChange}
                placeholder="+1234567890"
                fieldGroups={fieldGroups}
                allFields={allFields}
                collections={collections}
                disabled={isLockedByOther}
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
                disabled={isLockedByOther}
                className="w-full justify-start"
              >
                <Icon name={(selectedAsset ? getAssetIcon(selectedAsset.mime_type) : 'paperclip') as IconProps['name']} className="size-3 mr-0.5" />
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
                  disabled={isLockedByOther}
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
                    disabled={isLockedByOther || loadingItems}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={loadingItems ? 'Loading...' : 'Select a CMS item'} />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Current page item option (when on a dynamic page AND linking to a dynamic page) */}
                      {isDynamicPage && isCurrentPageDynamic && (
                        <SelectItem value="current-page">
                          <div className="flex items-center gap-2">
                            Current page item
                          </div>
                        </SelectItem>
                      )}
                      {/* Current collection item option (when inside a collection layer OR when the layer IS a collection layer) */}
                      {canUseCurrentCollectionItem && (
                        <SelectItem value="current-collection">
                          <div className="flex items-center gap-2">
                            Current collection item
                          </div>
                        </SelectItem>
                      )}
                      {((isDynamicPage && isCurrentPageDynamic) || canUseCurrentCollectionItem) && <SelectSeparator />}
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
                value={fieldSelectValue || ''}
                onValueChange={handleFieldChange}
                disabled={isLockedByOther || linkFieldGroups.length === 0}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={linkFieldGroups.length === 0 ? 'No link fields' : 'Select a field'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {linkFieldGroups.map((group, groupIdx) => (
                    <SelectGroup key={groupIdx}>
                      {group.label && <SelectLabel>{group.label}</SelectLabel>}
                      {group.fields.map((field) => (
                        <SelectItem key={`${groupIdx}-${field.id}`} value={`${group.source}-${field.id}`}>
                          <span className="flex items-center gap-2">
                            <Icon name={getFieldIcon(field.type)} className="size-3 text-muted-foreground shrink-0" />
                            {field.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
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
                value={anchorLayerId || 'none'}
                onValueChange={handleAnchorLayerIdChange}
                disabled={isLockedByOther}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select anchor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <div className="flex items-center gap-2">
                      <Icon name="none" className="size-3" />
                      <span>No anchor</span>
                    </div>
                  </SelectItem>
                  {anchorLayers.map(({ layer, id }) => (
                    <SelectItem key={id} value={id}>
                      <div className="flex items-center gap-2">
                        <Icon name={getLayerIcon(layer)} className="size-3" />
                        <span>{getLayerName(layer)}</span>
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
                  id="newTab"
                  checked={target === '_blank'}
                  onCheckedChange={handleTargetChange}
                  disabled={isLockedByOther}
                />
                <Label
                  variant="muted"
                  htmlFor="newTab"
                  className="cursor-pointer"
                >
                  Open in new tab
                </Label>
              </div>
              {linkType === 'asset' && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="download"
                    checked={download}
                    onCheckedChange={handleDownloadChange}
                    disabled={isLockedByOther}
                  />
                  <Label
                    variant="muted"
                    htmlFor="download"
                    className="cursor-pointer"
                  >
                    Force download
                  </Label>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Switch
                  id="nofollow"
                  checked={rel?.includes('nofollow') || false}
                  onCheckedChange={handleNofollowChange}
                  disabled={isLockedByOther}
                />
                <Label
                  variant="muted"
                  htmlFor="nofollow"
                  className="cursor-pointer"
                >
                  No follow
                </Label>
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsPanel>
  );
}
