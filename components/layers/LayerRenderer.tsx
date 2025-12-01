'use client';

import React, { useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Layer } from '../../types';
import { getLayerHtmlTag, getClassesString, getText, getImageUrl, getCollectionVariable, sortCollectionItems, resolveFieldValue, resolveInlineVariables, getInlineVariableContent, isTextEditable } from '../../lib/layer-utils';
import LayerContextMenu from '../../app/ycode/components/LayerContextMenu';
import { useComponentsStore } from '../../stores/useComponentsStore';
import { useCollectionLayerStore } from '../../stores/useCollectionLayerStore';
import { ShimmerSkeleton } from '@/components/ui/shimmer-skeleton';
import { useCollectionsStore } from '../../stores/useCollectionsStore';
import { cn } from '@/lib/utils';

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
}) => {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');

  return (
    <>
      {layers.map((layer) => (
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
        />
      ))}
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
}) => {
  const isSelected = selectedLayerId === layer.id;
  const isEditing = editingLayerId === layer.id;
  const isDragging = activeLayerId === layer.id;
  const textEditable = isTextEditable(layer);
  const htmlTag = getLayerHtmlTag(layer);
  const classesString = getClassesString(layer);

  // Resolve text and image URLs with field binding support
  const textContent = (() => {
    const inlineContent = getInlineVariableContent(layer);
    if (inlineContent) {
      return resolveInlineVariables(inlineContent, collectionItemData);
    }
    const text = getText(layer);
    if (text) return text;
    if (typeof layer.text === 'object') {
      return resolveFieldValue(layer.text, collectionItemData);
    }
    return undefined;
  })();

  const imageUrl = (() => {
    const url = getImageUrl(layer);
    if (url) return url;
    if (typeof layer.url === 'object') {
      return resolveFieldValue(layer.url, collectionItemData);
    }
    return undefined;
  })();

  // Handle component instances - only fetch from store in edit mode
  // In published pages, components are pre-resolved server-side via resolveComponents()
  const getComponentById = useComponentsStore((state) => state.getComponentById);
  const component = (isEditMode && layer.componentId) ? getComponentById(layer.componentId) : null;

  // Get collection items if this is a collection layer
  const collectionVariable = getCollectionVariable(layer);

  const isCollectionLayer = !!collectionVariable;

  // Debug: Always log to verify execution
  console.log('[LayerRenderer]', {
    layerId: layer.id,
    layerName: layer.name,
    isCollectionLayer,
    collectionVariable,
    NODE_ENV: process.env.NODE_ENV
  });
  const collectionId = collectionVariable?.id;

  // Use collection layer store for independent data fetching
  const layerData = useCollectionLayerStore((state) => state.layerData[layer.id]);
  const isLoadingLayerData = useCollectionLayerStore((state) => state.loading[layer.id]);

  // Collection items from layer-specific store
  const collectionItems = layerData || [];

  // Debug: Log collection layer state
  if (isCollectionLayer) {
    console.log('[LayerRenderer] Collection Layer', {
      layerId: layer.id,
      collectionId,
      itemsCount: collectionItems.length,
      isLoading: isLoadingLayerData,
      collectionVariable
    });
  }

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
      // Update both text and content for compatibility
      onLayerUpdate(layer.id, { text: editingContent, content: editingContent });
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

  // Render element-specific content
  const renderContent = () => {
    const Tag = htmlTag as any;
    const attributes = layer.attributes || {};

    // Check if element is truly empty (no text, no children)
    const isEmpty = !textContent && (!children || children.length === 0);

    // Check if this is the Body layer (locked)
    const isLocked = layer.id === 'body' || layer.locked === true;

    // Build props for the element
    const elementProps: Record<string, unknown> = {
      ref: setNodeRef,
      className: fullClassName,
      style,
      'data-layer-id': layer.id,
      'data-layer-type': htmlTag,
      'data-is-empty': isEmpty ? 'true' : 'false',
      ...(enableDragDrop && !isEditing ? { ...attributes, ...listeners } : attributes),
    };

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
          alt={layer.alt || 'Image'}
        />
      );
    }

    if (htmlTag === 'hr' || htmlTag === 'br') {
      return <Tag {...elementProps} />;
    }

    if (htmlTag === 'input') {
      return <Tag {...elementProps} />;
    }

    if (htmlTag === 'icon' || layer.icon) {
      return (
        <Tag
          {...elementProps}
          dangerouslySetInnerHTML={{ __html: layer.icon?.svg_code || '' }}
        />
      );
    }

    if (htmlTag === 'video' || htmlTag === 'audio') {
      return (
        <Tag
          {...elementProps}
          src={imageUrl || layer.url || ''}
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
              collectionItemData={collectionItemData}
            />
          )}
        </Tag>
      );
    }

    if (htmlTag === 'iframe') {
      return (
        <Tag
          {...elementProps}
          src={layer.url || attributes.src || ''}
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

        {/* Collection layer repeater logic
            When a collection layer is bound to a collection with items:
            - Shows shimmer skeleton while loading
            - Renders children once for each collection item
            - Since LayerRenderer is recursive, this automatically repeats ALL descendants
              (children, grandchildren, great-grandchildren, etc.) for each item
            - Each repeated instance is wrapped in a div with data-collection-item-id
            - Passes the item's field values as collectionItemData for field binding resolution
        */}
        {isCollectionLayer && collectionId ? (
          // Show loading skeleton while fetching
          isLoadingLayerData && isEditMode ? (
            <div className="w-full p-4">
              <ShimmerSkeleton
                count={3} height="60px"
                gap="1rem"
              />
            </div>
          ) : collectionItems.length > 0 ? (
            // Render children once for each collection item
            children && children.length > 0 ? (
              collectionItems.map((item) => (
                <div key={item.id} data-collection-item-id={item.id}>
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
                  />
                </div>
              ))
            ) : null
          ) : null
        ) : (
          // Regular rendering for non-collection layers
          children && children.length > 0 && (
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
              collectionItemData={collectionItemData}
            />
          )
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
