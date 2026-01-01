'use client';

import React, { useEffect, useMemo, useState, useCallback, startTransition, Suspense, lazy } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// 4. Internal components
import LayersTree from './LayersTree';
import LeftSidebarPages from './LeftSidebarPages';

// Lazy-loaded components (heavy, not needed immediately)
const ElementLibrary = lazy(() => import('./ElementLibrary'));

// 5. Stores
import { useEditorStore } from '@/stores/useEditorStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';

// 5.5 Hooks
import { useEditorUrl, useEditorActions } from '@/hooks/use-editor-url';
import type { EditorTab } from '@/hooks/use-editor-url';
import { useLayerLocks } from '@/hooks/use-layer-locks';

// 6. Types
import type { Layer } from '@/types';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';

interface LeftSidebarProps {
  selectedLayerId: string | null;
  selectedLayerIds?: string[]; // New multi-select support
  onLayerSelect: (layerId: string) => void;
  currentPageId: string | null;
  onPageSelect: (pageId: string) => void;
}

const LeftSidebar = React.memo(function LeftSidebar({
  selectedLayerId,
  selectedLayerIds,
  onLayerSelect,
  currentPageId,
  onPageSelect,
}: LeftSidebarProps) {
  const { sidebarTab, urlState } = useEditorUrl();
  const { openCollection, navigateToLayers, navigateToPage, navigateToCollections } = useEditorActions();
  const [showElementLibrary, setShowElementLibrary] = useState(false);
  const [elementLibraryTab, setElementLibraryTab] = useState<'elements' | 'layouts' | 'components'>('elements');
  const [assetMessage, setAssetMessage] = useState<string | null>(null);
  const [renamingCollectionId, setRenamingCollectionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [hoveredCollectionId, setHoveredCollectionId] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Local state for instant tab switching - syncs with URL but allows immediate UI feedback
  const [localActiveTab, setLocalActiveTab] = useState<EditorTab>(sidebarTab);

  // Sync local tab with URL when URL changes (e.g., from navigation or page load)
  useEffect(() => {
    setLocalActiveTab(sidebarTab);
  }, [sidebarTab]);

  // Optimize store subscriptions - use selective selectors
  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);
  const loadFolders = usePagesStore((state) => state.loadFolders);
  const loadDraft = usePagesStore((state) => state.loadDraft);
  const deletePage = usePagesStore((state) => state.deletePage);
  const updateLayer = usePagesStore((state) => state.updateLayer);
  const setDraftLayers = usePagesStore((state) => state.setDraftLayers);
  const pages = usePagesStore((state) => state.pages);
  const folders = usePagesStore((state) => state.folders);

  const setCurrentPageId = useEditorStore((state) => state.setCurrentPageId);
  const editingComponentId = useEditorStore((state) => state.editingComponentId);

  const componentDrafts = useComponentsStore((state) => state.componentDrafts);
  const getComponentById = useComponentsStore((state) => state.getComponentById);
  const updateComponentDraft = useComponentsStore((state) => state.updateComponentDraft);

  const collections = useCollectionsStore((state) => state.collections);
  const selectedCollectionId = useCollectionsStore((state) => state.selectedCollectionId);
  const setSelectedCollectionId = useCollectionsStore((state) => state.setSelectedCollectionId);
  const createCollection = useCollectionsStore((state) => state.createCollection);
  const updateCollection = useCollectionsStore((state) => state.updateCollection);
  const deleteCollection = useCollectionsStore((state) => state.deleteCollection);

  // Collaboration hooks
  const layerLocks = useLayerLocks();

  // Use local state for immediate tab switching
  const activeTab = localActiveTab;

  // Get component layers if in edit mode
  const editingComponent = editingComponentId ? getComponentById(editingComponentId) : null;

  // Listen for keyboard shortcut to toggle ElementLibrary
  useEffect(() => {
    const handleToggleElementLibrary = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab?: 'elements' | 'layouts' | 'components' }>;
      const tab = customEvent.detail?.tab;

      if (tab) {
        setElementLibraryTab(tab);
        setShowElementLibrary(true);
      } else {
        setShowElementLibrary((prev) => !prev);
      }
    };

    window.addEventListener('toggleElementLibrary', handleToggleElementLibrary);
    return () => window.removeEventListener('toggleElementLibrary', handleToggleElementLibrary);
  }, []);

  // Lock-aware layer selection handler
  const handleLayerSelect = useCallback((layerId: string) => {
    // Check if layer is locked by another user
    const isLocked = layerLocks.isLayerLocked(layerId);
    const canEdit = layerLocks.canEditLayer(layerId);

    if (isLocked && !canEdit) {
      console.warn(`Layer ${layerId} is locked by another user - cannot select`);
      return;
    }

    // Call the original onLayerSelect if not locked
    onLayerSelect(layerId);
  }, [onLayerSelect, layerLocks]);

  const layersForCurrentPage = useMemo(() => {
    // If editing a component, show component layers instead
    if (editingComponentId) {
      return componentDrafts[editingComponentId] || [];
    }

    // Otherwise show page layers
    if (!currentPageId) return [];
    const draft = draftsByPageId[currentPageId];
    return draft ? draft.layers : [];
  }, [editingComponentId, componentDrafts, currentPageId, draftsByPageId]);

  // Handle layer reordering from drag & drop
  const handleLayersReorder = useCallback((newLayers: Layer[]) => {
    // If editing component, update component draft
    if (editingComponentId) {
      updateComponentDraft(editingComponentId, newLayers);
      return;
    }

    // Otherwise update page draft
    if (!currentPageId) return;
    setDraftLayers(currentPageId, newLayers);
  }, [editingComponentId, updateComponentDraft, currentPageId, setDraftLayers]);

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

  // Load draft when page changes (only if not already in store)
  // Wrapped in startTransition so draft loading doesn't block UI updates
  useEffect(() => {
    if (currentPageId && !draftsByPageId[currentPageId]) {
      startTransition(() => {
        loadDraft(currentPageId);
      });
    }
  }, [currentPageId, loadDraft, draftsByPageId]);

  // Preload adjacent page drafts in background for instant navigation
  // Uses requestIdleCallback to avoid blocking the main thread
  useEffect(() => {
    if (!currentPageId || pages.length === 0) return;

    // Find current page index
    const currentIndex = pages.findIndex(p => p.id === currentPageId);
    if (currentIndex === -1) return;

    // Get adjacent pages (2 before, 2 after)
    const adjacentPages = pages.slice(
      Math.max(0, currentIndex - 2),
      Math.min(pages.length, currentIndex + 3)
    ).filter(p => p.id !== currentPageId);

    // Preload drafts that aren't already cached
    const pagesToPreload = adjacentPages.filter(p => !draftsByPageId[p.id]);

    if (pagesToPreload.length === 0) return;

    // Use requestIdleCallback for low-priority background loading
    const preloadDrafts = () => {
      pagesToPreload.forEach((page, index) => {
        // Stagger requests to avoid flooding the server
        setTimeout(() => {
          if (!usePagesStore.getState().draftsByPageId[page.id]) {
            loadDraft(page.id);
          }
        }, index * 100); // 100ms stagger between requests
      });
    };

    // Check if requestIdleCallback is available (not in all browsers)
    if ('requestIdleCallback' in window) {
      const idleCallbackId = requestIdleCallback(preloadDrafts, { timeout: 2000 });
      return () => cancelIdleCallback(idleCallbackId);
    } else {
      // Fallback: use setTimeout with a delay
      const timeoutId = setTimeout(preloadDrafts, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [currentPageId, pages, draftsByPageId, loadDraft]);

  // Handle creating a new collection
  const handleCreateCollection = async () => {
    try {
      // Generate unique collection name
      const baseName = 'Collection';
      let collectionName = baseName;
      let counter = 1;

      // Check if name already exists
      while (collections.some(c => c.name === collectionName)) {
        collectionName = `${baseName} ${counter}`;
        counter++;
      }

      // Create the collection (uuid will be auto-generated by database)
      const newCollection = await createCollection({
        name: collectionName,
        sorting: null,
        order: collections.length,
      });

      // Update tab via URL navigation (will automatically switch tab)
      // Open collection (updates state + URL with inferred tab)
      openCollection(newCollection.id);

      // Enter rename mode for the new collection
      setRenamingCollectionId(newCollection.id);
      setRenameValue(newCollection.name);
    } catch (error) {
      console.error('Failed to create collection:', error);
    }
  };

  // Handle double-click to rename collection
  const handleCollectionDoubleClick = (collection: { id: string; name: string }) => {
    setRenamingCollectionId(collection.id);
    setRenameValue(collection.name);
  };

  // Handle rename submit
  const handleRenameSubmit = async () => {
    if (!renamingCollectionId || !renameValue.trim()) {
      setRenamingCollectionId(null);
      setRenameValue('');
      return;
    }

    try {
      await updateCollection(renamingCollectionId, { name: renameValue.trim() });
      setRenamingCollectionId(null);
      setRenameValue('');
    } catch (error) {
      console.error('Failed to rename collection:', error);
    }
  };

  // Handle rename cancel
  const handleRenameCancel = () => {
    setRenamingCollectionId(null);
    setRenameValue('');
  };

  // Handle collection delete
  const handleCollectionDelete = async (collectionId: string) => {
    // Confirm before deleting
    if (!confirm('Are you sure you want to delete this collection? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteCollection(collectionId);
    } catch (error) {
      console.error('Failed to delete collection:', error);
      alert('Failed to delete collection. Please try again.');
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
    if (selectedItem.layer.name !== 'image') {
      setAssetMessage('❌ Please select an image layer (not a container, text, or heading)');
      setTimeout(() => setAssetMessage(null), 3000);
      return;
    }

    // Update the layer's url
    updateLayer(currentPageId, selectedLayerId, {
      url: asset.public_url,
    });

    setAssetMessage(`✅ Image set: ${asset.filename}`);
    setTimeout(() => setAssetMessage(null), 3000);
  };

  return (
    <>
      <div className="w-64 shrink-0 bg-background border-r flex overflow-hidden p-4 pb-0">
        {/* Tabs */}
        <div className="w-full">
          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              const newTab = value as EditorTab;

              // Immediately update local state for instant UI feedback
              setLocalActiveTab(newTab);
              setShowElementLibrary(false);

              // Defer URL navigation to avoid blocking the UI
              // startTransition marks this as a low-priority update
              startTransition(() => {
                if (newTab === 'layers') {
                  const targetPageId = currentPageId || (pages.length > 0 ? pages[0].id : null);
                  if (targetPageId) {
                    navigateToLayers(targetPageId, urlState.view || undefined, urlState.rightTab || undefined, urlState.layerId || undefined);
                  }
                } else if (newTab === 'pages') {
                  const targetPageId = currentPageId || (pages.length > 0 ? pages[0].id : null);
                  if (targetPageId) {
                    navigateToPage(targetPageId, urlState.view || undefined, urlState.rightTab || undefined, urlState.layerId || undefined);
                  }
                } else if (newTab === 'cms') {
                  const collectionId = selectedCollectionId || (collections.length > 0 ? collections[0].id : null);
                  if (collectionId) {
                    openCollection(collectionId);
                  } else {
                    navigateToCollections();
                  }
                }
              });
            }}
            className="flex-1 gap-0"
          >
            <TabsList className="w-full shrink-0">
              <TabsTrigger value="layers">Layers</TabsTrigger>
              <TabsTrigger value="pages">Pages</TabsTrigger>
              <TabsTrigger value="cms">CMS</TabsTrigger>
            </TabsList>

            <hr className="mt-4" />

            {/* Content - forceMount keeps all tabs mounted for instant switching */}
            <TabsContent
              value="layers" className="flex flex-col min-h-0"
              forceMount
            >
              <header className="py-5 flex justify-between shrink-0">
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

              <div className="flex flex-col flex-1 min-h-0 overflow-y-auto no-scrollbar pb-4">
                {!currentPageId && !editingComponentId ? (
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
                    onLayerSelect={handleLayerSelect}
                    onReorder={handleLayersReorder}
                    pageId={currentPageId || ''}
                  />
                )}
              </div>
            </TabsContent>

            <TabsContent value="pages" forceMount>
              <LeftSidebarPages
                pages={pages}
                folders={folders}
                currentPageId={currentPageId}
                onPageSelect={onPageSelect}
                setCurrentPageId={setCurrentPageId}
              />
            </TabsContent>

            <TabsContent value="cms" forceMount>
              <header className="py-5 flex justify-between">
                <span className="font-medium">Collections</span>
                <div className="-my-1">
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={handleCreateCollection}
                  >
                    <Icon name="plus" />
                  </Button>
                </div>
              </header>

              <div className="flex flex-col">
                {collections.map((collection) => {
                  const isSelected = selectedCollectionId === collection.id;
                  const isRenaming = renamingCollectionId === collection.id;
                  const isHovered = hoveredCollectionId === collection.id;

                  return (
                    <div key={collection.id}>
                      {isRenaming ? (
                        <div className="pl-3 pr-1.5 h-8 rounded-lg flex gap-2 items-center bg-secondary/50">
                          <Icon name="database" className="size-3 shrink-0" />
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRenameSubmit();
                              } else if (e.key === 'Escape') {
                                handleRenameCancel();
                              }
                            }}
                            onBlur={handleRenameCancel}
                            autoFocus
                            className="h-6 px-1 py-0 text-xs rounded-md -ml-1"
                          />
                        </div>
                      ) : (
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              className={cn(
                                'px-3 h-8 rounded-lg flex gap-2 items-center justify-between text-left w-full group cursor-pointer',
                                isSelected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'hover:bg-secondary/50 text-secondary-foreground/80 dark:text-muted-foreground'
                              )}
                              onClick={() => {
                                openCollection(collection.id);
                              }}
                              onContextMenu={() => {
                                setSelectedCollectionId(collection.id);
                              }}
                              onDoubleClick={() => handleCollectionDoubleClick(collection)}
                              onMouseEnter={() => setHoveredCollectionId(collection.id)}
                              onMouseLeave={() => setHoveredCollectionId(null)}
                            >
                              <div className="flex gap-2 items-center">
                                <Icon name="database" className="size-3" />
                                <span>{collection.name}</span>
                              </div>

                              <div className="group-hover:opacity-100 opacity-0">

                                <DropdownMenu
                                  open={openDropdownId === collection.id}
                                  onOpenChange={(open) => setOpenDropdownId(open ? collection.id : null)}
                                >
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="xs"
                                      variant={isSelected ? 'default' : 'ghost'}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                      }}
                                      className="-mr-2"
                                    >
                                      <Icon name="more" className="size-3" />
                                    </Button>
                                  </DropdownMenuTrigger>

                                  <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => handleCollectionDoubleClick(collection)}>
                                      Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleCollectionDelete(collection.id)}>
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>

                                </DropdownMenu>

                              </div>

                              <span className="group-hover:hidden block text-xs opacity-50">
                                {collection.draft_items_count}
                              </span>

                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onClick={() => handleCollectionDoubleClick(collection)}>
                              Rename
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => handleCollectionDelete(collection.id)}>
                              Delete
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      )}
                    </div>
                  );
                })}

                {collections.length === 0 && (
                  <Empty>
                    <EmptyTitle>Collections</EmptyTitle>
                    <EmptyDescription>No collections yet. Click + to create new.</EmptyDescription>
                  </Empty>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Element Library Slide-Out (lazy loaded) */}
      {showElementLibrary && (
        <Suspense fallback={null}>
          <ElementLibrary
            isOpen={showElementLibrary}
            onClose={() => setShowElementLibrary(false)}
            defaultTab={elementLibraryTab}
          />
        </Suspense>
      )}
    </>
  );
});

export default LeftSidebar;
