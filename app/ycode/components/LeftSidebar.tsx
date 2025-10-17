'use client';

/**
 * Left Sidebar - Pages & Layers
 * 
 * Displays pages list and layers tree with navigation icons
 */

import { useEffect, useMemo, useState, useRef } from 'react';
import { useEditorStore } from '../../../stores/useEditorStore';
import { usePagesStore } from '../../../stores/usePagesStore';
import type { Layer, Page } from '../../../types';
import AssetLibrary from '../../../components/AssetLibrary';
import PageSettingsPanel, { type PageFormData } from './PageSettingsPanel';
import { pagesApi } from '../../../lib/api';

interface LeftSidebarProps {
  selectedLayerId: string | null;
  onLayerSelect: (layerId: string) => void;
  currentPageId: string | null;
  onPageSelect: (pageId: string) => void;
}

export default function LeftSidebar({
  selectedLayerId,
  onLayerSelect,
  currentPageId,
  onPageSelect,
}: LeftSidebarProps) {
  const [activeTab, setActiveTab] = useState<'pages' | 'layers' | 'assets'>('layers');
  const [showAddBlockPanel, setShowAddBlockPanel] = useState(false);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [assetMessage, setAssetMessage] = useState<string | null>(null);
  const addBlockPanelRef = useRef<HTMLDivElement>(null);
  const { draftsByPageId, loadPages, loadDraft, addLayer, updateLayer } = usePagesStore();
  const pages = usePagesStore((state) => state.pages);
  const { setSelectedLayerId, setCurrentPageId } = useEditorStore();

  // Load pages and drafts on mount
  useEffect(() => {
    loadPages();
  }, [loadPages]);

  // Auto-select first page if none selected
  useEffect(() => {
    if (Array.isArray(pages) && pages.length > 0 && !currentPageId) {
      const firstPage = pages[0];
      setCurrentPageId(firstPage.id);
      onPageSelect(firstPage.id);
    }
  }, [pages, currentPageId, setCurrentPageId, onPageSelect]);

  // Load draft when page changes
  useEffect(() => {
    if (currentPageId) {
      loadDraft(currentPageId);
    }
  }, [currentPageId, loadDraft]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addBlockPanelRef.current && !addBlockPanelRef.current.contains(event.target as Node)) {
        setShowAddBlockPanel(false);
      }
    };

    if (showAddBlockPanel) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAddBlockPanel]);

  // Handle page create/update
  const handleSavePage = async (pageData: PageFormData) => {
    if (editingPage) {
      // Update existing page
      const response = await pagesApi.update(editingPage.id, pageData);
      if (response.error) {
        throw new Error(response.error);
      }
    } else {
      // Create new page
      const response = await pagesApi.create({
        ...pageData,
        published_version_id: null,
      });
      if (response.error) {
        throw new Error(response.error);
      }
      // If successful, select the new page
      if (response.data) {
        setCurrentPageId(response.data.id);
        onPageSelect(response.data.id);
      }
    }
    
    // Reload pages to show the new/updated page
    await loadPages();
  };

  // Open new page panel
  const handleAddPage = () => {
    setEditingPage(null);
    setShowPageSettings(true);
  };

  // Open edit page panel
  const handleEditPage = (page: Page) => {
    setEditingPage(page);
    setShowPageSettings(true);
  };

  const layersForCurrentPage = useMemo(() => {
    if (! currentPageId) return [];
    const draft = draftsByPageId[currentPageId];
    return draft ? draft.layers : [];
  }, [currentPageId, draftsByPageId]);

  // Find layer by ID in tree
  const findLayerById = (layers: Layer[], layerId: string): Layer | null => {
    for (const layer of layers) {
      if (layer.id === layerId) return layer;
      if (layer.children) {
        const found = findLayerById(layer.children, layerId);
        if (found) return found;
      }
    }
    return null;
  };

  // Handle asset selection
  const handleAssetSelect = (asset: { id: string; public_url: string; filename: string }) => {
    if (!currentPageId) {
      setAssetMessage('❌ Please select a page first');
      setTimeout(() => setAssetMessage(null), 3000);
      return;
    }

    if (!selectedLayerId) {
      setAssetMessage('❌ Please select an image layer first');
      setTimeout(() => setAssetMessage(null), 3000);
      return;
    }

    // Find the selected layer
    const selectedLayer = findLayerById(layersForCurrentPage, selectedLayerId);
    
    if (!selectedLayer) {
      setAssetMessage('❌ Layer not found');
      setTimeout(() => setAssetMessage(null), 3000);
      return;
    }

    // Check if it's an image layer
    if (selectedLayer.type !== 'image') {
      setAssetMessage('❌ Please select an image layer (not a container, text, or heading)');
      setTimeout(() => setAssetMessage(null), 3000);
      return;
    }

    // Update the layer's src
    updateLayer(currentPageId, selectedLayerId, {
      src: asset.public_url,
    });

    setAssetMessage(`✅ Image set: ${asset.filename}`);
    setTimeout(() => setAssetMessage(null), 3000);
  };

  return (
    <div className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('layers')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === 'layers'
                ? 'text-white border-b-2 border-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Layers
          </button>
          <button
            onClick={() => setActiveTab('pages')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === 'pages'
                ? 'text-white border-b-2 border-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Pages
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`flex-1 px-4 py-3 text-sm font-medium ${
              activeTab === 'assets'
                ? 'text-white border-b-2 border-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Assets
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'layers' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-300">Layers</h3>
                <div className="relative">
                  <button 
                    onClick={() => setShowAddBlockPanel(!showAddBlockPanel)}
                    className="w-6 h-6 bg-zinc-800 hover:bg-zinc-700 rounded flex items-center justify-center border border-zinc-700 transition-colors"
                    title="Add Block"
                  >
                    <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Add Block Panel */}
                  {showAddBlockPanel && (
                    <div 
                      ref={addBlockPanelRef}
                      className="absolute top-8 right-0 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl min-w-[200px]"
                    >
                      <div className="p-2">
                        <div className="text-xs text-zinc-400 px-2 py-1 mb-1">Add Block</div>
                        
                        <button
                          onClick={() => {
                            if (currentPageId) {
                              addLayer(currentPageId, null, 'container');
                              setShowAddBlockPanel(false);
                            }
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-700 rounded text-left transition-colors"
                        >
                          <div className="w-8 h-8 bg-zinc-700 rounded flex items-center justify-center">
                            <svg className="w-4 h-4 text-zinc-300" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-zinc-200">Div</div>
                            <div className="text-xs text-zinc-500">Container element</div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            if (currentPageId) {
                              addLayer(currentPageId, null, 'heading');
                              setShowAddBlockPanel(false);
                            }
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-700 rounded text-left transition-colors"
                        >
                          <div className="w-8 h-8 bg-zinc-700 rounded flex items-center justify-center">
                            <svg className="w-4 h-4 text-zinc-300" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6v10h2a1 1 0 010 2H4a1 1 0 010-2h1V5H4a1 1 0 01-1-1zm9 0a1 1 0 011-1h4a1 1 0 110 2h-2v4h2a1 1 0 110 2h-2v4h2a1 1 0 110 2h-4a1 1 0 110-2h1v-4h-1a1 1 0 010-2h1V5h-1a1 1 0 01-1-1z" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-zinc-200">Heading</div>
                            <div className="text-xs text-zinc-500">Title text</div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            if (currentPageId) {
                              addLayer(currentPageId, null, 'text');
                              setShowAddBlockPanel(false);
                            }
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-700 rounded text-left transition-colors"
                        >
                          <div className="w-8 h-8 bg-zinc-700 rounded flex items-center justify-center">
                            <svg className="w-4 h-4 text-zinc-300" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6 4a1 1 0 011-1h6a1 1 0 110 2h-2v10h2a1 1 0 110 2H7a1 1 0 110-2h2V5H7a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-zinc-200">Paragraph</div>
                            <div className="text-xs text-zinc-500">Body text</div>
                          </div>
                        </button>

                        <button
                          onClick={() => {
                            if (currentPageId) {
                              addLayer(currentPageId, null, 'image');
                              setShowAddBlockPanel(false);
                              // Suggest switching to assets tab
                              setAssetMessage('💡 Now go to Assets tab and click "Use" on an image');
                              setTimeout(() => setAssetMessage(null), 5000);
                            }
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-700 rounded text-left transition-colors"
                        >
                          <div className="w-8 h-8 bg-zinc-700 rounded flex items-center justify-center">
                            <svg className="w-4 h-4 text-zinc-300" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-zinc-200">Image</div>
                            <div className="text-xs text-zinc-500">Picture element</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!currentPageId ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-zinc-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-zinc-400 mb-1">No page selected</p>
                  <p className="text-xs text-zinc-500">
                    Select a page from the Pages tab
                  </p>
                </div>
              ) : layersForCurrentPage.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 bg-zinc-800 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-zinc-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-zinc-400 mb-1">No layers yet</p>
                  <p className="text-xs text-zinc-500">
                    Click the + button above to add your first block
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {layersForCurrentPage.map((layer) => (
                    <LayerItem
                      key={layer.id}
                      layer={layer}
                      selectedLayerId={selectedLayerId}
                      onSelect={onLayerSelect}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pages' && (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-300">Pages</h3>
                <button 
                  onClick={handleAddPage}
                  className="w-6 h-6 bg-zinc-800 hover:bg-zinc-700 rounded flex items-center justify-center border border-zinc-700 transition-colors"
                  title="Add new page"
                >
                  <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div className="space-y-1">
                {Array.isArray(pages) && pages.map((page: any) => (
                  <div
                    key={page.id}
                    className={`group relative rounded ${
                      currentPageId === page.id
                        ? 'bg-zinc-700'
                        : 'hover:bg-zinc-800'
                    }`}
                  >
                    <button
                      onClick={() => {
                        onPageSelect(page.id);
                        setCurrentPageId(page.id);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-zinc-300 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                      </svg>
                      <span className="flex-1 truncate">{page.title}</span>
                    </button>
                    
                    {/* Settings button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditPage(page);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-zinc-500 hover:text-white hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Page settings"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'assets' && (
            <div className="relative">
              {assetMessage && (
                <div className="absolute top-2 left-2 right-2 z-10 p-3 bg-zinc-800 border border-zinc-700 rounded text-sm text-white shadow-lg">
                  {assetMessage}
                </div>
              )}
              <AssetLibrary onAssetSelect={handleAssetSelect} />
            </div>
          )}
        </div>

        {/* Page Settings Panel */}
        <PageSettingsPanel
          isOpen={showPageSettings}
          onClose={() => {
            setShowPageSettings(false);
            setEditingPage(null);
          }}
          page={editingPage}
          onSave={handleSavePage}
        />
    </div>
  );
}

// Helper function to get icon for layer type
function getLayerIcon(type: Layer['type']) {
  switch (type) {
    case 'container':
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      );
    case 'text':
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6 4a1 1 0 011-1h6a1 1 0 110 2h-2v10h2a1 1 0 110 2H7a1 1 0 110-2h2V5H7a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
      );
    case 'heading':
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6v10h2a1 1 0 010 2H4a1 1 0 010-2h1V5H4a1 1 0 01-1-1zm9 0a1 1 0 011-1h4a1 1 0 110 2h-2v4h2a1 1 0 110 2h-2v4h2a1 1 0 110 2h-4a1 1 0 110-2h1v-4h-1a1 1 0 010-2h1V5h-1a1 1 0 01-1-1z" />
        </svg>
      );
    case 'image':
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        </svg>
      );
  }
}

// Helper function to get display name for layer
function getLayerDisplayName(layer: Layer): string {
  const typeLabel = layer.type.charAt(0).toUpperCase() + layer.type.slice(1);
  
  // For text/heading layers, show a preview of content
  if ((layer.type === 'text' || layer.type === 'heading') && layer.content) {
    const preview = layer.content.substring(0, 20);
    return `${typeLabel}: ${preview}${layer.content.length > 20 ? '...' : ''}`;
  }
  
  // For containers, show child count
  if (layer.type === 'container' && layer.children && layer.children.length > 0) {
    return `${typeLabel} (${layer.children.length})`;
  }
  
  return typeLabel;
}

// Layer Item Component - Fully Recursive
function LayerItem({
  layer,
  selectedLayerId,
  onSelect,
  depth = 0,
}: {
  layer: Layer;
  selectedLayerId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = layer.children && layer.children.length > 0;

  return (
    <div className="relative">
      {/* Depth Indicator Line */}
      {depth > 0 && (
        <div 
          className="absolute left-0 top-0 bottom-0 w-px bg-zinc-800"
          style={{ left: `${(depth - 1) * 16 + 16}px` }}
        />
      )}
      
      <button
        onClick={() => onSelect(layer.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          // TODO: Show context menu for layer actions
          console.log('Right click on layer:', layer.id);
        }}
        className={`group w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors relative ${
          selectedLayerId === layer.id
            ? 'bg-blue-600 text-white'
            : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        title={getLayerDisplayName(layer)}
      >
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                setExpanded(!expanded);
              }
            }}
            className="w-4 h-4 flex items-center justify-center text-zinc-400 hover:text-white shrink-0 cursor-pointer"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-3 h-3 transition-transform ${
                expanded ? 'rotate-90' : ''
              }`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}

        {/* Drag Handle (for future drag-and-drop) */}
        <span className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-50 text-zinc-500 cursor-move">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zm3 14a1 1 0 100-2 1 1 0 000 2zm0-4a1 1 0 100-2 1 1 0 000 2zm0-4a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
        </span>

        {/* Layer Type Icon */}
        <span className={`shrink-0 ${selectedLayerId === layer.id ? 'text-white' : 'text-zinc-400'}`}>
          {getLayerIcon(layer.type)}
        </span>

        {/* Layer Name */}
        <span className="flex-1 text-left truncate min-w-0">
          {getLayerDisplayName(layer)}
        </span>

        {/* Visibility Toggle */}
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Implement visibility toggle
            console.log('Toggle visibility for:', layer.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              console.log('Toggle visibility for:', layer.id);
            }
          }}
          className="w-4 h-4 shrink-0 flex items-center justify-center text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          aria-label="Toggle visibility"
          title="Toggle visibility"
        >
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {/* Recursively Render Children */}
      {expanded && hasChildren && (
        <div className="space-y-1 mt-1">
          {layer.children!.map((child) => (
            <LayerItem
              key={child.id}
              layer={child}
              selectedLayerId={selectedLayerId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
