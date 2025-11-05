'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// 4. Internal components
import AssetLibrary from '@/components/AssetLibrary';
import ElementLibrary from './ElementLibrary';
import LayersTree from './LayersTree';
import LeftSidebarPages from './LeftSidebarPages';
import PageSettingsPanel, { type PageFormData } from './PageSettingsPanel';

// 5. Stores
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';

// 6. Utils/lib
import { pagesApi } from '@/lib/api';
import { findLayerById } from '@/lib/layer-utils';

// 7. Types
import type { Layer, Page } from '@/types';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';

// Helper function to find layer with parent context

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
  const [assetMessage, setAssetMessage] = useState<string | null>(null);
  const { draftsByPageId, loadPages, loadFolders, loadDraft, deletePage, addLayer, updateLayer, setDraftLayers } = usePagesStore();
  const pages = usePagesStore((state) => state.pages);
  const folders = usePagesStore((state) => state.folders);
  const { setSelectedLayerId, setCurrentPageId } = useEditorStore();

  // Listen for keyboard shortcut to toggle ElementLibrary
  useEffect(() => {
    const handleToggleElementLibrary = () => {
      setShowElementLibrary((prev) => !prev);
    };

    window.addEventListener('toggleElementLibrary', handleToggleElementLibrary);
    return () => window.removeEventListener('toggleElementLibrary', handleToggleElementLibrary);
  }, []);


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

  // Load pages and folders on mount
  useEffect(() => {
    loadPages();
    loadFolders();
  }, [loadPages, loadFolders]);

  // Load draft when page changes (only if not already in store)
  useEffect(() => {
    if (currentPageId && !draftsByPageId[currentPageId]) {
      loadDraft(currentPageId);
    }
  }, [currentPageId, loadDraft, draftsByPageId]);

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
      <div className="w-64 shrink-0 bg-background border-r flex overflow-hidden p-4">
        {/* Tabs */}
        <Tabs
          value={activeTab} onValueChange={(value) => {
            const newTab = value as 'pages' | 'layers' | 'cms';
            setActiveTab(newTab);
            onActiveTabChange(newTab);
            setShowElementLibrary(false);
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
                  <Icon name="plus" className={`${showElementLibrary ? 'rotate-45' : 'rotate-0'} transition-transform duration-100`} />
                </Button>
              </div>
            </header>

            <div className="flex flex-col flex-1">
              {!currentPageId ? (
                <Empty>
                  <EmptyTitle>No page selected</EmptyTitle>
                  <EmptyDescription>Select a page from the Pages tab to start building</EmptyDescription>
                </Empty>
              ) : layersForCurrentPage.length === 0 ? (
                  <Empty>
                    <EmptyTitle>No layers yet</EmptyTitle>
                    <EmptyDescription>Click the + button above to add your first block</EmptyDescription>
                  </Empty>
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
            <LeftSidebarPages
              pages={pages}
              folders={folders}
              currentPageId={currentPageId}
              onPageSelect={onPageSelect}
              setCurrentPageId={setCurrentPageId}
            />
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
