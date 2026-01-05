'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Layer } from '../../types';
import { getLayerHtmlTag, getClassesString, getText, resolveFieldValue, isTextEditable, getCollectionVariable, evaluateVisibility } from '../../lib/layer-utils';
import { isFieldVariable, isAssetVariable, isDynamicTextVariable, getVariableStringValue, getDynamicTextContent } from '../../lib/variable-utils';
import { resolveInlineVariables } from '@/lib/inline-variables';
import LayerContextMenu from '../../app/ycode/components/LayerContextMenu';
import { useComponentsStore } from '../../stores/useComponentsStore';
import { useCollectionLayerStore } from '../../stores/useCollectionLayerStore';
import { ShimmerSkeleton } from '@/components/ui/shimmer-skeleton';
import { cn } from '@/lib/utils';
import PaginatedCollection from '@/components/PaginatedCollection';
import LoadMoreCollection from '@/components/LoadMoreCollection';

interface LayerRendererProps {
  layers: Layer[];
  onLayerClick?: (layerId: string) => void;
  onLayerUpdate?: (layerId: string, updates: Partial<Layer>) => void;
  selectedLayerId?: string | null;
  isEditMode?: boolean;
  isPublished?: boolean;
  enableDragDrop?: boolean;
  activeLayerId?: string | null;
  projected?: { depth: number; parentId: string | null } | null;
  pageId?: string;
  collectionItemData?: Record<string, string>; // Collection item field values (field_id -> value)
  pageCollectionItemData?: Record<string, string> | null;
  hiddenLayerIds?: string[]; // Layer IDs that should start hidden for animations
}

const LayerRenderer: React.FC<LayerRendererProps> = ({
  layers,
  onLayerClick,
  onLayerUpdate,
  selectedLayerId,
  isEditMode = true,
  isPublished = false,
  enableDragDrop = false,
  activeLayerId = null,
  projected = null,
  pageId = '',
  collectionItemData,
  pageCollectionItemData,
  hiddenLayerIds,
}) => {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');

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
        activeLayerId={activeLayerId}
        projected={projected}
        onLayerClick={onLayerClick}
        onLayerUpdate={onLayerUpdate}
        editingLayerId={editingLayerId}
        setEditingLayerId={setEditingLayerId}
        editingContent={editingContent}
        setEditingContent={setEditingContent}
        pageId={pageId}
        collectionItemData={collectionItemData}
        pageCollectionItemData={pageCollectionItemData}
        hiddenLayerIds={hiddenLayerIds}
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
  activeLayerId?: string | null;
  projected?: { depth: number; parentId: string | null } | null;
  onLayerClick?: (layerId: string) => void;
  onLayerUpdate?: (layerId: string, updates: Partial<Layer>) => void;
  editingLayerId: string | null;
  setEditingLayerId: (id: string | null) => void;
  editingContent: string;
  setEditingContent: (content: string) => void;
  pageId: string;
  collectionItemData?: Record<string, string>;
  pageCollectionItemData?: Record<string, string> | null;
  hiddenLayerIds?: string[];
}> = ({
  layer,
  isEditMode,
  isPublished,
  enableDragDrop,
  selectedLayerId,
  activeLayerId,
  projected,
  onLayerClick,
  onLayerUpdate,
  editingLayerId,
  setEditingLayerId,
  editingContent,
  setEditingContent,
  pageId,
  collectionItemData,
  pageCollectionItemData,
  hiddenLayerIds,
}) => {
  const isSelected = selectedLayerId === layer.id;
  const isEditing = editingLayerId === layer.id;
  const isDragging = activeLayerId === layer.id;
  const textEditable = isTextEditable(layer);
  const htmlTag = getLayerHtmlTag(layer);
  const classesString = getClassesString(layer);
  const effectiveCollectionItemData = collectionItemData || pageCollectionItemData || undefined;

  // Resolve text and image URLs with field binding support
  const textContent = (() => {
    // Check for inline variables in DynamicTextVariable format
    const textVariable = layer.variables?.text;
    if (textVariable && textVariable.type === 'dynamic_text') {
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

  const imageUrl = (() => {
    const src = layer.variables?.image?.src;
    if (!src) return undefined;
    if (isFieldVariable(src)) {
      return resolveFieldValue(src, effectiveCollectionItemData);
    }
    if (isDynamicTextVariable(src)) {
      return src.data.content;
    }
    if (isAssetVariable(src)) {
      return src.data.asset_id;
    }
    return undefined;
  })();

  const imageAlt = getDynamicTextContent(layer.variables?.image?.alt) || 'Image';

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
  const hasChildren = (children && children.length > 0) || false;

  // Use sortable for drag and drop
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: layer.id,
    disabled: !enableDragDrop || isEditing,
    data: {
      layer,
    },
  });

  const startEditing = () => {
    if (textEditable && isEditMode) {
      setEditingLayerId(layer.id);
      setEditingContent(textContent || '');
    }
  };

  const finishEditing = () => {
    if (editingLayerId === layer.id && onLayerUpdate) {
      // Update text content
      onLayerUpdate(layer.id, {
        variables: {
          ...layer.variables,
          text: {
            type: 'dynamic_text',
            data: { content: editingContent }
          }
        }
      });
      setEditingLayerId(null);
    }
  };

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
    'relative',
    'transition-all',
    'duration-100',
    !isEditing && !isDragging && 'cursor-pointer hover:outline hover:outline-1 hover:outline-blue-400/30 hover:outline-offset-0',
    enableDragDrop && !isEditing && 'cursor-grab active:cursor-grabbing',
    isSelected && 'outline outline-2 outline-blue-500 outline-offset-1',
    isDragging && 'opacity-30 outline-none',
    showProjection && 'outline outline-1 outline-dashed outline-blue-400 bg-blue-50/10'
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
    const isLocked = layer.id === 'body' || layer.locked === true;

    // Build props for the element
    const elementProps: Record<string, unknown> = {
      ref: setNodeRef,
      className: fullClassName,
      style: mergedStyle,
      'data-layer-id': layer.id,
      'data-layer-type': htmlTag,
      'data-is-empty': isEmpty ? 'true' : 'false',
      ...(enableDragDrop && !isEditing ? { ...otherAttributes, ...listeners } : otherAttributes),
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
        // Only handle if not a context menu trigger
        if (e.button !== 2) {
          e.stopPropagation();
          onLayerClick?.(layer.id);
        }
        if (originalOnClick) {
          originalOnClick(e);
        }
      };
      elementProps.onDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        startEditing();
      };
      // Prevent context menu from bubbling
      elementProps.onContextMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
      };
    }

    // Handle special cases for void/self-closing elements
    if (htmlTag === 'img') {
      return (
        <Tag
          {...elementProps}
          src={imageUrl || ''}
          alt={imageAlt}
        />
      );
    }

    if (htmlTag === 'hr' || htmlTag === 'br') {
      return <Tag {...elementProps} />;
    }

    if (htmlTag === 'input') {
      return <Tag {...elementProps} />;
    }

    if (htmlTag === 'icon') {
      // Check variables.icon.src (asset ID, field variable, or static text with SVG code)
      const iconSrc = layer.variables?.icon?.src;
      const iconHtml = iconSrc ? getVariableStringValue(iconSrc) : '';
      return (
        <Tag
          {...elementProps}
          dangerouslySetInnerHTML={{ __html: iconHtml }}
        />
      );
    }

    if (htmlTag === 'video' || htmlTag === 'audio') {
      // For video/audio, use variables.video.src or variables.audio.src
      const mediaSrc = (() => {
        if (htmlTag === 'video' && layer.variables?.video?.src) {
          const src = layer.variables.video.src;
          if (isFieldVariable(src)) {
            return resolveFieldValue(src, effectiveCollectionItemData) || '';
          }
          return getVariableStringValue(src);
        }
        if (htmlTag === 'audio' && layer.variables?.audio?.src) {
          const src = layer.variables.audio.src;
          if (isFieldVariable(src)) {
            return resolveFieldValue(src, effectiveCollectionItemData) || '';
          }
          return getVariableStringValue(src);
        }
        return imageUrl || '';
      })();

      return (
        <Tag
          {...elementProps}
          src={mediaSrc}
        >
          {textContent && textContent}
          {children && children.length > 0 && (
            <LayerRenderer
              layers={children}
              onLayerClick={onLayerClick}
              onLayerUpdate={onLayerUpdate}
              selectedLayerId={selectedLayerId}
              isEditMode={isEditMode}
              isPublished={isPublished}
              enableDragDrop={enableDragDrop}
              activeLayerId={activeLayerId}
              projected={projected}
              pageId={pageId}
              collectionItemData={effectiveCollectionItemData}
              pageCollectionItemData={pageCollectionItemData}
              hiddenLayerIds={hiddenLayerIds}
            />
          )}
        </Tag>
      );
    }

    if (htmlTag === 'iframe') {
      const iframeSrc = getDynamicTextContent(layer.variables?.iframe?.src) || (otherAttributes as Record<string, string>).src || '';
      return (
        <Tag
          {...elementProps}
          src={iframeSrc}
        />
      );
    }

    // Text-editable elements with inline editing
    if (textEditable && isEditing) {
      return (
        <input
          type="text"
          value={editingContent}
          onChange={(e) => setEditingContent(e.target.value)}
          onBlur={finishEditing}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              finishEditing();
            } else if (e.key === 'Escape') {
              setEditingLayerId(null);
            }
          }}
          autoFocus
          className="w-full bg-white border-2 border-blue-500 rounded px-2 py-1 outline-none"
          onClick={(e) => e.stopPropagation()}
        />
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
            {/* Selection Badge */}
            {isSelected && !isEditing && (
              <span className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-lg z-10 pointer-events-none block">
                {htmlTag.charAt(0).toUpperCase() + htmlTag.slice(1)} Selected (Collection - 0 items)
              </span>
            )}
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
              {/* Selection Badge - only show on first item */}
              {index === 0 && isSelected && !isEditing && (
                <span className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-lg z-10 pointer-events-none block">
                  {htmlTag.charAt(0).toUpperCase() + htmlTag.slice(1)} Selected ({collectionItems.length} items)
                </span>
              )}

              {textContent && textContent}

              {children && children.length > 0 && (
                <LayerRenderer
                  layers={children}
                  onLayerClick={onLayerClick}
                  onLayerUpdate={onLayerUpdate}
                  selectedLayerId={selectedLayerId}
                  isEditMode={isEditMode}
                  isPublished={isPublished}
                  enableDragDrop={enableDragDrop}
                  activeLayerId={activeLayerId}
                  projected={projected}
                  pageId={pageId}
                  collectionItemData={item.values}
                  pageCollectionItemData={pageCollectionItemData}
                  hiddenLayerIds={hiddenLayerIds}
                />
              )}
            </Tag>
          ))}
        </>
      );
    }

    // Regular elements with text and/or children
    return (
      <Tag {...elementProps}>
        {/* Selection Badge */}
        {isEditMode && isSelected && !isEditing && (
          <span className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-lg z-10 pointer-events-none block">
            {htmlTag.charAt(0).toUpperCase() + htmlTag.slice(1)} Selected
            {textEditable && <span className="ml-2 opacity-75">• Double-click to edit</span>}
          </span>
        )}

        {textContent && textContent}

        {/* Render children */}
        {children && children.length > 0 && (
          <LayerRenderer
            layers={children}
            onLayerClick={onLayerClick}
            onLayerUpdate={onLayerUpdate}
            selectedLayerId={selectedLayerId}
            isEditMode={isEditMode}
            isPublished={isPublished}
            enableDragDrop={enableDragDrop}
            activeLayerId={activeLayerId}
            projected={projected}
            pageId={pageId}
            collectionItemData={effectiveCollectionItemData}
            pageCollectionItemData={pageCollectionItemData}
            hiddenLayerIds={hiddenLayerIds}
          />
        )}
      </Tag>
    );
  };

  // Wrap with context menu in edit mode
  const content = renderContent();

  if (isEditMode && pageId && !isEditing) {
    const isLocked = layer.id === 'body' || layer.locked === true;

    return (
      <LayerContextMenu
        layerId={layer.id}
        pageId={pageId}
        isLocked={isLocked}
        onLayerSelect={onLayerClick}
        selectedLayerId={selectedLayerId}
      >
        {content}
      </LayerContextMenu>
    );
  }

  return content;
};

export default LayerRenderer;
