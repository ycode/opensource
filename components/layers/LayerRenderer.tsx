'use client';

import React, { useState } from 'react';
import type { Layer } from '../../types';

interface LayerRendererProps {
  layers: Layer[];
  onLayerClick?: (layerId: string) => void;
  onLayerUpdate?: (layerId: string, updates: Partial<Layer>) => void;
  selectedLayerId?: string | null;
  isEditMode?: boolean;
}

const LayerRenderer: React.FC<LayerRendererProps> = ({ 
  layers, 
  onLayerClick,
  onLayerUpdate,
  selectedLayerId,
  isEditMode = true 
}) => {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  return (
    <>
      {layers.map((layer) => {
        const isSelected = selectedLayerId === layer.id;
        const hasChildren = layer.children && layer.children.length > 0;
        const isEditing = editingLayerId === layer.id;
        const isTextEditable = layer.type === 'text' || layer.type === 'heading';
        
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
        
        return (
          <div
            key={layer.id}
            className={`${layer.classes} ${
              isEditMode 
                ? 'relative transition-all cursor-pointer hover:outline hover:outline-2 hover:outline-blue-400/50' 
                : ''
            } ${
              isSelected 
                ? 'outline outline-2 outline-blue-500 outline-offset-2' 
                : ''
            }`}
            onClick={(e) => {
              if (isEditMode && !isEditing) {
                e.stopPropagation();
                onLayerClick?.(layer.id);
              }
            }}
            onDoubleClick={(e) => {
              if (isEditMode) {
                e.stopPropagation();
                startEditing();
              }
            }}
            data-layer-id={layer.id}
            data-layer-type={layer.type}
          >
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
              />
            )}
          </div>
        );
      })}
    </>
  );
};

export default LayerRenderer;



