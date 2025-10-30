'use client';

/**
 * Left Sidebar - Pages & Layers
 * 
 * Displays pages list and layers tree with navigation icons
 */

// 1. React/Next.js
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';

// 3. ShadCN UI
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// 4. Internal components
import AssetLibrary from '../../../components/AssetLibrary';
import ElementLibrary from './ElementLibrary';
import LayersTree from './LayersTree';
import PageSettingsPanel, { type PageFormData } from './PageSettingsPanel';

// 5. Stores
import { useEditorStore } from '../../../stores/useEditorStore';
import { usePagesStore } from '../../../stores/usePagesStore';

// 6. Utils/lib
import { pagesApi } from '../../../lib/api';

// 7. Types
import type { Layer, Page } from '../../../types';

// Helper function to find layer by ID recursively
function findLayerById(layers: Layer[], id: string): Layer | null {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    if (layer.children) {
      const found = findLayerById(layer.children, id);
      if (found) return found;
    }
  }
  return null;
}

interface LeftSidebarProps {
  selectedLayerId: string | null;
  selectedLayerIds?: string[]; // New multi-select support
  onLayerSelect: (layerId: string) => void;
  currentPageId: string | null;
  onPageSelect: (pageId: string) => void;
  onActiveTabChange: (tab: 'pages' | 'layers' | 'cms') => void;
}

export default function LeftSidebar({
  selectedLayerId,
  selectedLayerIds,
  onLayerSelect,
  currentPageId,
  onPageSelect,
  onActiveTabChange,
}: LeftSidebarProps) {
  const [activeTab, setActiveTab] = useState<'pages' | 'layers' | 'cms'>('layers');
  const [showElementLibrary, setShowElementLibrary] = useState(false);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [assetMessage, setAssetMessage] = useState<string | null>(null);
  const { draftsByPageId, loadPages, loadDraft, addLayer, updateLayer, setDraftLayers } = usePagesStore();
  const pages = usePagesStore((state) => state.pages);
  const { setSelectedLayerId, setCurrentPageId } = useEditorStore();
  
  // Listen for keyboard shortcut to toggle ElementLibrary
  useEffect(() => {
    const handleToggleElementLibrary = () => {
      setShowElementLibrary((prev) => !prev);
    };

    window.addEventListener('toggleElementLibrary', handleToggleElementLibrary);
    return () => window.removeEventListener('toggleElementLibrary', handleToggleElementLibrary);
  }, []);
  
  // Handler to create a new page
  const handleAddPage = async () => {
    try {
      // Generate a unique slug based on current timestamp
      const timestamp = Date.now();
      const newPageTitle = `Page ${pages.length + 1}`;
      const newPageSlug = `page-${timestamp}`;
      
      const createResponse = await pagesApi.create({
        title: newPageTitle,
        slug: newPageSlug,
        status: 'draft',
        published_version_id: null,
      });
      
      if (createResponse.error) {
        console.error('Error creating page:', createResponse.error);
        return;
      }
      
      if (createResponse.data) {
        // Reload pages to get the updated list
        await loadPages();
        // Switch to the new page
        onPageSelect(createResponse.data.id);
        setCurrentPageId(createResponse.data.id);
      }
    } catch (error) {
      console.error('Exception creating page:', error);
    }
  };

  const currentPage = useMemo(
    () => pages.find(p => p.id === currentPageId) || null,
    [pages, currentPageId]
  );

  const layersForCurrentPage = useMemo(() => {
    if (!currentPageId) return [];
    const draft = draftsByPageId[currentPageId];
    return draft ? draft.layers : [];
  }, [currentPageId, draftsByPageId]);

  // Handle layer reordering from drag & drop
  const handleLayersReorder = useCallback((newLayers: Layer[]) => {
    if (!currentPageId) return;
    setDraftLayers(currentPageId, newLayers);
  }, [currentPageId, setDraftLayers]);

  // Helper to find layer in tree
  const findLayer = useCallback((layers: Layer[], id: string): { layer: Layer; parentId: string | null } | null => {
    for (const layer of layers) {
      if (layer.id === id) {
        return { layer, parentId: null };
      }
      if (layer.children) {
        const found = findLayer(layer.children, id);
        if (found) {
          return { ...found, parentId: found.parentId || layer.id };
        }
      }
    }
    return null;
  }, []);

  // Load pages on mount
  useEffect(() => {
    loadPages();
  }, [loadPages]);

  // Load draft when page changes
  useEffect(() => {
    if (currentPageId) {
      loadDraft(currentPageId);
    }
  }, [currentPageId, loadDraft]);

  // Helper to get parent for new layers
  const getParentForNewLayer = useCallback((): string | null => {
    if (!selectedLayerId) {
      // No layer selected - add inside Body by default
      const bodyLayer = layersForCurrentPage.find(l => l.id === 'body');
      return bodyLayer ? 'body' : null;
    }
    
    const selectedItem = findLayer(layersForCurrentPage, selectedLayerId);
    if (!selectedItem) {
      // Selected layer not found - add inside Body by default
      const bodyLayer = layersForCurrentPage.find(l => l.id === 'body');
      return bodyLayer ? 'body' : null;
    }
    
    // If selected is a container, add as child
    if (selectedItem.layer.type === 'container') {
      return selectedLayerId;
    }
    
    // Otherwise, add as sibling (same parent)
    // But if parent is null (would be root level), use Body instead
    if (selectedItem.parentId === null) {
      return 'body';
    }
    
    return selectedItem.parentId;
  }, [selectedLayerId, layersForCurrentPage, findLayer]);

  // Handle page editing
  const handleEditPage = (page: Page) => {
    setEditingPage(page);
    setShowPageSettings(true);
  };

  const handleSavePage = async (data: PageFormData) => {
    if (!editingPage) return;
    
    try {
      await pagesApi.update(editingPage.id, {
        title: data.title,
        slug: data.slug,
      });
      
      await loadPages();
      setShowPageSettings(false);
      setEditingPage(null);
    } catch (error) {
      console.error('Failed to save page:', error);
    }
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
    const selectedItem = findLayer(layersForCurrentPage, selectedLayerId);
    
    if (!selectedItem) {
      setAssetMessage('❌ Layer not found');
      setTimeout(() => setAssetMessage(null), 3000);
      return;
    }

    // Check if it's an image layer
    if (selectedItem.layer.type !== 'image') {
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
    <>
      <div className="w-72 shrink-0 bg-neutral-950 border-r border-white/10 flex overflow-hidden p-4">
        {/* Tabs */}
        <Tabs
          value={activeTab} onValueChange={(value) => {
            const newTab = value as 'pages' | 'layers' | 'cms';
            setActiveTab(newTab);
            onActiveTabChange(newTab);
          }}
          className="flex-1 gap-0"
        >
          <TabsList className="w-full">
            <TabsTrigger value="layers">Layers</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
            <TabsTrigger value="cms">CMS</TabsTrigger>
          </TabsList>

          <hr className="mt-4" />

          {/* Content */}
          <TabsContent value="layers">

            <header className="py-5 flex justify-between">
              <span className="font-medium">Layers</span>
              <div className="-my-1">
                <Button
                  size="xs" variant="secondary"
                  onClick={() => setShowElementLibrary(prev => !prev)}
                >
                  <Icon name="plus" className={showElementLibrary ? 'rotate-45' : 'rotate-0'} />
                </Button>
              </div>
            </header>

            <div className="flex flex-col">
              {!currentPageId ? (
                <div className="text-center py-8 text-zinc-500">
                  <p className="text-sm text-zinc-400 mb-1">No page selected</p>
                  <p className="text-xs text-zinc-500">
                    Select a page from the Pages tab to start building
                  </p>
                </div>
              ) : layersForCurrentPage.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <p className="text-sm text-zinc-400 mb-1">No layers yet</p>
                  <p className="text-xs text-zinc-500">
                    Click the + button above to add your first block
                  </p>
                </div>
              ) : (
                <LayersTree
                  layers={layersForCurrentPage}
                  selectedLayerId={selectedLayerId}
                  selectedLayerIds={selectedLayerIds}
                  onLayerSelect={onLayerSelect}
                  onReorder={handleLayersReorder}
                  pageId={currentPageId || ''}
                />
              )}
            </div>

          </TabsContent>

          <TabsContent value="pages">

            <header className="py-5 flex justify-between">
              <span className="font-medium">Pages</span>
              <div className="-my-1">
                <Button
                  size="xs" variant="secondary"
                  onClick={handleAddPage}
                >
                  <Icon name="plus" />
                </Button>
              </div>
            </header>

            <div className="flex flex-col">
              {pages.map((page) => (
                <div
                  key={page.id}
                  className={`group relative rounded ${
                    currentPageId === page.id
                      ? 'bg-zinc-700'
                      : 'hover:bg-zinc-800'
                  }`}
                >
                  <Button
                    onClick={() => {
                      onPageSelect(page.id);
                      setCurrentPageId(page.id);
                    }}
                    variant="ghost"
                    className="w-full justify-start px-3 py-1.5 h-auto text-sm text-zinc-300 flex items-center gap-2"
                  >
                    <Icon name="file-text" className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span className="flex-1 truncate">{page.title}</span>
                  </Button>

                  {/* Settings button */}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditPage(page);
                    }}
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Page settings"
                    aria-label="Page settings"
                  >
                    <Icon name="edit" className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

          </TabsContent>

          <TabsContent value="cms">

            <header className="py-5 flex justify-between">
              <span className="font-medium">Collections</span>
              <div
                className="-my-1"
              >
                <Button
                  size="xs" variant="secondary"
                >
                  <Icon name="plus" />
                </Button>
              </div>
            </header>

            <div className="flex flex-col">
                <div className="px-4 h-8 rounded-lg bg-secondary flex gap-2 items-center">
                  <Icon name="database" className="size-3" />
                  <span>Blog posts</span>
                </div>

                <div className="px-4 h-8 rounded-lg text-muted-foreground flex gap-2 items-center">
                  <Icon name="database" className="size-3" />
                  <span>Categories</span>
                </div>
            </div>

          </TabsContent>
        </Tabs>

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

      {/* Element Library Slide-Out */}
      {showElementLibrary && (
        <ElementLibrary
          isOpen={showElementLibrary}
          onClose={() => setShowElementLibrary(false)}
        />
      )}
    </>
  );
}
