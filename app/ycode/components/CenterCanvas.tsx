'use client';

/**
 * Center Canvas - Preview Area
 * 
 * Shows live preview of the website being built
 */

import { useMemo, useState } from 'react';
import { usePagesStore } from '../../../stores/usePagesStore';
import { useEditorStore } from '../../../stores/useEditorStore';
import LayerRenderer from '../../../components/layers/LayerRenderer';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Layer } from '../../../types';

type ViewportMode = 'desktop' | 'tablet' | 'mobile';

interface CenterCanvasProps {
  selectedLayerId: string | null;
  currentPageId: string | null;
  viewportMode: ViewportMode;
  setViewportMode: (mode: ViewportMode) => void;
  zoom: number;
  onLayerSelect?: (layerId: string) => void;
  onLayerDeselect?: () => void;
  liveLayerUpdates?: {
    broadcastLayerUpdate: (layerId: string, changes: Partial<Layer>) => void;
  };
}

const viewportSizes: Record<ViewportMode, { width: string; label: string; icon: string }> = {
  desktop: { width: '1200px', label: 'Desktop', icon: '🖥️' },
  tablet: { width: '768px', label: 'Tablet', icon: '📱' },
  mobile: { width: '375px', label: 'Mobile', icon: '📱' },
};

export default function CenterCanvas({
  selectedLayerId,
  currentPageId,
  viewportMode,
  setViewportMode,
  zoom,
  onLayerSelect,
  onLayerDeselect,
  liveLayerUpdates,
}: CenterCanvasProps) {
  const [showAddBlockPanel, setShowAddBlockPanel] = useState(false);
  const { draftsByPageId, addLayer, updateLayer } = usePagesStore();
  const { setSelectedLayerId } = useEditorStore();

  const layers = useMemo(() => {
    if (! currentPageId) {
      return [];
    }
    
    const draft = draftsByPageId[currentPageId];
    return draft ? draft.layers : [];
  }, [currentPageId, draftsByPageId]);

  const handleLayerUpdate = (layerId: string, updates: Partial<Layer>) => {
    if (currentPageId) {
      updateLayer(currentPageId, layerId, updates);
      // Broadcast the update to other users
      if (liveLayerUpdates) {
        liveLayerUpdates.broadcastLayerUpdate(layerId, updates);
      }
    }
  };

  return (
    <div className="flex-1 bg-neutral-900 flex flex-col">
      {/* Breakpoint Controls */}
      <div className="flex items-center justify-center p-4 border-b bg-neutral-950">
        <Tabs value={viewportMode} onValueChange={(value) => setViewportMode(value as ViewportMode)}>
          <TabsList className="w-[240px]">
            <TabsTrigger value="desktop" title="Desktop View">
              Desktop
            </TabsTrigger>
            <TabsTrigger value="tablet" title="Tablet View">
              Tablet
            </TabsTrigger>
            <TabsTrigger value="mobile" title="Mobile View">
              Phone
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {/* Canvas Area */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto bg-neutral-900">
        <div 
          className="bg-white shadow-3xl transition-all origin-top"
          style={{ 
            transform: `scale(${zoom / 100})`,
            width: viewportSizes[viewportMode].width,
            minHeight: '800px',
          }}
        >
          {/* Preview Content */}
          {layers.length > 0 ? (
            <div 
              className="w-full h-full relative"
              onClick={(e) => {
                // Only deselect if clicking on the background (not on a layer)
                if (e.target === e.currentTarget && onLayerDeselect) {
                  onLayerDeselect();
                }
              }}
            >
              <LayerRenderer 
                layers={layers} 
                onLayerClick={onLayerSelect || setSelectedLayerId}
                onLayerUpdate={handleLayerUpdate}
                selectedLayerId={selectedLayerId}
                isEditMode={true}
              />
            </div>
          ) : (
            <div 
              className="w-full h-full flex items-center justify-center p-12"
              onClick={(e) => {
                // Only deselect if clicking on the background
                if (e.target === e.currentTarget && onLayerDeselect) {
                  onLayerDeselect();
                }
              }}
            >
              <div className="text-center max-w-md relative">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                  <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Start building
                </h2>
                <p className="text-gray-600 mb-8">
                  Add your first block to begin creating your page.
                </p>
                <div className="relative inline-block">
                  <button 
                    onClick={() => setShowAddBlockPanel(!showAddBlockPanel)}
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add Block
                  </button>

                  {/* Add Block Panel */}
                  {showAddBlockPanel && currentPageId && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl min-w-[240px]">
                      <div className="p-2">
                        <div className="text-xs text-gray-500 px-3 py-2 mb-1 font-medium">Choose a block</div>
                        
                        <button
                          onClick={() => {
                            addLayer(currentPageId, null, 'container');
                            setShowAddBlockPanel(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 rounded-lg text-left transition-colors"
                        >
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">Div</div>
                            <div className="text-xs text-gray-500">Container element</div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            addLayer(currentPageId, null, 'heading');
                            setShowAddBlockPanel(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 rounded-lg text-left transition-colors"
                        >
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6v10h2a1 1 0 010 2H4a1 1 0 010-2h1V5H4a1 1 0 01-1-1zm9 0a1 1 0 011-1h4a1 1 0 110 2h-2v4h2a1 1 0 110 2h-2v4h2a1 1 0 110 2h-4a1 1 0 110-2h1v-4h-1a1 1 0 010-2h1V5h-1a1 1 0 01-1-1z" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">Heading</div>
                            <div className="text-xs text-gray-500">Title text</div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            addLayer(currentPageId, null, 'text');
                            setShowAddBlockPanel(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-3 hover:bg-gray-50 rounded-lg text-left transition-colors"
                        >
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6 4a1 1 0 011-1h6a1 1 0 110 2h-2v10h2a1 1 0 110 2H7a1 1 0 110-2h2V5H7a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">Paragraph</div>
                            <div className="text-xs text-gray-500">Body text</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
