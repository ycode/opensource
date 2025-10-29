'use client';

import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Layer } from '../../types';
import { getHtmlTag, getClassesString, getChildren, getText, getImageUrl } from '../../lib/layer-utils';

interface LayerRendererProps {
  layers: Layer[];
  onLayerClick?: (layerId: string) => void;
  onLayerUpdate?: (layerId: string, updates: Partial<Layer>) => void;
  selectedLayerId?: string | null;
  isEditMode?: boolean;
  enableDragDrop?: boolean;
  activeLayerId?: string | null;
  projected?: { depth: number; parentId: string | null } | null;
}

const LayerRenderer: React.FC<LayerRendererProps> = ({ 
  layers, 
  onLayerClick,
  onLayerUpdate,
  selectedLayerId,
  isEditMode = true,
  enableDragDrop = false,
  activeLayerId = null,
  projected = null,
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
        />
      ))}
    </>
  );
};

// Separate LayerItem component to handle drag-and-drop per layer
const LayerItem: React.FC<{
  layer: Layer;
  isEditMode: boolean;
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
}> = ({
  layer,
  isEditMode,
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
}) => {
  const isSelected = selectedLayerId === layer.id;
  const hasChildren = (getChildren(layer) && getChildren(layer)!.length > 0) || false;
  const isEditing = editingLayerId === layer.id;
  const isTextEditable = layer.formattable || layer.type === 'text' || layer.type === 'heading';
  const isDragging = activeLayerId === layer.id;
  const htmlTag = getHtmlTag(layer);
  const classesString = getClassesString(layer);
  const textContent = getText(layer);
  const imageUrl = getImageUrl(layer);
  const children = getChildren(layer);

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
      type: layer.type,
      layer,
    },
  });

  const startEditing = () => {
    if (isTextEditable && isEditMode) {
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
  const editorClasses = isEditMode ? [
    'relative',
    'transition-all',
    'duration-100',
    !isEditing && !isDragging ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-blue-400/30 hover:outline-offset-0' : '',
    enableDragDrop && !isEditing ? 'cursor-grab active:cursor-grabbing' : '',
    isSelected ? 'outline outline-2 outline-blue-500 outline-offset-1' : '',
    isDragging ? 'opacity-30 outline-none' : '',
    showProjection ? 'outline outline-1 outline-dashed outline-blue-400 bg-blue-50/10' : '',
  ].filter(Boolean).join(' ') : '';

  const fullClassName = [classesString, editorClasses].filter(Boolean).join(' ');

  // Render element-specific content
  const renderContent = () => {
cl    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Tag = htmlTag as any;
    const attributes = layer.attributes || {};
    
    // Check if element is truly empty (no text, no children)
    const isEmpty = !textContent && (!children || children.length === 0);
    
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
    
    // Add editor event handlers if in edit mode
    if (isEditMode && !isEditing) {
      elementProps.onClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onLayerClick?.(layer.id);
      };
      elementProps.onDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        startEditing();
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
              enableDragDrop={enableDragDrop}
              activeLayerId={activeLayerId}
              projected={projected}
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
    if (isTextEditable && isEditing) {
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
          <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-lg z-10 pointer-events-none">
            {htmlTag.charAt(0).toUpperCase() + htmlTag.slice(1)} Selected
            {isTextEditable && <span className="ml-2 opacity-75">• Double-click to edit</span>}
          </div>
        )}
        
        {textContent && textContent}
        
        {children && children.length > 0 && (
          <LayerRenderer 
            layers={children} 
            onLayerClick={onLayerClick}
            onLayerUpdate={onLayerUpdate}
            selectedLayerId={selectedLayerId}
            isEditMode={isEditMode}
            enableDragDrop={enableDragDrop}
            activeLayerId={activeLayerId}
            projected={projected}
          />
        )}
      </Tag>
    );
  };

  return renderContent();
};

export default LayerRenderer;
