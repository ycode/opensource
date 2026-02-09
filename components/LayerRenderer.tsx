'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import LayerLockIndicator from '@/components/collaboration/LayerLockIndicator';
import EditingIndicator from '@/components/collaboration/EditingIndicator';
import { useCollaborationPresenceStore, getResourceLockKey, RESOURCE_TYPES } from '@/stores/useCollaborationPresenceStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLocalisationStore } from '@/stores/useLocalisationStore';
import type { Layer, Locale, ComponentVariable, FormSettings, LinkSettings, Breakpoint } from '@/types';
import type { UseLiveLayerUpdatesReturn } from '@/hooks/use-live-layer-updates';
import type { UseLiveComponentUpdatesReturn } from '@/hooks/use-live-component-updates';
import { getLayerHtmlTag, getClassesString, getText, resolveFieldValue, isTextEditable, getCollectionVariable, evaluateVisibility } from '@/lib/layer-utils';
import { resolveFieldFromSources } from '@/lib/cms-variables-utils';
import { getDynamicTextContent, getImageUrlFromVariable, getVideoUrlFromVariable, getIframeUrlFromVariable, isFieldVariable, isAssetVariable, isStaticTextVariable, isDynamicTextVariable, getAssetId, getStaticTextContent, createAssetVariable, createDynamicTextVariable } from '@/lib/variable-utils';
import { getTranslatedAssetId, getTranslatedText } from '@/lib/localisation-utils';
import { isValidLinkSettings } from '@/lib/link-utils';
import { DEFAULT_ASSETS, ASSET_CATEGORIES, isAssetOfType } from '@/lib/asset-utils';
import { parseMultiAssetFieldValue, buildAssetVirtualValues } from '@/lib/multi-asset-utils';
import { MULTI_ASSET_COLLECTION_ID } from '@/lib/collection-field-utils';
import { generateImageSrcset, getImageSizes, getOptimizedImageUrl } from '@/lib/asset-utils';
import { useEditorStore } from '@/stores/useEditorStore';
import { toast } from 'sonner';
import { resolveInlineVariablesFromData } from '@/lib/inline-variables';
import { renderRichText, hasBlockElements, hasBlockElementsWithInlineVariables, getTextStyleClasses, type RichTextLinkContext } from '@/lib/text-format-utils';
import LayerContextMenu from '@/app/ycode/components/LayerContextMenu';
import CanvasTextEditor from '@/app/ycode/components/CanvasTextEditor';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useCollectionLayerStore } from '@/stores/useCollectionLayerStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useAssetsStore } from '@/stores/useAssetsStore';
import { ShimmerSkeleton } from '@/components/ui/shimmer-skeleton';
import { cn } from '@/lib/utils';
import PaginatedCollection from '@/components/PaginatedCollection';
import LoadMoreCollection from '@/components/LoadMoreCollection';
import LocaleSelector from '@/components/layers/LocaleSelector';
import { usePagesStore } from '@/stores/usePagesStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { generateLinkHref, type LinkResolutionContext } from '@/lib/link-utils';
import type { HiddenLayerInfo } from '@/lib/animation-utils';

/**
 * Transform component layers for a specific instance.
 * Generates unique layer IDs by combining the instance layer ID with original layer IDs.
 * Also remaps interaction tween layer_id references to use the new IDs.
 * This ensures each component instance has unique IDs for proper animation targeting.
 */
function transformComponentLayersForInstance(
  layers: Layer[],
  instanceLayerId: string
): Layer[] {
  // Build ID map: original ID -> instance-specific ID
  const idMap = new Map<string, string>();

  // First pass: collect all layer IDs and generate new ones
  const collectIds = (layerList: Layer[]) => {
    for (const layer of layerList) {
      // Create a deterministic instance-specific ID
      const newId = `${instanceLayerId}_${layer.id}`;
      idMap.set(layer.id, newId);
      if (layer.children) {
        collectIds(layer.children);
      }
    }
  };
  collectIds(layers);

  // Second pass: transform layers with new IDs and remapped interactions
  const transformLayer = (layer: Layer): Layer => {
    const newId = idMap.get(layer.id) || layer.id;

    const transformedLayer: Layer = {
      ...layer,
      id: newId,
    };

    // Remap interaction IDs and tween layer_id references
    // Interaction IDs must be unique per instance to prevent timeline caching issues
    if (layer.interactions && layer.interactions.length > 0) {
      transformedLayer.interactions = layer.interactions.map(interaction => ({
        ...interaction,
        id: `${instanceLayerId}_${interaction.id}`,
        tweens: interaction.tweens.map(tween => ({
          ...tween,
          layer_id: idMap.get(tween.layer_id) || tween.layer_id,
        })),
      }));
    }

    // Recursively transform children
    if (layer.children) {
      transformedLayer.children = layer.children.map(transformLayer);
    }

    return transformedLayer;
  };

  return layers.map(transformLayer);
}

/**
 * Build a map of layerId -> anchor value (attributes.id) for O(1) anchor resolution
 * Recursively traverses the layer tree once
 */
function buildAnchorMap(layers: Layer[]): Record<string, string> {
  const map: Record<string, string> = {};

  const traverse = (layerList: Layer[]) => {
    for (const layer of layerList) {
      // Only add to map if layer has a custom id attribute set
      if (layer.attributes?.id) {
        map[layer.id] = layer.attributes.id;
      }
      if (layer.children) {
        traverse(layer.children);
      }
    }
  };

  traverse(layers);
  return map;
}

interface LayerRendererProps {
  layers: Layer[];
  onLayerClick?: (layerId: string, event?: React.MouseEvent) => void;
  onLayerUpdate?: (layerId: string, updates: Partial<Layer>) => void;
  onLayerHover?: (layerId: string | null) => void; // Callback for hover state changes
  selectedLayerId?: string | null;
  hoveredLayerId?: string | null; // Externally controlled hover state
  isEditMode?: boolean;
  isPublished?: boolean;
  enableDragDrop?: boolean;
  activeLayerId?: string | null;
  projected?: { depth: number; parentId: string | null } | null;
  pageId?: string;
  collectionItemData?: Record<string, string>; // Collection layer item field values (field_id -> value)
  collectionItemId?: string; // The ID of the current collection layer item being rendered
  pageCollectionItemId?: string; // The ID of the page's collection item (for dynamic pages)
  pageCollectionItemData?: Record<string, string> | null; // Page's collection item data (for dynamic pages)
  hiddenLayerInfo?: HiddenLayerInfo[]; // Layer IDs with breakpoint info for animations
  editorHiddenLayerIds?: Map<string, Breakpoint[]>; // Layer IDs to hide on canvas (edit mode only) with breakpoint info
  editorBreakpoint?: Breakpoint; // Current breakpoint in editor
  currentLocale?: Locale | null;
  availableLocales?: Locale[];
  localeSelectorFormat?: 'locale' | 'code'; // Format for locale selector label (inherited from parent)
  liveLayerUpdates?: UseLiveLayerUpdatesReturn | null; // For collaboration broadcasts
  liveComponentUpdates?: UseLiveComponentUpdatesReturn | null; // For component collaboration broadcasts
  parentComponentLayerId?: string; // ID of the parent component layer (if rendering inside a component)
  parentComponentOverrides?: Layer['componentOverrides']; // Override values from parent component instance
  parentComponentVariables?: ComponentVariable[]; // Component's variables for default value lookup
  editingComponentVariables?: ComponentVariable[]; // Variables when directly editing a component
  isInsideForm?: boolean; // Whether this layer is inside a form (for button type handling)
  parentFormSettings?: FormSettings; // Form settings from parent form layer
  pages?: any[]; // Pages for link resolution
  folders?: any[]; // Folders for link resolution
  collectionItemSlugs?: Record<string, string>; // Maps collection_item_id -> slug value for link resolution
  isPreview?: boolean; // Whether we're in preview mode (prefix links with /ycode/preview)
  translations?: Record<string, any> | null; // Translations for localized URL generation
  anchorMap?: Record<string, string>; // Pre-built map of layerId -> anchor value for O(1) lookups
  /** Pre-resolved asset URLs (asset_id -> public_url) for SSR link resolution */
  resolvedAssets?: Record<string, string>;
}

const LayerRenderer: React.FC<LayerRendererProps> = ({
  layers,
  onLayerClick,
  onLayerUpdate,
  onLayerHover,
  selectedLayerId,
  hoveredLayerId,
  isEditMode = true,
  isPublished = false,
  enableDragDrop = false,
  activeLayerId = null,
  projected = null,
  pageId = '',
  collectionItemData,
  collectionItemId,
  pageCollectionItemId,
  pageCollectionItemData,
  collectionItemSlugs,
  hiddenLayerInfo,
  editorHiddenLayerIds,
  editorBreakpoint,
  currentLocale,
  availableLocales = [],
  localeSelectorFormat,
  liveLayerUpdates,
  liveComponentUpdates,
  parentComponentLayerId,
  parentComponentOverrides,
  parentComponentVariables,
  editingComponentVariables,
  isInsideForm = false,
  parentFormSettings,
  pages: pagesProp,
  folders: foldersProp,
  isPreview = false,
  translations,
  anchorMap: anchorMapProp,
  resolvedAssets,
}) => {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [editingClickCoords, setEditingClickCoords] = useState<{ x: number; y: number } | null>(null);

  // Get pages and folders for link resolution
  // Use props if provided (SSR/preview), otherwise use store (editor)
  const storePages = usePagesStore((state) => state.pages);
  const storeFolders = usePagesStore((state) => state.folders);
  const pages = pagesProp || storePages;
  const folders = foldersProp || storeFolders;

  // Build anchor map once at top level for O(1) anchor resolution
  // Use prop if provided (recursive calls), otherwise build from layers
  const anchorMap = useMemo(() => {
    return anchorMapProp || buildAnchorMap(layers);
  }, [anchorMapProp, layers]);

  // Helper to render a layer or unwrap fragments
  const renderLayer = (layer: Layer): React.ReactNode => {
    // Fragment layers: render children directly without wrapper element
    if (layer.name === '_fragment' && layer.children) {
      const renderedChildren = layer.children.map((child: Layer) => renderLayer(child));

      // If this fragment has pagination metadata and we're in published mode,
      // wrap it with the appropriate pagination component
      if (layer._paginationMeta && isPublished) {
        // Extract the original layer ID from the fragment ID (remove -fragment suffix)
        const originalLayerId = layer.id.replace(/-fragment$/, '');
        const paginationMode = layer._paginationMeta.mode || 'pages';

        if (paginationMode === 'load_more') {
          // Use LoadMoreCollection for "Load More" mode
          return (
            <Suspense key={layer.id} fallback={<div className="animate-pulse bg-gray-200 rounded h-32" />}>
              <LoadMoreCollection
                paginationMeta={layer._paginationMeta}
                collectionLayerId={originalLayerId}
                itemIds={layer._paginationMeta.itemIds}
                layerTemplate={layer._paginationMeta.layerTemplate}
              >
                {renderedChildren}
              </LoadMoreCollection>
            </Suspense>
          );
        }

        // Default: Use PaginatedCollection for "Pages" mode
        return (
          <Suspense key={layer.id} fallback={<div className="animate-pulse bg-gray-200 rounded h-32" />}>
            <PaginatedCollection
              paginationMeta={layer._paginationMeta}
              collectionLayerId={originalLayerId}
            >
              {renderedChildren}
            </PaginatedCollection>
          </Suspense>
        );
      }

      return renderedChildren;
    }

    return (
      <LayerItem
        key={layer.id}
        layer={layer}
        isEditMode={isEditMode}
        isPublished={isPublished}
        enableDragDrop={enableDragDrop}
        selectedLayerId={selectedLayerId}
        hoveredLayerId={hoveredLayerId}
        activeLayerId={activeLayerId}
        projected={projected}
        onLayerClick={onLayerClick}
        onLayerUpdate={onLayerUpdate}
        onLayerHover={onLayerHover}
        editingLayerId={editingLayerId}
        setEditingLayerId={setEditingLayerId}
        editingContent={editingContent}
        setEditingContent={setEditingContent}
        editingClickCoords={editingClickCoords}
        setEditingClickCoords={setEditingClickCoords}
        pageId={pageId}
        collectionItemData={collectionItemData}
        collectionItemId={collectionItemId}
        pageCollectionItemId={pageCollectionItemId}
        pageCollectionItemData={pageCollectionItemData}
        hiddenLayerInfo={hiddenLayerInfo}
        editorHiddenLayerIds={editorHiddenLayerIds}
        editorBreakpoint={editorBreakpoint}
        currentLocale={currentLocale}
        availableLocales={availableLocales}
        localeSelectorFormat={localeSelectorFormat}
        liveLayerUpdates={liveLayerUpdates}
        liveComponentUpdates={liveComponentUpdates}
        parentComponentLayerId={parentComponentLayerId}
        parentComponentOverrides={parentComponentOverrides}
        parentComponentVariables={parentComponentVariables}
        editingComponentVariables={editingComponentVariables}
        isInsideForm={isInsideForm}
        parentFormSettings={parentFormSettings}
        pages={pages}
        folders={folders}
        collectionItemSlugs={collectionItemSlugs}
        isPreview={isPreview}
        translations={translations}
        anchorMap={anchorMap}
        resolvedAssets={resolvedAssets}
      />
    );
  };

  return (
    <>
      {layers.map((layer) => renderLayer(layer))}
    </>
  );
};

// Separate LayerItem component to handle drag-and-drop per layer
const LayerItem: React.FC<{
  layer: Layer;
  isEditMode: boolean;
  isPublished: boolean;
  enableDragDrop: boolean;
  selectedLayerId?: string | null;
  hoveredLayerId?: string | null;
  activeLayerId?: string | null;
  projected?: { depth: number; parentId: string | null } | null;
  onLayerClick?: (layerId: string, event?: React.MouseEvent) => void;
  onLayerUpdate?: (layerId: string, updates: Partial<Layer>) => void;
  onLayerHover?: (layerId: string | null) => void;
  editingLayerId: string | null;
  setEditingLayerId: (id: string | null) => void;
  editingContent: string;
  setEditingContent: (content: string) => void;
  editingClickCoords: { x: number; y: number } | null;
  setEditingClickCoords: (coords: { x: number; y: number } | null) => void;
  pageId: string;
  collectionItemData?: Record<string, string>;
  collectionItemId?: string; // The ID of the current collection layer item being rendered
  pageCollectionItemId?: string; // The ID of the page's collection item (for dynamic pages)
  pageCollectionItemData?: Record<string, string> | null;
  hiddenLayerInfo?: HiddenLayerInfo[];
  editorHiddenLayerIds?: Map<string, Breakpoint[]>;
  editorBreakpoint?: Breakpoint;
  currentLocale?: Locale | null;
  availableLocales?: Locale[];
  localeSelectorFormat?: 'locale' | 'code';
  liveLayerUpdates?: UseLiveLayerUpdatesReturn | null;
  liveComponentUpdates?: UseLiveComponentUpdatesReturn | null;
  parentComponentLayerId?: string; // ID of the parent component layer (if this layer is inside a component)
  parentComponentOverrides?: Layer['componentOverrides']; // Override values from parent component instance
  parentComponentVariables?: ComponentVariable[]; // Component's variables for default value lookup
  editingComponentVariables?: ComponentVariable[]; // Variables when directly editing a component
  isInsideForm?: boolean; // Whether this layer is inside a form
  parentFormSettings?: FormSettings; // Form settings from parent form layer
  pages?: any[]; // Pages for link resolution
  folders?: any[]; // Folders for link resolution
  collectionItemSlugs?: Record<string, string>; // Maps collection_item_id -> slug value for link resolution
  isPreview?: boolean; // Whether we're in preview mode
  translations?: Record<string, any> | null; // Translations for localized URL generation
  anchorMap?: Record<string, string>; // Pre-built map of layerId -> anchor value
  resolvedAssets?: Record<string, string>;
}> = ({
  layer,
  isEditMode,
  isPublished,
  enableDragDrop,
  selectedLayerId,
  hoveredLayerId,
  activeLayerId,
  projected,
  onLayerClick,
  onLayerUpdate,
  onLayerHover,
  editingLayerId,
  setEditingLayerId,
  editingContent,
  setEditingContent,
  editingClickCoords,
  setEditingClickCoords,
  pageId,
  collectionItemData,
  collectionItemId,
  pageCollectionItemId,
  pageCollectionItemData,
  hiddenLayerInfo,
  editorHiddenLayerIds,
  editorBreakpoint,
  currentLocale,
  availableLocales,
  localeSelectorFormat,
  liveLayerUpdates,
  liveComponentUpdates,
  parentComponentLayerId,
  parentComponentOverrides,
  parentComponentVariables,
  editingComponentVariables,
  isInsideForm = false,
  parentFormSettings,
  pages,
  folders,
  collectionItemSlugs,
  isPreview,
  translations,
  anchorMap,
  resolvedAssets,
}) => {
  const isSelected = selectedLayerId === layer.id;
  const isHovered = hoveredLayerId === layer.id;
  const isEditing = editingLayerId === layer.id;
  const isDragging = activeLayerId === layer.id;
  const textEditable = isTextEditable(layer);

  // Collaboration layer locking - use unified resource lock system
  const currentUserId = useAuthStore((state) => state.user?.id);
  const lockKey = getResourceLockKey(RESOURCE_TYPES.LAYER, layer.id);
  const lock = useCollaborationPresenceStore((state) => state.resourceLocks[lockKey]);
  // Check if locked by another user (only compute when lock exists)
  const isLockedByOther = !!(lock && lock.user_id !== currentUserId && Date.now() <= lock.expires_at);
  const classesString = getClassesString(layer);
  // Collection layer data (from repeaters/loops) - separate from page collection data
  // Use layer's pre-resolved values if present (from SSR), otherwise use prop from parent
  const collectionLayerItemId = layer._collectionItemId || collectionItemId;
  const collectionLayerData = layer._collectionItemValues || collectionItemData;
  const getAssetFromStore = useAssetsStore((state) => state.getAsset);
  const assetsById = useAssetsStore((state) => state.assetsById);
  const timezone = useSettingsStore((state) => state.settingsByKey.timezone as string | null) ?? 'UTC';

  // Create asset resolver that checks pre-resolved assets first (SSR), then falls back to store
  const getAsset = useCallback((id: string) => {
    // Check pre-resolved assets from server first
    if (resolvedAssets?.[id]) {
      return { public_url: resolvedAssets[id] };
    }
    // Fall back to store (may trigger async fetch)
    return getAssetFromStore(id);
  }, [resolvedAssets, getAssetFromStore]);
  const openFileManager = useEditorStore((state) => state.openFileManager);
  const allTranslations = useLocalisationStore((state) => state.translations);
  const editModeTranslations = isEditMode && currentLocale ? allTranslations[currentLocale.id] : null;
  let htmlTag = getLayerHtmlTag(layer);

  // Check if we need to override the tag for rich text with block elements
  // Tags like <p>, <h1>-<h6> cannot contain block elements like <ul>/<ol>
  const textVariable = layer.variables?.text;
  let useSpanForParagraphs = false;

  if (textVariable?.type === 'dynamic_rich_text') {
    const restrictiveBlockTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'button'];
    const isRestrictiveTag = restrictiveBlockTags.includes(htmlTag);
    // Check for lists in direct content AND in inline variables (CMS rich_text fields)
    const hasLists = hasBlockElementsWithInlineVariables(
      textVariable as any,
      collectionLayerData,
      pageCollectionItemData || undefined
    );

    if (isRestrictiveTag && hasLists) {
      // Replace tag with div to allow list elements
      htmlTag = 'div';
    } else if (isRestrictiveTag) {
      // Use span for paragraphs instead of p tags
      useSpanForParagraphs = true;
    }
  }

  // When editing text, CanvasTextEditor wraps content in a <div>
  // So we need to use 'div' as the outer tag to avoid invalid nesting like <p><div>
  if (isEditing && textEditable) {
    htmlTag = 'div';
  }

  // Code Embed iframe ref and effect - must be at component level
  const htmlEmbedIframeRef = React.useRef<HTMLIFrameElement>(null);
  const htmlEmbedCode = layer.name === 'htmlEmbed'
    ? (layer.settings?.htmlEmbed?.code || '<div>Add your custom code here</div>')
    : '';

  // Handle HTML embed iframe initialization and auto-resizing
  useEffect(() => {
    if (layer.name !== 'htmlEmbed' || !htmlEmbedIframeRef.current) return;

    const iframe = htmlEmbedIframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDoc) return;

    // Create a complete HTML document inside iframe
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            margin: 0;
            padding: 0;
            overflow: hidden;
          }
        </style>
      </head>
      <body>
        ${htmlEmbedCode}
      </body>
      </html>
    `);
    iframeDoc.close();

    // Auto-resize iframe to match content height
    const updateHeight = () => {
      if (iframeDoc.body) {
        const height = iframeDoc.body.scrollHeight;
        iframe.style.height = `${height}px`;
      }
    };

    // Initial height update
    updateHeight();

    // Watch for content size changes
    const resizeObserver = new ResizeObserver(updateHeight);
    if (iframeDoc.body) {
      resizeObserver.observe(iframeDoc.body);
    }

    // Fallback: Update height periodically for dynamic content
    const interval = setInterval(updateHeight, 100);

    return () => {
      resizeObserver.disconnect();
      clearInterval(interval);
    };
  }, [htmlEmbedCode, layer.name]);

  // Resolve text and image URLs with field binding support
  const textContent = (() => {
    // Special handling for locale selector label
    if (layer.key === 'localeSelectorLabel' && !isEditMode) {
      // Get default locale if no locale is detected
      const defaultLocale = availableLocales?.find(l => l.is_default) || availableLocales?.[0];
      const displayLocale = currentLocale || defaultLocale;

      // Fallback if no locale data available
      if (!displayLocale) {
        return 'English';
      }

      // Use format from parent localeSelector layer (passed as prop)
      const format = localeSelectorFormat || 'locale';
      return format === 'code' ? displayLocale.code.toUpperCase() : displayLocale.label;
    }

    // Build link context for resolving page/asset/field links in rich text
    // Skip building context in edit mode since links are disabled and use '#'
    const linkContext: RichTextLinkContext | undefined = isEditMode
      ? undefined
      : {
        pages,
        folders,
        collectionItemSlugs,
        collectionItemId: collectionLayerItemId,
        pageCollectionItemId,
        isPreview,
        locale: currentLocale,
        translations,
        getAsset,
        anchorMap,
        resolvedAssets,
      };

    // Check for component variable override or default value
    // This handles both:
    // 1. Component instances on a page (parentComponentVariables is set)
    // 2. Directly editing a component (editingComponentVariables is set)
    const componentVariables = parentComponentVariables || editingComponentVariables;
    const linkedVariableId = textVariable?.id;
    if (linkedVariableId && componentVariables) {
      // Check for override value first (only when viewing an instance, not when editing component)
      const overrideValue = parentComponentOverrides?.text?.[linkedVariableId];
      const variableDef = componentVariables.find(v => v.id === linkedVariableId);
      const valueToRender = overrideValue ?? variableDef?.default_value;

      if (valueToRender !== undefined) {
        // Value is typed as ComponentVariableValue - check if it's a text variable (has 'type' property)
        if ('type' in valueToRender && valueToRender.type === 'dynamic_rich_text') {
          return renderRichText(valueToRender as any, collectionLayerData, pageCollectionItemData || undefined, layer.textStyles, useSpanForParagraphs, isEditMode, linkContext, timezone);
        }
        if ('type' in valueToRender && valueToRender.type === 'dynamic_text') {
          return (valueToRender as any).data.content;
        }
      }

      // Variable is linked but has no default value - return empty string (don't fall through to layer's text)
      return '';
    }

    // Check for DynamicRichTextVariable format (with formatting)
    if (textVariable?.type === 'dynamic_rich_text') {
      // Render rich text with formatting (bold, italic, etc.) and inline variables
      // In edit mode, adds data-style attributes for style selection
      return renderRichText(textVariable as any, collectionLayerData, pageCollectionItemData || undefined, layer.textStyles, useSpanForParagraphs, isEditMode, linkContext, timezone);
    }

    // Check for inline variables in DynamicTextVariable format (legacy)
    if (textVariable?.type === 'dynamic_text') {
      const content = textVariable.data.content;
      if (content.includes('<ycode-inline-variable>')) {
        // Resolve inline variables with timezone-aware date formatting
        return resolveInlineVariablesFromData(content, collectionLayerData, pageCollectionItemData ?? undefined, timezone);
      }
      // No inline variables, return plain content
      return content;
    }
    const text = getText(layer);
    if (text) return text;
    return undefined;
  })();

  // Resolve image source - check for linked component variable first
  const componentVariables = parentComponentVariables || editingComponentVariables;
  const linkedImageVariableId = (layer.variables?.image?.src as any)?.id;

  // Get effective image settings (from component variable or layer)
  const effectiveImageSettings = (() => {
    if (linkedImageVariableId && componentVariables) {
      // Check for override value first (only when viewing an instance)
      const overrideValue = parentComponentOverrides?.image?.[linkedImageVariableId];
      const variableDef = componentVariables.find(v => v.id === linkedImageVariableId);
      const valueToUse = overrideValue ?? variableDef?.default_value;

      // ImageSettingsValue has src, alt, width, height, loading
      if (valueToUse && typeof valueToUse === 'object' && 'src' in valueToUse) {
        return valueToUse as { src?: any; alt?: any; width?: string; height?: string; loading?: string };
      }
    }
    // Fall back to layer's image settings
    return layer.variables?.image;
  })();

  // Get image asset ID and apply translation if available
  const originalImageAssetId = effectiveImageSettings?.src?.type === 'asset'
    ? effectiveImageSettings.src.data?.asset_id
    : undefined;
  const translatedImageAssetId = getTranslatedAssetId(
    originalImageAssetId || undefined,
    `layer:${layer.id}:image_src`,
    translations,
    pageId,
    layer._masterComponentId
  );

  // Build image variable with translated asset ID
  const imageVariable = originalImageAssetId && translatedImageAssetId && translatedImageAssetId !== originalImageAssetId
    ? { ...effectiveImageSettings?.src, type: 'asset' as const, data: { asset_id: translatedImageAssetId } }
    : effectiveImageSettings?.src;

  const imageUrl = getImageUrlFromVariable(
    imageVariable,
    getAsset,
    collectionLayerData,
    pageCollectionItemData
  );

  // Get image alt text and apply translation if available
  const originalImageAlt = getDynamicTextContent(effectiveImageSettings?.alt) || 'Image';
  const translatedImageAlt = getTranslatedText(
    originalImageAlt,
    `layer:${layer.id}:image_alt`,
    translations,
    pageId,
    layer._masterComponentId
  ) || 'Image';
  const imageAlt = translatedImageAlt;

  // Handle component instances - only fetch from store in edit mode
  // In published pages, components are pre-resolved server-side via resolveComponents()
  const getComponentById = useComponentsStore((state) => state.getComponentById);
  const component = (isEditMode && layer.componentId) ? getComponentById(layer.componentId) : null;

  // Transform component layers for this instance to ensure unique IDs per instance
  // This enables animations to target the correct elements when multiple instances exist
  const transformedComponentLayers = useMemo(() => {
    if (isEditMode && component && component.layers && component.layers.length > 0) {
      return transformComponentLayersForInstance(component.layers, layer.id);
    }
    return null;
  }, [isEditMode, component, layer.id]);

  const collectionVariable = getCollectionVariable(layer);
  const isCollectionLayer = !!collectionVariable;
  const collectionId = collectionVariable?.id;
  const sourceFieldId = collectionVariable?.source_field_id;
  const sourceFieldType = collectionVariable?.source_field_type;
  const layerData = useCollectionLayerStore((state) => state.layerData[layer.id]);
  const isLoadingLayerData = useCollectionLayerStore((state) => state.loading[layer.id]);
  const fetchLayerData = useCollectionLayerStore((state) => state.fetchLayerData);
  const fieldsByCollectionId = useCollectionsStore((state) => state.fields);
  const allCollectionItems = React.useMemo(() => layerData || [], [layerData]);

  // Get the source for multi-asset field resolution
  const sourceFieldSource = collectionVariable?.source_field_source;

  // Resolve multi-asset source field by id from store (for empty state message)
  const multiAssetSourceField = React.useMemo(() => {
    if (sourceFieldType !== 'multi_asset' || !sourceFieldId) return null;
    const allFields = Object.values(fieldsByCollectionId).flat();
    return allFields.find((f) => f.id === sourceFieldId) ?? null;
  }, [sourceFieldType, sourceFieldId, fieldsByCollectionId]);

  // Filter items by reference field if source_field_id is set
  // Single reference: get the one referenced item (no loop, just context)
  // Multi-reference: filter to items in the array (loops through all)
  // Multi-asset: build virtual items from asset IDs
  const collectionItems = React.useMemo(() => {
    // Handle multi-asset: build virtual items from assets
    if (sourceFieldType === 'multi_asset' && sourceFieldId) {
      // Get the field value from the correct source (page or collection)
      const fieldValue = sourceFieldSource === 'page'
        ? pageCollectionItemData?.[sourceFieldId]
        : collectionLayerData?.[sourceFieldId];

      const assetIds = parseMultiAssetFieldValue(fieldValue);
      if (assetIds.length === 0) return [];

      // Build virtual collection items from assets
      return assetIds.map(assetId => {
        const asset = getAsset(assetId);
        // Check if it's a full Asset object or just a URL placeholder
        const isFullAsset = asset && 'filename' in asset;
        const virtualValues = isFullAsset ? buildAssetVirtualValues(asset) : {};
        return {
          id: assetId,
          collection_id: MULTI_ASSET_COLLECTION_ID,
          manual_order: 0,
          created_at: '',
          updated_at: '',
          deleted_at: null,
          is_published: true,
          values: virtualValues,
        };
      });
    }

    if (!sourceFieldId) {
      return allCollectionItems;
    }

    // Get the reference field value using source-aware resolution
    const refValue = resolveFieldFromSources(sourceFieldId, undefined, collectionLayerData, pageCollectionItemData);
    if (!refValue) return [];

    // Handle single reference: value is just an item ID string
    if (sourceFieldType === 'reference') {
      // Find the single referenced item by ID
      const singleItem = allCollectionItems.find(item => item.id === refValue);
      return singleItem ? [singleItem] : [];
    }

    // Handle multi-reference: value is a JSON array of item IDs
    try {
      const allowedIds = JSON.parse(refValue);
      if (!Array.isArray(allowedIds)) return [];

      // Filter to only items whose IDs are in the multi-reference array
      return allCollectionItems.filter(item => allowedIds.includes(item.id));
    } catch {
      return [];
    }
  }, [allCollectionItems, sourceFieldId, sourceFieldType, sourceFieldSource, collectionLayerData, pageCollectionItemData, getAsset]);

  useEffect(() => {
    if (!isEditMode) return;
    if (!collectionVariable?.id) return;
    // Skip fetching for multi-asset collections (they don't have real collection data)
    if (collectionVariable.source_field_type === 'multi_asset') return;
    if (collectionVariable.id === MULTI_ASSET_COLLECTION_ID) return;
    if (allCollectionItems.length > 0 || isLoadingLayerData) return;

    fetchLayerData(
      layer.id,
      collectionVariable.id,
      collectionVariable.sort_by,
      collectionVariable.sort_order,
      collectionVariable.limit,
      collectionVariable.offset
    );
  }, [
    isEditMode,
    collectionVariable?.id,
    collectionVariable?.source_field_type,
    collectionVariable?.sort_by,
    collectionVariable?.sort_order,
    collectionVariable?.limit,
    collectionVariable?.offset,
    allCollectionItems.length,
    isLoadingLayerData,
    fetchLayerData,
    layer.id,
  ]);

  // For component instances in edit mode, use the component's layers as children
  // For published pages, children are already resolved server-side
  const children = (isEditMode && component && component.layers) ? component.layers : layer.children;

  // Use sortable for drag and drop
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: layer.id,
    disabled: !enableDragDrop || isEditing || isLockedByOther,
    data: {
      layer,
    },
  });

  const startEditing = (clickX?: number, clickY?: number) => {
    // Enable inline editing for text layers (both rich text and plain text)
    if (textEditable && isEditMode && !isLockedByOther) {
      setEditingLayerId(layer.id);
      // Store click coordinates if provided
      if (typeof clickX === 'number' && typeof clickY === 'number') {
        setEditingClickCoords({ x: clickX, y: clickY });
      } else {
        setEditingClickCoords(null);
      }
      // For rich text, pass the Tiptap JSON content; for plain text, pass string
      const textVar = layer.variables?.text;
      if (textVar?.type === 'dynamic_rich_text') {
        setEditingContent(JSON.stringify(textVar.data.content));
      } else {
        setEditingContent(typeof textContent === 'string' ? textContent : '');
      }
    }
  };

  // Open file manager for image layers on double-click
  const openImageFileManager = useCallback(() => {
    if (!isEditMode || isLockedByOther || !onLayerUpdate) return;

    // Get current asset ID for highlighting in file manager
    const currentAssetId = isAssetVariable(layer.variables?.image?.src)
      ? getAssetId(layer.variables?.image?.src)
      : null;

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

        // Update layer with new image asset
        onLayerUpdate(layer.id, {
          variables: {
            ...layer.variables,
            image: {
              src: createAssetVariable(asset.id),
              alt: layer.variables?.image?.alt || createDynamicTextVariable(''),
            },
          },
        });
      },
      currentAssetId,
      [ASSET_CATEGORIES.IMAGES, ASSET_CATEGORIES.ICONS]
    );
  }, [isEditMode, isLockedByOther, onLayerUpdate, layer, openFileManager]);

  const finishEditing = useCallback(() => {
    if (editingLayerId === layer.id) {
      setEditingLayerId(null);
    }
  }, [editingLayerId, layer.id, setEditingLayerId]);

  // Handle content change from CanvasTextEditor
  const handleEditorChange = useCallback((newContent: any) => {
    if (!onLayerUpdate) return;

    // Use callback form to ensure we get the latest layer data
    const updates: Partial<Layer> = {
      variables: {
        ...layer.variables,
        text: {
          type: 'dynamic_rich_text',
          data: { content: newContent },
        },
      },
    };

    onLayerUpdate(layer.id, updates);
  }, [layer.id, layer.variables, onLayerUpdate]);

  const style = enableDragDrop ? {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  } : undefined;

  // Show projection indicator if this is being dragged over
  const showProjection = projected && activeLayerId && activeLayerId !== layer.id;

  // Build className with editor states if in edit mode
  // Use cn() for cleaner conditional class handling and automatic conflict resolution
  // When layer tag is p and has text, add paragraph default classes (block, margin) so the wrapper displays correctly
  const paragraphClasses = htmlTag === 'p' && layer.variables?.text
    ? getTextStyleClasses(layer.textStyles, 'paragraph')
    : '';

  const fullClassName = isEditMode ? cn(
    classesString,
    paragraphClasses,
    enableDragDrop && !isEditing && !isLockedByOther && 'cursor-default',
    // Selection/hover outlines are now rendered by SelectionOverlay component (outside iframe)
    isDragging && 'opacity-30',
    showProjection && 'outline outline-1 outline-dashed outline-blue-400 bg-blue-50/10',
    isLockedByOther && 'opacity-90 pointer-events-none select-none',
    // Add ycode-layer class for editor styling
    'ycode-layer'
  ) : cn(classesString, paragraphClasses);

  // Check if layer should be hidden (hide completely in both edit mode and public pages)
  if (layer.settings?.hidden) {
    return null;
  }

  // Evaluate conditional visibility (only in edit mode - SSR handles published pages)
  const conditionalVisibility = layer.variables?.conditionalVisibility;
  if (isEditMode && conditionalVisibility && conditionalVisibility.groups?.length > 0) {
    // Build page collection counts from the store
    const pageCollectionCounts: Record<string, number> = {};
    conditionalVisibility.groups.forEach(group => {
      group.conditions?.forEach(condition => {
        if (condition.source === 'page_collection' && condition.collectionLayerId) {
          // Use the layerData from the store for collection counts
          const storeData = useCollectionLayerStore.getState().layerData[condition.collectionLayerId];
          pageCollectionCounts[condition.collectionLayerId] = storeData?.length ?? 0;
        }
      });
    });

    const isVisible = evaluateVisibility(conditionalVisibility, {
      collectionLayerData,
      pageCollectionData: pageCollectionItemData,
      pageCollectionCounts,
    });
    if (!isVisible) {
      return null;
    }
  }

  // Render element-specific content
  const renderContent = () => {
    // Component instances in EDIT MODE: render component's layers directly without wrapper
    // In published mode, components are already resolved server-side into children, so render normally
    if (transformedComponentLayers && transformedComponentLayers.length > 0) {
      return (
        <LayerRenderer
          layers={transformedComponentLayers}
          onLayerClick={onLayerClick}
          onLayerUpdate={onLayerUpdate}
          onLayerHover={onLayerHover}
          selectedLayerId={selectedLayerId}
          hoveredLayerId={hoveredLayerId}
          isEditMode={isEditMode}
          isPublished={isPublished}
          enableDragDrop={enableDragDrop}
          activeLayerId={activeLayerId}
          projected={projected}
          pageId={pageId}
          collectionItemData={collectionLayerData}
          collectionItemId={collectionLayerItemId}
          pageCollectionItemId={pageCollectionItemId}
          pageCollectionItemData={pageCollectionItemData}
          hiddenLayerInfo={hiddenLayerInfo}
          editorHiddenLayerIds={editorHiddenLayerIds}
          editorBreakpoint={editorBreakpoint}
          currentLocale={currentLocale}
          availableLocales={availableLocales}
          localeSelectorFormat={localeSelectorFormat}
          liveLayerUpdates={liveLayerUpdates}
          liveComponentUpdates={liveComponentUpdates}
          parentComponentLayerId={layer.id}
          parentComponentOverrides={layer.componentOverrides}
          parentComponentVariables={component?.variables}
          isInsideForm={isInsideForm}
          parentFormSettings={parentFormSettings}
          pages={pages}
          folders={folders}
          collectionItemSlugs={collectionItemSlugs}
          isPreview={isPreview}
          translations={translations}
          anchorMap={anchorMap}
          resolvedAssets={resolvedAssets}
        />
      );
    }

    const Tag = htmlTag as any;
    const { style: attrStyle, ...otherAttributes } = layer.attributes || {};

    // Map HTML attributes to React JSX equivalents
    const htmlToJsxAttrMap: Record<string, string> = {
      'for': 'htmlFor',
      'class': 'className',
    };

    // Convert string boolean values to actual booleans and map HTML attrs to JSX
    const normalizedAttributes = Object.fromEntries(
      Object.entries(otherAttributes).map(([key, value]) => {
        // Map HTML attribute names to JSX equivalents
        const jsxKey = htmlToJsxAttrMap[key] || key;

        // If value is already a boolean, keep it
        if (typeof value === 'boolean') {
          return [jsxKey, value];
        }
        // If value is a string that looks like a boolean, convert it
        if (typeof value === 'string') {
          if (value === 'true') {
            return [jsxKey, true];
          }
          if (value === 'false') {
            return [jsxKey, false];
          }
        }
        // For all other values, keep them as-is
        return [jsxKey, value];
      })
    );

    // Parse style string to object if needed (for display: contents from collection wrappers)
    const parsedAttrStyle = typeof attrStyle === 'string'
      ? Object.fromEntries(
        attrStyle.split(';')
          .filter(Boolean)
          .map(rule => {
            const [prop, val] = rule.split(':').map(s => s.trim());
            // Convert kebab-case to camelCase for React
            const camelProp = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            return [camelProp, val];
          })
      )
      : attrStyle;

    // Merge styles: base style + attribute style
    const mergedStyle = { ...style, ...parsedAttrStyle };

    // Check if element is truly empty (no text, no children)
    const isEmpty = !textContent && (!children || children.length === 0);

    // Check if this is the Body layer (locked)
    const isLocked = layer.id === 'body';

    // Build props for the element
    const elementProps: Record<string, unknown> = {
      ref: setNodeRef,
      className: fullClassName,
      style: mergedStyle,
      'data-layer-id': layer.id,
      'data-layer-type': htmlTag,
      'data-is-empty': isEmpty ? 'true' : 'false',
      ...(enableDragDrop && !isEditing && !isLockedByOther ? { ...normalizedAttributes, ...listeners } : normalizedAttributes),
    };

    // Add data-gsap-hidden attribute for elements that should start hidden
    const hiddenInfo = hiddenLayerInfo?.find(info => info.layerId === layer.id);
    if (hiddenInfo) {
      // Set breakpoints as value (e.g., "mobile" or "mobile tablet") or empty for all
      elementProps['data-gsap-hidden'] = hiddenInfo.breakpoints || '';
    }

    // Handle alert elements (for form success/error messages)
    if (layer.alertType) {
      elementProps['data-alert-type'] = layer.alertType;
    }

    // Hide elements with hiddenGenerated: true by default (in all modes)
    if (layer.hiddenGenerated) {
      const existingStyle = typeof elementProps.style === 'object' ? elementProps.style : {};
      elementProps.style = { ...existingStyle, display: 'none' };
    }

    // Hide elements that have display: hidden animation with on-load apply style (edit mode only)
    // Show them when selected or when a child is selected
    // Only hide on the breakpoints the animation applies to
    if (isEditMode && editorHiddenLayerIds?.has(layer.id)) {
      const hiddenBreakpoints = editorHiddenLayerIds.get(layer.id) || [];
      // Empty array means all breakpoints, otherwise check if current breakpoint matches
      const shouldHideOnBreakpoint = hiddenBreakpoints.length === 0 ||
        (editorBreakpoint && hiddenBreakpoints.includes(editorBreakpoint));

      if (shouldHideOnBreakpoint) {
        const isSelectedOrChildSelected = isSelected || (selectedLayerId && (() => {
          // Check if selectedLayerId is a descendant of this layer
          const checkDescendants = (children: Layer[] | undefined): boolean => {
            if (!children) return false;
            for (const child of children) {
              if (child.id === selectedLayerId) return true;
              if (checkDescendants(child.children)) return true;
            }
            return false;
          };
          return checkDescendants(layer.children);
        })());

        if (!isSelectedOrChildSelected) {
          const existingStyle = typeof elementProps.style === 'object' ? elementProps.style : {};
          elementProps.style = { ...existingStyle, display: 'none' };
        }
      }
    }

    // Apply custom ID from settings or attributes
    if (layer.settings?.id) {
      elementProps.id = layer.settings.id;
    } else if (layer.attributes?.id) {
      elementProps.id = layer.attributes.id;
    }

    // Apply custom attributes from settings
    if (layer.settings?.customAttributes) {
      Object.entries(layer.settings.customAttributes).forEach(([name, value]) => {
        elementProps[name] = value;
      });
    }

    // Add editor event handlers if in edit mode (but not for context menu trigger)
    if (isEditMode && !isEditing) {
      const originalOnClick = elementProps.onClick as ((e: React.MouseEvent) => void) | undefined;
      elementProps.onClick = (e: React.MouseEvent) => {
        // Block click if locked by another user
        if (isLockedByOther) {
          e.stopPropagation();
          e.preventDefault();
          console.warn(`Layer ${layer.id} is locked by another user`);
          return;
        }
        // Only handle if not a context menu trigger
        if (e.button !== 2) {
          e.stopPropagation();
          // Prevent default behavior for labels (which would focus the associated input)
          if (htmlTag === 'label') {
            e.preventDefault();
          }
          // If this layer is inside a component, select the component layer instead
          const layerIdToSelect = parentComponentLayerId || layer.id;

          onLayerClick?.(layerIdToSelect, e);
        }
        if (originalOnClick) {
          originalOnClick(e);
        }
      };
      elementProps.onDoubleClick = (e: React.MouseEvent) => {
        if (isLockedByOther) return;
        e.stopPropagation();

        // Image layers: open file manager for quick image replacement
        if (layer.name === 'image' || htmlTag === 'img') {
          openImageFileManager();
          return;
        }

        // Text-editable layers: start inline editing
        startEditing(e.clientX, e.clientY);
      };
      // Prevent context menu from bubbling
      elementProps.onContextMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
      };
      // Hover handlers for explicit hover state management
      if (onLayerHover) {
        elementProps.onMouseEnter = (e: React.MouseEvent) => {
          e.stopPropagation();
          if (!isEditing && !isLockedByOther && layer.id !== 'body') {
            // If this layer is inside a component, hover the component layer instead
            const layerIdToHover = parentComponentLayerId || layer.id;
            onLayerHover(layerIdToHover);
          }
        };
        elementProps.onMouseLeave = (e: React.MouseEvent) => {
          // Don't stop propagation - allow parent to detect mouse entry
          // Use the event target's owner document (iframe's document) to query within iframe
          const doc = (e.currentTarget as HTMLElement).ownerDocument;
          if (!doc) {
            onLayerHover(null);
            return;
          }

          const { clientX, clientY } = e;
          const elementUnderMouse = doc.elementFromPoint(clientX, clientY);

          if (elementUnderMouse) {
            // Use closest() to traverse up the DOM tree to find the actual layer element
            // This ensures we get the correct layer even if cursor is over a deeply nested child
            const targetLayerElement = elementUnderMouse.closest('[data-layer-id]') as HTMLElement | null;
            if (targetLayerElement) {
              const targetLayerId = targetLayerElement.getAttribute('data-layer-id');
              // Only set hover if it's a different layer (not the one we're leaving)
              if (targetLayerId && targetLayerId !== layer.id && targetLayerId !== 'body') {
                onLayerHover(targetLayerId);
                return;
              }
            }
          }

          // Not moving to a layer (or moving outside canvas) - clear hover
          onLayerHover(null);
        };
      }
    }

    // Handle special cases for void/self-closing elements
    if (htmlTag === 'img') {
      // Use default image if URL is empty or invalid
      const finalImageUrl = imageUrl && imageUrl.trim() !== '' ? imageUrl : DEFAULT_ASSETS.IMAGE;

      // Generate optimized src and srcset for responsive images
      const optimizedSrc = getOptimizedImageUrl(finalImageUrl, 1200, 1200, 85);
      const srcset = generateImageSrcset(finalImageUrl);
      const sizes = getImageSizes();

      const imageProps: Record<string, any> = {
        ...elementProps,
        alt: imageAlt,
        src: optimizedSrc,
      };

      if (srcset) {
        imageProps.srcSet = srcset;
        imageProps.sizes = sizes;
      }

      return (
        <Tag {...imageProps} />
      );
    }

    if (htmlTag === 'hr' || htmlTag === 'br') {
      return <Tag {...elementProps} />;
    }

    if (htmlTag === 'input') {
      // Auto-set name attribute for form inputs if not already set
      if (isInsideForm && !elementProps.name) {
        elementProps.name = layer.settings?.id || layer.id;
      }
      return <Tag {...elementProps} />;
    }

    // Handle textarea - auto-set name for form submission and return early (no children)
    if (htmlTag === 'textarea') {
      if (isInsideForm && !elementProps.name) {
        elementProps.name = layer.settings?.id || layer.id;
      }
      return <Tag {...elementProps} />;
    }

    // Handle select - auto-set name for form submission
    if (htmlTag === 'select') {
      if (isInsideForm && !elementProps.name) {
        elementProps.name = layer.settings?.id || layer.id;
      }
    }

    // Handle button inside form - set type="submit" only when not in edit mode (preview and published)
    if (htmlTag === 'button' && isInsideForm && !isEditMode) {
      // Only override if type is not explicitly set or is 'button'
      if (!normalizedAttributes.type || normalizedAttributes.type === 'button') {
        elementProps.type = 'submit';
      }
    }

    // Block form submission in edit mode
    if (htmlTag === 'form' && isEditMode) {
      elementProps.onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
      };
    }

    // Handle form submission when not in edit mode (preview and published)
    if (htmlTag === 'form' && !isEditMode) {
      const formId = layer.settings?.id;
      const formSettings = layer.settings?.form;

      elementProps.onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const form = e.currentTarget;
        const formData = new FormData(form);
        const payload: Record<string, any> = {};

        // Convert FormData to object
        formData.forEach((value, key) => {
          // Handle multiple values (e.g., checkboxes with same name)
          if (payload[key]) {
            if (Array.isArray(payload[key])) {
              payload[key].push(value);
            } else {
              payload[key] = [payload[key], value];
            }
          } else {
            payload[key] = value;
          }
        });

        try {
          const response = await fetch('/ycode/api/form-submissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              form_id: formId || 'unnamed-form',
              payload,
              metadata: {
                page_url: typeof window !== 'undefined' ? window.location.href : undefined,
              },
              webhook: formSettings?.webhook_notification,
              email: formSettings?.email_notification,
            }),
          });

          const result = await response.json();

          // Find alert elements within the form
          const errorAlert = form.querySelector('[data-alert-type="error"]') as HTMLElement | null;
          const successAlert = form.querySelector('[data-alert-type="success"]') as HTMLElement | null;

          // Hide both alerts first
          if (errorAlert) errorAlert.style.display = 'none';
          if (successAlert) successAlert.style.display = 'none';

          if (response.ok) {
            // Success handling
            const successAction = formSettings?.success_action || 'message';

            if (successAction === 'redirect' && formSettings?.redirect_url) {
              // Redirect to the specified URL
              window.location.href = formSettings.redirect_url;
            } else {
              // Show success alert
              if (successAlert) {
                successAlert.style.display = '';
              }
            }
            // Reset the form
            form.reset();
          } else {
            // Error handling - show error alert
            if (errorAlert) {
              errorAlert.style.display = '';
            }
          }
        } catch (error) {
          console.error('Form submission error:', error);
          // Show error alert on catch
          const errorAlert = form.querySelector('[data-alert-type="error"]') as HTMLElement | null;
          if (errorAlert) {
            errorAlert.style.display = '';
          }
        }
      };
    }

    // Handle icon layers (check layer.name, not htmlTag since settings.tag might be 'div')
    if (layer.name === 'icon') {
      const iconSrc = layer.variables?.icon?.src;
      let iconHtml = '';

      if (iconSrc) {
        if (isStaticTextVariable(iconSrc)) {
          iconHtml = getStaticTextContent(iconSrc);
        } else if (isDynamicTextVariable(iconSrc)) {
          iconHtml = getDynamicTextContent(iconSrc);
        } else if (isAssetVariable(iconSrc)) {
          const originalAssetId = iconSrc.data?.asset_id;
          if (originalAssetId) {
            // Apply translation if available
            const translatedAssetId = getTranslatedAssetId(
              originalAssetId,
              `layer:${layer.id}:icon_src`,
              translations,
              pageId,
              layer._masterComponentId
            );
            const assetId = translatedAssetId || originalAssetId;

            // Check assetsById first (reactive) then getAsset (may trigger fetch)
            const asset = assetsById[assetId] || getAsset(assetId);
            iconHtml = asset?.content || '';
          }
        } else if (isFieldVariable(iconSrc)) {
          const resolvedValue = resolveFieldValue(iconSrc, collectionLayerData, pageCollectionItemData);
          if (resolvedValue && typeof resolvedValue === 'string') {
            // Try to get as asset first (field contains asset ID)
            const asset = assetsById[resolvedValue] || getAsset(resolvedValue);
            // Use asset content if available, otherwise treat as raw SVG code
            iconHtml = asset?.content || resolvedValue;
          }
        }
      }

      // If no valid icon content, show default icon
      if (!iconHtml || iconHtml.trim() === '') {
        iconHtml = DEFAULT_ASSETS.ICON;
      }

      return (
        <Tag
          {...elementProps}
          data-icon="true"
          dangerouslySetInnerHTML={{ __html: iconHtml }}
        />
      );
    }

    // Handle Code Embed layers - Framer-style iframe isolation
    if (layer.name === 'htmlEmbed') {
      return (
        <iframe
          ref={htmlEmbedIframeRef}
          data-layer-id={layer.id}
          data-layer-type="htmlEmbed"
          data-html-embed="true"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          className={fullClassName}
          style={{
            width: '100%',
            border: 'none',
            display: 'block',
            ...mergedStyle,
          }}
          title={`Code Embed ${layer.id}`}
        />
      );
    }

    if (htmlTag === 'video' || htmlTag === 'audio') {
      // Check if this is a YouTube video (VideoVariable type)
      if (htmlTag === 'video' && layer.variables?.video?.src) {
        const videoSrc = layer.variables.video.src;

        // YouTube video - render as iframe
        if (videoSrc.type === 'video' && 'provider' in videoSrc.data && videoSrc.data.provider === 'youtube') {
          const rawVideoId = videoSrc.data.video_id || '';
          // Resolve inline variables in video ID (supports CMS binding)
          const videoId = resolveInlineVariablesFromData(rawVideoId, collectionLayerData, pageCollectionItemData, timezone);
          // Use normalized attributes for consistency (already handles string/boolean conversion)
          const privacyMode = normalizedAttributes?.youtubePrivacyMode === true;
          const domain = privacyMode ? 'youtube-nocookie.com' : 'youtube.com';

          // Build YouTube embed URL with parameters
          const params: string[] = [];
          if (normalizedAttributes?.autoplay === true) params.push('autoplay=1');
          if (normalizedAttributes?.muted === true) params.push('mute=1');
          if (normalizedAttributes?.loop === true) params.push(`loop=1&playlist=${videoId}`);
          if (normalizedAttributes?.controls !== true) params.push('controls=0');

          const embedUrl = `https://www.${domain}/embed/${videoId}${params.length > 0 ? '?' + params.join('&') : ''}`;

          // Create iframe props - only include essential props to avoid hydration mismatches
          // Don't spread elementProps as it may contain client-only handlers
          const iframeProps: Record<string, any> = {
            'data-layer-id': layer.id,
            'data-layer-type': 'video',
            className: fullClassName,
            style: mergedStyle,
            src: embedUrl,
            frameBorder: '0',
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
            allowFullScreen: true,
          };

          // Apply custom ID from attributes
          if (layer.attributes?.id) {
            iframeProps.id = layer.attributes.id;
          }

          // Apply custom attributes from settings
          if (layer.settings?.customAttributes) {
            Object.entries(layer.settings.customAttributes).forEach(([name, value]) => {
              iframeProps[name] = value;
            });
          }

          // Only add editor event handlers in edit mode (client-side only)
          if (isEditMode && !isEditing) {
            const originalOnClick = elementProps.onClick as ((e: React.MouseEvent) => void) | undefined;
            iframeProps.onClick = (e: React.MouseEvent) => {
              if (isLockedByOther) {
                e.stopPropagation();
                e.preventDefault();
                return;
              }
              if (e.button !== 2) {
                e.stopPropagation();
                onLayerClick?.(layer.id, e);
              }
              if (originalOnClick) {
                originalOnClick(e);
              }
            };
            iframeProps.onContextMenu = (e: React.MouseEvent) => {
              e.stopPropagation();
            };
          }

          return (
            <iframe key={`youtube-${layer.id}-${videoId}`} {...iframeProps} />
          );
        }
      }

      // Regular video/audio - render as media element
      const mediaSrc = (() => {
        if (htmlTag === 'video' && layer.variables?.video?.src) {
          const src = layer.variables.video.src;
          // Skip VideoVariable type (already handled above as YouTube iframe)
          if (src.type === 'video') {
            return undefined;
          }

          // Apply translation for video asset
          let videoVariable = src;
          if (src.type === 'asset' && src.data?.asset_id) {
            const originalAssetId = src.data.asset_id;
            const translatedAssetId = getTranslatedAssetId(
              originalAssetId,
              `layer:${layer.id}:video_src`,
              translations,
              pageId,
              layer._masterComponentId
            );
            if (translatedAssetId && translatedAssetId !== originalAssetId) {
              videoVariable = { ...src, data: { asset_id: translatedAssetId } };
            }
          }

          // getVideoUrlFromVariable handles AssetVariable, FieldVariable, and DynamicTextVariable
          // For FieldVariable, it resolves the field value (asset ID) and looks up the asset URL
          return getVideoUrlFromVariable(
            videoVariable,
            getAsset,
            collectionLayerData,
            pageCollectionItemData
          );
        }
        if (htmlTag === 'audio' && layer.variables?.audio?.src) {
          const src = layer.variables.audio.src;

          // Apply translation for audio asset
          let audioVariable = src;
          if (src.type === 'asset' && src.data?.asset_id) {
            const originalAssetId = src.data.asset_id;
            const translatedAssetId = getTranslatedAssetId(
              originalAssetId,
              `layer:${layer.id}:audio_src`,
              translations,
              pageId,
              layer._masterComponentId
            );
            if (translatedAssetId && translatedAssetId !== originalAssetId) {
              audioVariable = { ...src, data: { asset_id: translatedAssetId } };
            }
          }

          // getVideoUrlFromVariable handles AssetVariable, FieldVariable, and DynamicTextVariable
          // For FieldVariable, it resolves the field value (asset ID) and looks up the asset URL
          return getVideoUrlFromVariable(
            audioVariable,
            getAsset,
            collectionLayerData,
            pageCollectionItemData
          );
        }
        return imageUrl || undefined;
      })();

      // Get poster URL for video elements
      const posterUrl = (() => {
        if (htmlTag === 'video' && layer.variables?.video?.poster) {
          // Apply translation for video poster
          let posterVariable = layer.variables.video.poster;
          if (posterVariable?.type === 'asset' && posterVariable.data?.asset_id) {
            const originalAssetId = posterVariable.data.asset_id;
            const translatedAssetId = getTranslatedAssetId(
              originalAssetId,
              `layer:${layer.id}:video_poster`,
              translations,
              pageId,
              layer._masterComponentId
            );
            if (translatedAssetId && translatedAssetId !== originalAssetId) {
              posterVariable = { ...posterVariable, data: { asset_id: translatedAssetId } };
            }
          }

          return getImageUrlFromVariable(
            posterVariable,
            getAsset,
            collectionLayerData,
            pageCollectionItemData
          );
        }
        return undefined;
      })();

      // Always render media element, even without src (for published pages)
      // Only set src attribute if we have a valid URL
      const mediaProps: Record<string, any> = {
        ...elementProps,
        ...normalizedAttributes,
      };

      if (mediaSrc) {
        mediaProps.src = mediaSrc;
      }

      if (posterUrl && htmlTag === 'video') {
        mediaProps.poster = posterUrl;
      }

      // Handle special attributes that need to be set on the DOM element (not as props)
      // Volume must be set via JavaScript on the DOM element
      if ((htmlTag === 'audio' || htmlTag === 'video') && normalizedAttributes?.volume) {
        const originalRef = mediaProps.ref;
        const volumeValue = parseInt(normalizedAttributes.volume) / 100; // Convert 0-100 to 0-1

        mediaProps.ref = (element: HTMLAudioElement | HTMLVideoElement | null) => {
          // Call original ref if it exists
          if (originalRef) {
            if (typeof originalRef === 'function') {
              originalRef(element);
            } else {
              (originalRef as React.MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>).current = element;
            }
          }

          // Set volume on the DOM element
          if (element) {
            element.volume = volumeValue;
          }
        };
      }

      return (
        <Tag {...mediaProps}>
          {textContent && textContent}
          {children && children.length > 0 && (
            <LayerRenderer
              layers={children}
              onLayerClick={onLayerClick}
              onLayerUpdate={onLayerUpdate}
              onLayerHover={onLayerHover}
              selectedLayerId={selectedLayerId}
              hoveredLayerId={hoveredLayerId}
              isEditMode={isEditMode}
              isPublished={isPublished}
              enableDragDrop={enableDragDrop}
              activeLayerId={activeLayerId}
              projected={projected}
              pageId={pageId}
              collectionItemData={collectionLayerData}
              collectionItemId={collectionLayerItemId}
              pageCollectionItemId={pageCollectionItemId}
              pageCollectionItemData={pageCollectionItemData}
              pages={pages}
              folders={folders}
              collectionItemSlugs={collectionItemSlugs}
              isPreview={isPreview}
              translations={translations}
              anchorMap={anchorMap}
              resolvedAssets={resolvedAssets}
              hiddenLayerInfo={hiddenLayerInfo}
              editorHiddenLayerIds={editorHiddenLayerIds}
              editorBreakpoint={editorBreakpoint}
              currentLocale={currentLocale}
              availableLocales={availableLocales}
              localeSelectorFormat={localeSelectorFormat}
              liveLayerUpdates={liveLayerUpdates}
              isInsideForm={isInsideForm}
              parentFormSettings={parentFormSettings}
            />
          )}
        </Tag>
      );
    }

    if (htmlTag === 'iframe') {
      const iframeSrc = getIframeUrlFromVariable(layer.variables?.iframe?.src) || (normalizedAttributes as Record<string, string>).src || undefined;

      // Don't render iframe if no src (prevents empty src warning)
      if (!iframeSrc) {
        return null;
      }

      return (
        <Tag
          {...elementProps}
          src={iframeSrc}
        />
      );
    }

    // Text-editable elements with inline editing using CanvasTextEditor
    if (textEditable && isEditing) {
      // Get current value for editor - use rich text content if available
      const textVar = layer.variables?.text;
      const editorValue = textVar?.type === 'dynamic_rich_text'
        ? textVar.data.content
        : textVar?.type === 'dynamic_text'
          ? textVar.data.content
          : '';

      return (
        <Tag
          {...elementProps}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <CanvasTextEditor
            layer={layer}
            value={editorValue}
            onChange={handleEditorChange}
            onFinish={finishEditing}
            collectionItemData={collectionLayerData}
            clickCoords={editingClickCoords}
          />
        </Tag>
      );
    }

    // Collection layers - repeat the element for each item (design applies to each looped item)
    if (isCollectionLayer && isEditMode) {
      if (isLoadingLayerData) {
        return (
          <Tag {...elementProps}>
            <div className="w-full p-4">
              <ShimmerSkeleton
                count={3}
                height="60px"
                gap="1rem"
              />
            </div>
          </Tag>
        );
      }

      if (collectionItems.length === 0) {
        const emptyMessage =
          sourceFieldType === 'multi_asset' && multiAssetSourceField
            ? `The CMS item has no ${multiAssetSourceField.type}s`
            : 'No collection items';
        return (
          <Tag {...elementProps}>
            <div className="text-muted-foreground text-sm p-4 text-center">
              {emptyMessage}
            </div>
          </Tag>
        );
      }

      // Repeat the element for each collection item
      return (
        <>
          {collectionItems.map((item, index) => (
            <Tag
              key={item.id}
              {...elementProps}
              data-collection-item-id={item.id}
              data-layer-id={layer.id} // Keep same layer ID for all instances
            >
              {textContent && textContent}

              {children && children.length > 0 && (
                <LayerRenderer
                  layers={children}
                  onLayerClick={onLayerClick}
                  onLayerUpdate={onLayerUpdate}
                  onLayerHover={onLayerHover}
                  selectedLayerId={selectedLayerId}
                  hoveredLayerId={hoveredLayerId}
                  isEditMode={isEditMode}
                  isPublished={isPublished}
                  enableDragDrop={enableDragDrop}
                  activeLayerId={activeLayerId}
                  projected={projected}
                  pageId={pageId}
                  collectionItemData={item.values || {}}
                  collectionItemId={item.id}
                  pageCollectionItemId={pageCollectionItemId}
                  pageCollectionItemData={pageCollectionItemData}
                  hiddenLayerInfo={hiddenLayerInfo}
                  editorHiddenLayerIds={editorHiddenLayerIds}
                  editorBreakpoint={editorBreakpoint}
                  currentLocale={currentLocale}
                  availableLocales={availableLocales}
                  liveLayerUpdates={liveLayerUpdates}
                  parentComponentLayerId={parentComponentLayerId || (layer.componentId ? layer.id : undefined)}
                  parentComponentOverrides={parentComponentOverrides}
                  parentComponentVariables={parentComponentVariables}
                  editingComponentVariables={editingComponentVariables}
                  isInsideForm={isInsideForm || htmlTag === 'form'}
                  parentFormSettings={htmlTag === 'form' ? layer.settings?.form : parentFormSettings}
                  pages={pages}
                  folders={folders}
                  collectionItemSlugs={collectionItemSlugs}
                  isPreview={isPreview}
                  translations={translations}
                  anchorMap={anchorMap}
                  resolvedAssets={resolvedAssets}
                />
              )}
            </Tag>
          ))}
        </>
      );
    }

    // Special handling for locale selector wrapper (name='localeSelector')
    if (layer.name === 'localeSelector' && !isEditMode && availableLocales && availableLocales.length > 0) {
      // Extract current page slug from URL (LocaleSelector handles this internally)
      const currentPageSlug = typeof window !== 'undefined'
        ? window.location.pathname.slice(1).replace(/^ycode\/preview\/?/, '')
        : '';

      // Get format setting from this layer to pass to children
      const format = layer.settings?.locale?.format || 'locale';

      return (
        <Tag {...elementProps} style={mergedStyle}>
          {textContent && textContent}

          {/* Render children with format prop */}
          {children && children.length > 0 && (
            <LayerRenderer
              layers={children}
              onLayerClick={onLayerClick}
              onLayerUpdate={onLayerUpdate}
              onLayerHover={onLayerHover}
              selectedLayerId={selectedLayerId}
              hoveredLayerId={hoveredLayerId}
              isEditMode={isEditMode}
              isPublished={isPublished}
              enableDragDrop={enableDragDrop}
              activeLayerId={activeLayerId}
              projected={projected}
              pageId={pageId}
              collectionItemData={collectionLayerData}
              collectionItemId={collectionLayerItemId}
              pageCollectionItemId={pageCollectionItemId}
              pageCollectionItemData={pageCollectionItemData}
              pages={pages}
              folders={folders}
              collectionItemSlugs={collectionItemSlugs}
              isPreview={isPreview}
              translations={translations}
              anchorMap={anchorMap}
              resolvedAssets={resolvedAssets}
              hiddenLayerInfo={hiddenLayerInfo}
              editorHiddenLayerIds={editorHiddenLayerIds}
              editorBreakpoint={editorBreakpoint}
              currentLocale={currentLocale}
              availableLocales={availableLocales}
              localeSelectorFormat={format}
              liveLayerUpdates={liveLayerUpdates}
              parentComponentLayerId={layer.componentId ? layer.id : parentComponentLayerId}
              parentComponentOverrides={parentComponentOverrides}
              parentComponentVariables={parentComponentVariables}
              editingComponentVariables={editingComponentVariables}
              isInsideForm={isInsideForm || htmlTag === 'form'}
              parentFormSettings={htmlTag === 'form' ? layer.settings?.form : parentFormSettings}
            />
          )}

          {/* Locale selector overlay */}
          <LocaleSelector
            currentLocale={currentLocale}
            availableLocales={availableLocales}
            currentPageSlug={currentPageSlug}
            isPublished={isPublished}
          />
        </Tag>
      );
    }

    // Regular elements with text and/or children
    return (
      <Tag {...elementProps}>
        {/* Collaboration indicators - only show in edit mode */}
        {isEditMode && isLockedByOther && (
          <LayerLockIndicator layerId={layer.id} layerName={layer.name} />
        )}
        {isEditMode && isSelected && !isLockedByOther && (
          <EditingIndicator layerId={layer.id} className="absolute -top-8 right-0 z-20" />
        )}

        {textContent && textContent}

        {/* Render children */}
        {children && children.length > 0 && (
          <LayerRenderer
            layers={children}
            onLayerClick={onLayerClick}
            onLayerUpdate={onLayerUpdate}
            onLayerHover={onLayerHover}
            selectedLayerId={selectedLayerId}
            hoveredLayerId={hoveredLayerId}
            isEditMode={isEditMode}
            isPublished={isPublished}
            enableDragDrop={enableDragDrop}
            activeLayerId={activeLayerId}
            projected={projected}
            pageId={pageId}
            collectionItemData={collectionLayerData}
            collectionItemId={collectionLayerItemId}
            pageCollectionItemId={pageCollectionItemId}
            pageCollectionItemData={pageCollectionItemData}
            hiddenLayerInfo={hiddenLayerInfo}
            editorHiddenLayerIds={editorHiddenLayerIds}
            editorBreakpoint={editorBreakpoint}
            currentLocale={currentLocale}
            availableLocales={availableLocales}
            localeSelectorFormat={localeSelectorFormat}
            liveLayerUpdates={liveLayerUpdates}
            parentComponentLayerId={parentComponentLayerId || (layer.componentId ? layer.id : undefined)}
            parentComponentOverrides={parentComponentOverrides}
            parentComponentVariables={parentComponentVariables}
            editingComponentVariables={editingComponentVariables}
            isInsideForm={isInsideForm || htmlTag === 'form'}
            parentFormSettings={htmlTag === 'form' ? layer.settings?.form : parentFormSettings}
            pages={pages}
            folders={folders}
            collectionItemSlugs={collectionItemSlugs}
            isPreview={isPreview}
            translations={translations}
            anchorMap={anchorMap}
            resolvedAssets={resolvedAssets}
          />
        )}
      </Tag>
    );
  };

  // For collection layers in edit mode, return early without context menu wrapper
  // (Context menu doesn't work properly with Fragments)
  if (isCollectionLayer && isEditMode) {
    return renderContent();
  }

  // Wrap with context menu in edit mode
  // Don't wrap layers inside component instances (they're not directly editable)
  let content = renderContent();

  // Wrap with link if layer has link settings (published mode only)
  // In edit mode, links are not interactive to allow layer selection
  const linkSettings = layer.variables?.link;
  const shouldWrapWithLink = !isEditMode && isValidLinkSettings(linkSettings) && !layer.componentId;

  if (shouldWrapWithLink && linkSettings) {
    // Build link context for layer-level link resolution
    const layerLinkContext: LinkResolutionContext = {
      pages,
      folders,
      collectionItemSlugs,
      collectionItemId: collectionLayerItemId,
      pageCollectionItemId,
      collectionItemData: collectionLayerData,
      pageCollectionItemData: pageCollectionItemData || undefined,
      isPreview,
      locale: currentLocale,
      translations,
      getAsset,
      anchorMap,
      resolvedAssets,
    };
    const linkHref = generateLinkHref(linkSettings, layerLinkContext);

    if (linkHref) {
      const linkTarget = linkSettings.target || '_self';
      const linkRel = linkSettings.rel || (linkTarget === '_blank' ? 'noopener noreferrer' : undefined);
      const linkDownload = linkSettings.download;

      content = (
        <a
          href={linkHref}
          target={linkTarget}
          rel={linkRel}
          download={linkDownload || undefined}
          className="contents"
        >
          {content}
        </a>
      );
    }
  }

  if (isEditMode && pageId && !isEditing && !parentComponentLayerId) {
    const isLocked = layer.id === 'body';

    return (
      <LayerContextMenu
        layerId={layer.id}
        pageId={pageId}
        isLocked={isLocked}
        onLayerSelect={onLayerClick}
        selectedLayerId={selectedLayerId}
        liveLayerUpdates={liveLayerUpdates}
        liveComponentUpdates={liveComponentUpdates}
      >
        {content}
      </LayerContextMenu>
    );
  }

  return content;
};

export default LayerRenderer;
