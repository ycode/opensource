'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import LayerLockIndicator from '@/components/collaboration/LayerLockIndicator';
import EditingIndicator from '@/components/collaboration/EditingIndicator';
import { useCollaborationPresenceStore, getResourceLockKey, RESOURCE_TYPES } from '@/stores/useCollaborationPresenceStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useLocalisationStore } from '@/stores/useLocalisationStore';
import type { Layer, Locale } from '@/types';
import type { UseLiveLayerUpdatesReturn } from '@/hooks/use-live-layer-updates';
import type { UseLiveComponentUpdatesReturn } from '@/hooks/use-live-component-updates';
import { getLayerHtmlTag, getClassesString, getText, resolveFieldValue, isTextEditable, getCollectionVariable, evaluateVisibility } from '@/lib/layer-utils';
import { getDynamicTextContent, getImageUrlFromVariable, getVideoUrlFromVariable, getIframeUrlFromVariable, isFieldVariable, isAssetVariable, isStaticTextVariable, isDynamicTextVariable, getAssetId, getStaticTextContent } from '@/lib/variable-utils';
import { getTranslatedAssetId, getTranslatedText } from '@/lib/localisation-utils';
import { DEFAULT_ASSETS } from '@/lib/asset-utils';
import { generateImageSrcset, getImageSizes, getOptimizedImageUrl } from '@/lib/asset-utils';
import { resolveInlineVariables } from '@/lib/inline-variables';
import { renderRichText, hasBlockElements } from '@/lib/text-format-utils';
import LayerContextMenu from '@/app/ycode/components/LayerContextMenu';
import CanvasTextEditor from '@/app/ycode/components/CanvasTextEditor';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useCollectionLayerStore } from '@/stores/useCollectionLayerStore';
import { useAssetsStore } from '@/stores/useAssetsStore';
import { ShimmerSkeleton } from '@/components/ui/shimmer-skeleton';
import { cn } from '@/lib/utils';
import PaginatedCollection from '@/components/PaginatedCollection';
import LoadMoreCollection from '@/components/LoadMoreCollection';
import LocaleSelector from '@/components/layers/LocaleSelector';

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
  collectionItemData?: Record<string, string>; // Collection item field values (field_id -> value)
  pageCollectionItemData?: Record<string, string> | null;
  hiddenLayerIds?: string[]; // Layer IDs that should start hidden for animations
  currentLocale?: Locale | null;
  availableLocales?: Locale[];
  localeSelectorFormat?: 'locale' | 'code'; // Format for locale selector label (inherited from parent)
  liveLayerUpdates?: UseLiveLayerUpdatesReturn | null; // For collaboration broadcasts
  liveComponentUpdates?: UseLiveComponentUpdatesReturn | null; // For component collaboration broadcasts
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
  pageCollectionItemData,
  hiddenLayerIds,
  currentLocale,
  availableLocales = [],
  localeSelectorFormat,
  liveLayerUpdates,
  liveComponentUpdates,
}) => {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [editingClickCoords, setEditingClickCoords] = useState<{ x: number; y: number } | null>(null);

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
        pageCollectionItemData={pageCollectionItemData}
        hiddenLayerIds={hiddenLayerIds}
        currentLocale={currentLocale}
        availableLocales={availableLocales}
        localeSelectorFormat={localeSelectorFormat}
        liveLayerUpdates={liveLayerUpdates}
        liveComponentUpdates={liveComponentUpdates}
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
  pageCollectionItemData?: Record<string, string> | null;
  hiddenLayerIds?: string[];
  currentLocale?: Locale | null;
  availableLocales?: Locale[];
  localeSelectorFormat?: 'locale' | 'code';
  liveLayerUpdates?: UseLiveLayerUpdatesReturn | null;
  liveComponentUpdates?: UseLiveComponentUpdatesReturn | null;
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
  pageCollectionItemData,
  hiddenLayerIds,
  currentLocale,
  availableLocales,
  localeSelectorFormat,
  liveLayerUpdates,
  liveComponentUpdates,
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
  const effectiveCollectionItemData = collectionItemData || pageCollectionItemData || undefined;
  const getAsset = useAssetsStore((state) => state.getAsset);
  const assetsById = useAssetsStore((state) => state.assetsById);
  const allTranslations = useLocalisationStore((state) => state.translations);
  const translations = isEditMode && currentLocale ? allTranslations[currentLocale.id] : null;
  let htmlTag = getLayerHtmlTag(layer);

  // Check if we need to override the tag for rich text with block elements
  // Tags like <p>, <h1>-<h6> cannot contain block elements like <ul>/<ol>
  const textVariable = layer.variables?.text;
  let useSpanForParagraphs = false;

  if (textVariable?.type === 'dynamic_rich_text') {
    const restrictiveBlockTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'button'];
    const isRestrictiveTag = restrictiveBlockTags.includes(htmlTag);
    const hasLists = hasBlockElements(textVariable as any);

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

    // Check for DynamicRichTextVariable format (with formatting)
    if (textVariable?.type === 'dynamic_rich_text') {
      // Render rich text with formatting (bold, italic, etc.) and inline variables
      // In edit mode, adds data-style attributes for style selection
      return renderRichText(textVariable as any, effectiveCollectionItemData, layer.textStyles, useSpanForParagraphs, isEditMode);
    }

    // Check for inline variables in DynamicTextVariable format (legacy)
    if (textVariable?.type === 'dynamic_text') {
      const content = textVariable.data.content;
      if (content.includes('<ycode-inline-variable>')) {
        // Use the embedded JSON resolver (client-safe)
        if (effectiveCollectionItemData) {
          const mockItem: any = {
            id: 'temp',
            collection_id: 'temp',
            created_at: '',
            updated_at: '',
            deleted_at: null,
            manual_order: 0,
            is_published: true,
            values: effectiveCollectionItemData,
          };
          return resolveInlineVariables(content, mockItem);
        }
        // No collection data - remove variables
        return content.replace(/<ycode-inline-variable>[\s\S]*?<\/ycode-inline-variable>/g, '');
      }
      // No inline variables, return plain content
      return content;
    }
    const text = getText(layer);
    if (text) return text;
    return undefined;
  })();

  // Get image asset ID and apply translation if available
  const originalImageAssetId = layer.variables?.image?.src?.type === 'asset'
    ? layer.variables.image.src.data?.asset_id
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
    ? { ...layer.variables?.image?.src, type: 'asset' as const, data: { asset_id: translatedImageAssetId } }
    : layer.variables?.image?.src;

  const imageUrl = getImageUrlFromVariable(
    imageVariable,
    getAsset,
    resolveFieldValue,
    effectiveCollectionItemData
  );

  // Get image alt text and apply translation if available
  const originalImageAlt = getDynamicTextContent(layer.variables?.image?.alt) || 'Image';
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
  const collectionVariable = getCollectionVariable(layer);
  const isCollectionLayer = !!collectionVariable;
  const collectionId = collectionVariable?.id;
  const sourceFieldId = collectionVariable?.source_field_id;
  const sourceFieldType = collectionVariable?.source_field_type;
  const layerData = useCollectionLayerStore((state) => state.layerData[layer.id]);
  const isLoadingLayerData = useCollectionLayerStore((state) => state.loading[layer.id]);
  const fetchLayerData = useCollectionLayerStore((state) => state.fetchLayerData);
  const allCollectionItems = React.useMemo(() => layerData || [], [layerData]);

  // Filter items by reference field if source_field_id is set
  // Single reference: get the one referenced item (no loop, just context)
  // Multi-reference: filter to items in the array (loops through all)
  const collectionItems = React.useMemo(() => {
    if (!sourceFieldId || !effectiveCollectionItemData) {
      return allCollectionItems;
    }

    // Get the reference field value from parent item
    const refValue = effectiveCollectionItemData[sourceFieldId];
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
  }, [allCollectionItems, sourceFieldId, sourceFieldType, effectiveCollectionItemData]);

  useEffect(() => {
    if (!isEditMode) return;
    if (!collectionVariable?.id) return;
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

  const finishEditing = useCallback(() => {
    if (editingLayerId === layer.id && onLayerUpdate) {
      setEditingLayerId(null);
    }
  }, [editingLayerId, layer.id, onLayerUpdate]);

  // Handle content change from CanvasTextEditor
  const handleEditorChange = useCallback((newContent: any) => {
    if (!onLayerUpdate) return;

    // Update with rich text format
    onLayerUpdate(layer.id, {
      variables: {
        ...layer.variables,
        text: {
          type: 'dynamic_rich_text',
          data: { content: newContent },
        },
      },
    });
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
  const fullClassName = isEditMode ? cn(
    classesString,
    'transition-all',
    'duration-100',
    enableDragDrop && !isEditing && !isLockedByOther && 'cursor-default',
    // Selection/hover outlines are now rendered by SelectionOverlay component (outside iframe)
    isDragging && 'opacity-30',
    showProjection && 'outline outline-1 outline-dashed outline-blue-400 bg-blue-50/10',
    isLockedByOther && 'opacity-90 pointer-events-none select-none',
    // Add ycode-layer class for editor styling
    'ycode-layer'
  ) : classesString;

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
      collectionItemData: effectiveCollectionItemData,
      pageCollectionCounts,
    });
    if (!isVisible) {
      return null;
    }
  }

  // Render element-specific content
  const renderContent = () => {
    const Tag = htmlTag as any;
    const { style: attrStyle, ...otherAttributes } = layer.attributes || {};

    // Convert string boolean values to actual booleans
    const normalizedAttributes = Object.fromEntries(
      Object.entries(otherAttributes).map(([key, value]) => {
        // If value is already a boolean, keep it
        if (typeof value === 'boolean') {
          return [key, value];
        }
        // If value is a string that looks like a boolean, convert it
        if (typeof value === 'string') {
          if (value === 'true') {
            return [key, true];
          }
          if (value === 'false') {
            return [key, false];
          }
        }
        // For all other values, keep them as-is
        return [key, value];
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
    if (hiddenLayerIds?.includes(layer.id)) {
      elementProps['data-gsap-hidden'] = '';
    }

    // Apply custom ID from settings
    if (layer.settings?.id) {
      elementProps.id = layer.settings.id;
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
          onLayerClick?.(layer.id, e);
        }
        if (originalOnClick) {
          originalOnClick(e);
        }
      };
      elementProps.onDoubleClick = (e: React.MouseEvent) => {
        if (isLockedByOther) return;
        e.stopPropagation();
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
            onLayerHover(layer.id);
          }
        };
        elementProps.onMouseLeave = (e: React.MouseEvent) => {
          // Don't stop propagation - allow parent to detect mouse entry
          // Use mouse coordinates to find which element is actually under the cursor
          // Use the event target's owner document (iframe's document)
          const doc = (e.currentTarget as HTMLElement).ownerDocument;
          const { clientX, clientY } = e;
          const elementUnderMouse = doc?.elementFromPoint(clientX, clientY);

          if (elementUnderMouse) {
            // Find the closest layer element
            const targetLayerElement = elementUnderMouse.closest('[data-layer-id]') as HTMLElement | null;
            if (targetLayerElement) {
              const targetLayerId = targetLayerElement.getAttribute('data-layer-id');
              if (targetLayerId && targetLayerId !== layer.id) {
                onLayerHover(targetLayerId);
                return;
              }
            }
          }

          // Not moving to a layer - clear hover
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
      return <Tag {...elementProps} />;
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
          const resolvedValue = resolveFieldValue(iconSrc, effectiveCollectionItemData);
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
          const videoId = videoSrc.data.video_id || '';
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

          // Apply custom ID from settings
          if (layer.settings?.id) {
            iframeProps.id = layer.settings.id;
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
            <iframe {...iframeProps} />
          );
        }
      }

      // Regular video/audio - render as media element
      const mediaSrc = (() => {
        if (htmlTag === 'video' && layer.variables?.video?.src) {
          const src = layer.variables.video.src;
          if (isFieldVariable(src)) {
            return resolveFieldValue(src, effectiveCollectionItemData) || undefined;
          }
          // Skip VideoVariable type (already handled above)
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

          return getVideoUrlFromVariable(
            videoVariable,
            getAsset,
            resolveFieldValue,
            effectiveCollectionItemData
          );
        }
        if (htmlTag === 'audio' && layer.variables?.audio?.src) {
          const src = layer.variables.audio.src;
          if (isFieldVariable(src)) {
            return resolveFieldValue(src, effectiveCollectionItemData) || undefined;
          }

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

          return getVideoUrlFromVariable(
            audioVariable,
            getAsset,
            resolveFieldValue,
            effectiveCollectionItemData
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
            resolveFieldValue,
            effectiveCollectionItemData
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
              collectionItemData={effectiveCollectionItemData}
              pageCollectionItemData={pageCollectionItemData}
              hiddenLayerIds={hiddenLayerIds}
              currentLocale={currentLocale}
              availableLocales={availableLocales}
              localeSelectorFormat={localeSelectorFormat}
              liveLayerUpdates={liveLayerUpdates}
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
            collectionItemData={effectiveCollectionItemData}
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
        // Show empty state with the layer design
        return (
          <Tag {...elementProps}>
            <div className="text-muted-foreground text-sm p-4 text-center">
              No collection items
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
                  collectionItemData={item.values}
                  pageCollectionItemData={pageCollectionItemData}
                  hiddenLayerIds={hiddenLayerIds}
                  currentLocale={currentLocale}
                  availableLocales={availableLocales}
                  liveLayerUpdates={liveLayerUpdates}
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
              collectionItemData={effectiveCollectionItemData}
              pageCollectionItemData={pageCollectionItemData}
              hiddenLayerIds={hiddenLayerIds}
              currentLocale={currentLocale}
              availableLocales={availableLocales}
              localeSelectorFormat={format}
              liveLayerUpdates={liveLayerUpdates}
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
            collectionItemData={effectiveCollectionItemData}
            pageCollectionItemData={pageCollectionItemData}
            hiddenLayerIds={hiddenLayerIds}
            currentLocale={currentLocale}
            availableLocales={availableLocales}
            localeSelectorFormat={localeSelectorFormat}
            liveLayerUpdates={liveLayerUpdates}
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
  const content = renderContent();

  if (isEditMode && pageId && !isEditing) {
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
