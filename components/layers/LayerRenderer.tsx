'use client';

import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import LayerLockIndicator from '../collaboration/LayerLockIndicator';
import EditingIndicator from '../collaboration/EditingIndicator';
import { useLayerLocks } from '../../hooks/use-layer-locks';
import type { Layer } from '../../types';

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
  const hasChildren = layer.children && layer.children.length > 0;
  const isEditing = editingLayerId === layer.id;
  const isTextEditable = layer.type === 'text' || layer.type === 'heading';
  const isDragging = activeLayerId === layer.id;
  
  // Get layer lock status
  const { isLayerLocked, canEditLayer } = useLayerLocks();
  const isLocked = isLayerLocked(layer.id);
  const canEdit = canEditLayer(layer.id);

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
      setEditingContent(layer.content || '');
    }
  };

  const finishEditing = () => {
    if (editingLayerId === layer.id && onLayerUpdate) {
      onLayerUpdate(layer.id, { content: editingContent });
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

  return (
    <div
        ref={setNodeRef}
        key={layer.id}
        className={`${layer.classes} ${
          isEditMode 
            ? `relative transition-all duration-100 ${
                !isEditing && !isDragging && !isLocked 
                  ? 'cursor-pointer hover:outline hover:outline-1 hover:outline-blue-400/30' 
                  : ''
              } ${enableDragDrop && !isEditing && !isLocked ? 'cursor-grab active:cursor-grabbing' : ''}` 
            : ''
        } ${
          isSelected && !isLocked
            ? 'outline outline-2 outline-blue-500 outline-offset-1' 
            : ''
        } ${
          isDragging ? 'opacity-30 outline-none' : ''
        } ${
          showProjection ? 'outline outline-1 outline-dashed outline-blue-400 bg-blue-50/10' : ''
        } ${
          isLocked && !canEdit 
            ? 'opacity-50 grayscale-[50%] pointer-events-none select-none filter brightness-90' 
            : ''
        }`}
        style={style}
        {...(enableDragDrop && !isEditing ? { ...attributes, ...listeners } : {})}
        onClick={(e) => {
          if (isLocked && !canEdit) {
            e.stopPropagation();
            e.preventDefault();
            console.warn(`Layer ${layer.id} is locked by another user`);
            return;
          }
          if (isEditMode && !isEditing && canEdit) {
            e.stopPropagation();
            onLayerClick?.(layer.id);
          }
        }}
        onDoubleClick={(e) => {
          if (isEditMode && canEdit) {
            e.stopPropagation();
            startEditing();
          }
        }}
        data-layer-id={layer.id}
        data-layer-type={layer.type}
      >
        {/* Layer Lock Indicator */}
        {isLocked && !canEdit && (
          <LayerLockIndicator 
            layerId={layer.id}
            layerName={layer.type}
            className="absolute inset-0 z-10"
          />
        )}
        
        {/* Editing Indicator for text layers */}
        {isTextEditable && (
          <EditingIndicator 
            layerId={layer.id}
            className="absolute top-1 left-1 z-20"
          />
        )}
            {/* Selection Badge */}
            {isEditMode && isSelected && !isEditing && (
              <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-lg z-10 pointer-events-none">
                {layer.type.charAt(0).toUpperCase() + layer.type.slice(1)} Selected
                {isTextEditable && <span className="ml-2 opacity-75">• Double-click to edit</span>}
              </div>
            )}

            {/* Render Layer Content */}
            {layer.type === 'text' && (
              isEditing ? (
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
              ) : (
                <span>{layer.content || 'Text layer'}</span>
              )
            )}
            
            {layer.type === 'heading' && (
              isEditing ? (
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
              ) : (
                <h1>{layer.content || 'Heading'}</h1>
              )
            )}
            
            {layer.type === 'image' && (
              layer.src ? (
                <img src={layer.src} alt={layer.content || 'Image'} className="max-w-full" />
              ) : (
                <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm">No image</p>
                  </div>
                </div>
              )
            )}

        {/* Recursively Render Children */}
        {hasChildren && (
          <LayerRenderer 
            layers={layer.children!} 
            onLayerClick={onLayerClick}
            onLayerUpdate={onLayerUpdate}
            selectedLayerId={selectedLayerId}
            isEditMode={isEditMode}
            enableDragDrop={enableDragDrop}
            activeLayerId={activeLayerId}
            projected={projected}
          />
        )}
      </div>
  );
};

export default LayerRenderer;
