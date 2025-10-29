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
<<<<<<< HEAD
import { useCollaborationPresenceStore } from '../../../stores/useCollaborationPresenceStore';
import { useLayerLocks } from '../../../hooks/use-layer-locks';
import { getUserInitials, getDisplayName } from '../../../lib/collaboration-utils';
import type { Layer, Page } from '../../../types';
import AssetLibrary from '../../../components/AssetLibrary';
import PageSettingsPanel, { type PageFormData } from './PageSettingsPanel';
import { pagesApi } from '../../../lib/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import Icon from "@/components/ui/icon";
import {Button} from "@/components/ui/button";
=======
>>>>>>> main

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

<<<<<<< HEAD
// TransitionComponent with React Spring animation
function TransitionComponent(props: any) {
  const { in: open, children, ...other } = props;
  
  const style = useSpring({
    to: {
      opacity: open ? 1 : 0,
      transform: `translate3d(0,${open ? 0 : -10}px,0)`,
      height: open ? 'auto' : 0,
    },
    config: { tension: 200, friction: 20 },
  });

  return (
    <animated.ul style={style} {...other}>
      {children}
    </animated.ul>
  );
}

// Custom Tree Item Component
interface CustomTreeItemProps {
  itemId: string;
  label: string;
  disabled?: boolean;
  children?: React.ReactNode;
  layersForCurrentPage: Layer[];
  selectedLayerId: string | null;
  layerLocks: any; // Layer locks object from useLayerLocks hook
}

const CustomTreeItem = forwardRef<HTMLLIElement, CustomTreeItemProps>(
  function CustomTreeItem(props, ref) {
    const { itemId, label, disabled, children, layersForCurrentPage, selectedLayerId, layerLocks } = props;

    const {
      getRootProps,
      getContentProps,
      getIconContainerProps,
      getLabelProps,
      getGroupTransitionProps,
      getDragAndDropOverlayProps,
      status,
    } = useTreeItem({ itemId, label, disabled, rootRef: ref });

    // Find layer data to determine icon and type
    const layer = useMemo(() => findLayerById(layersForCurrentPage, itemId), [layersForCurrentPage, itemId]);

    const isSelected = selectedLayerId === itemId;
    const isExpanded = status.expanded;

    // Only container layers should show expand/collapse icons
    const hasChildren = layer?.type === 'container' && Boolean(children);

    // Get collaboration data
    const { getUsersByLayer } = useCollaborationPresenceStore();
    const usersOnLayer = getUsersByLayer(itemId);

    // Get layer lock status from parent component
    const isLocked = layerLocks.isLayerLocked(itemId);
    const canEdit = layerLocks.canEditLayer(itemId);

    const contentProps = getContentProps();

    return (
        <TreeItemProvider itemId={itemId} id={itemId}>
        <li
          {...getRootProps()}
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            outline: 0,
          }}
        >
          <div
            {...contentProps}
            style={{
              padding: '4px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: isLocked && !canEdit ? 'not-allowed' : 'grab',
              borderRadius: '6px',
              marginBottom: '2px',
              transition: 'all 150ms cubic-bezier(0.25, 0.1, 0.25, 1)',
              backgroundColor: isSelected
                ? '#3b82f6'
                : status.focused
                  ? 'rgba(63, 63, 70, 0.4)'
                  : 'transparent',
              color: isSelected ? '#ffffff' : isLocked && !canEdit ? '#6b7280' : '#d4d4d8',
              position: 'relative',
              opacity: isLocked && !canEdit ? 0.5 : 1,
              pointerEvents: isLocked && !canEdit ? 'none' : 'auto',
            }}
            className={isLocked && !canEdit ? "" : "hover:bg-zinc-700/40"}
            onMouseDown={(e) => {
              // Change cursor to grabbing on mouse down
              e.currentTarget.style.cursor = 'grabbing';
            }}
            onMouseUp={(e) => {
              // Reset cursor on mouse up
              e.currentTarget.style.cursor = 'grab';
            }}
          >
            {/* Expand/Collapse Icon */}
            <span
              {...getIconContainerProps()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '16px',
                height: '16px',
                transition: 'transform 150ms ease-out',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
            >
              {hasChildren ? (
                <svg
                  className="w-3 h-3 text-zinc-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <span style={{ width: '16px' }} />
              )}
            </span>

            {/* Layer Icon */}
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {getLayerIcon(layer?.type || 'container')}
            </span>

            {/* Label */}
            <span
              {...getLabelProps()}
              style={{
                flexGrow: 1,
                fontSize: '0.875rem',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>

            {/* User Avatars for Collaboration */}
            {usersOnLayer.length > 0 && (
              <div className="flex -space-x-1">
                {usersOnLayer.slice(0, 3).map((user) => (
                  <div
                    key={user.user_id}
                    className="w-5 h-5 rounded-full border-2 border-zinc-800 flex items-center justify-center text-xs font-medium text-white shadow-sm"
                    style={{ backgroundColor: user.color }}
                    title={`${getDisplayName(user.email || '')} is editing this layer`}
                  >
                    {getUserInitials(user.email || '', user.display_name)}
                  </div>
                ))}
                {usersOnLayer.length > 3 && (
                  <div className="w-5 h-5 rounded-full bg-zinc-600 border-2 border-zinc-800 flex items-center justify-center text-xs font-medium text-white shadow-sm">
                    +{usersOnLayer.length - 3}
                  </div>
                )}
              </div>
            )}

            {/* Drag Overlay */}
            <TreeItemDragAndDropOverlay {...getDragAndDropOverlayProps()} />
          </div>

          {/* Animated Children */}
          {children && (
            <TransitionComponent {...getGroupTransitionProps()}>
              {children}
            </TransitionComponent>
          )}
        </li>
      </TreeItemProvider>
    );
  }
);

=======
>>>>>>> main
interface LeftSidebarProps {
  selectedLayerId: string | null;
  selectedLayerIds?: string[]; // New multi-select support
  onLayerSelect: (layerId: string) => void;
  currentPageId: string | null;
  onPageSelect: (pageId: string) => void;
  livePageUpdates: {
    broadcastPageUpdate: (pageId: string, changes: Partial<Page>) => void;
    broadcastPageCreate: (page: Page) => void;
    broadcastPageDelete: (pageId: string) => void;
  };
  liveLayerUpdates: {
    broadcastLayerUpdate: (layerId: string, changes: Partial<Layer>) => void;
    broadcastLayerAdd: (pageId: string, parentLayerId: string | null, layerType: Layer['type'], newLayer: Layer) => void;
    broadcastLayerDelete: (pageId: string, layerId: string) => void;
    broadcastLayerMove: (pageId: string, layerId: string, targetParentId: string | null, targetIndex: number) => void;
  };
  onActiveTabChange: (tab: 'pages' | 'layers' | 'cms') => void;
}

export default function LeftSidebar({
  selectedLayerId,
  selectedLayerIds,
  onLayerSelect,
  currentPageId,
  onPageSelect,
  onActiveTabChange,
  livePageUpdates,
  liveLayerUpdates,
}: LeftSidebarProps) {
  const [activeTab, setActiveTab] = useState<'pages' | 'layers' | 'cms'>('layers');
  const [showElementLibrary, setShowElementLibrary] = useState(false);
  const [showPageSettings, setShowPageSettings] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [assetMessage, setAssetMessage] = useState<string | null>(null);
<<<<<<< HEAD
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const addBlockPanelRef = useRef<HTMLDivElement>(null);
  const { draftsByPageId, loadPages, loadDraft, addLayer, addLayerWithId, updateLayer, moveLayer } = usePagesStore();
  const pages = usePagesStore((state) => state.pages);
  const { setSelectedLayerId, setCurrentPageId } = useEditorStore();
  const layerLocks = useLayerLocks();

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
  }, [onLayerSelect, layerLocks, selectedLayerId]);

=======
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
  
>>>>>>> main
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
        // Broadcast the page creation to other users
        livePageUpdates.broadcastPageCreate(createResponse.data);
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

<<<<<<< HEAD
  // Convert Layer[] to MUI TreeViewBaseItem[]
  const convertToTreeItems = useCallback((layers: Layer[]): TreeViewBaseItem[] => {
    return layers.map((layer) => ({
      id: layer.id,
      label: getLayerDisplayName(layer),
      // Only container/div layers should be expandable
      children: (layer.type === 'container' && layer.children) ? convertToTreeItems(layer.children) : undefined,
    }));
  }, []);

  const treeItems = useMemo(() => {
    return convertToTreeItems(layersForCurrentPage);
  }, [layersForCurrentPage, convertToTreeItems]);

  // Handle item reordering from MUI Tree View
  const handleItemPositionChange = useCallback((params: {
    itemId: string;
    oldPosition: { parentId: string | null; index: number };
    newPosition: { parentId: string | null; index: number };
  }) => {
    if (!currentPageId) return;
    
    const { itemId, newPosition } = params;
    moveLayer(currentPageId, itemId, newPosition.parentId, newPosition.index);

    // Broadcast the layer move to other users
    liveLayerUpdates.broadcastLayerMove(currentPageId, itemId, newPosition.parentId, newPosition.index);
  }, [currentPageId, moveLayer, liveLayerUpdates]);
=======
  // Handle layer reordering from drag & drop
  const handleLayersReorder = useCallback((newLayers: Layer[]) => {
    if (!currentPageId) return;
    setDraftLayers(currentPageId, newLayers);
  }, [currentPageId, setDraftLayers]);
>>>>>>> main

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

  // Helper to add layer with broadcasting
  const handleAddLayer = useCallback((layerType: Layer['type']) => {
    if (!currentPageId) return;

    const parentId = getParentForNewLayer();

    // Generate the layer ID that will be created (same logic as in usePagesStore)
    const newLayerId = `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create the new layer object to broadcast
    const newLayer: Layer = {
      id: newLayerId,
      type: layerType,
      classes: getDefaultClasses(layerType),
      content: getDefaultContent(layerType),
      children: layerType === 'container' ? [] : undefined,
    };

    // Add the layer locally using the same layer object we'll broadcast
    addLayerWithId(currentPageId, parentId, newLayer);

    // Broadcast the layer addition
    console.log('[LAYER-ADD] Broadcasting layer addition:', {
      pageId: currentPageId,
      parentId,
      layerType,
      newLayer
    });
    liveLayerUpdates.broadcastLayerAdd(currentPageId, parentId, layerType, newLayer);
  }, [currentPageId, addLayerWithId, liveLayerUpdates, getParentForNewLayer]);

  // Helper functions for default layer values
  const getDefaultClasses = (type: Layer['type']): string => {
    switch (type) {
      case 'container':
        return 'flex flex-col gap-4 p-8';
      case 'text':
        return 'text-base text-gray-700';
      case 'heading':
        return 'text-2xl font-bold text-gray-900';
      case 'image':
        return 'w-full h-48 object-cover rounded';
      default:
        return '';
    }
  };

  const getDefaultContent = (type: Layer['type']): string | undefined => {
    switch (type) {
      case 'text':
        return 'Edit this text...';
      case 'heading':
        return 'Heading';
      case 'image':
        return '';
      default:
        return undefined;
    }
  };

  // Handle page editing
  const handleEditPage = (page: Page) => {
    setEditingPage(page);
    setShowPageSettings(true);
  };

  const handleSavePage = async (data: PageFormData) => {
    if (!editingPage) return;
    
    try {
      const updateData = {
        title: data.title,
        slug: data.slug,
      };

      await pagesApi.update(editingPage.id, updateData);

      // Broadcast the page update to other users
      livePageUpdates.broadcastPageUpdate(editingPage.id, updateData);
      
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

<<<<<<< HEAD
                    {/* Add Block Panel */}
                    {showAddBlockPanel && (
                      <div
                        ref={addBlockPanelRef}
                        className="absolute top-full right-0 mt-2 w-60 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden"
                      >
                        <div className="p-2 border-b border-zinc-700">
                          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Add Block</h4>
                        </div>
                        
                        <div className="p-2 space-y-1">
                        <button
                          onClick={() => {
                            handleAddLayer('container');
                            setShowAddBlockPanel(false);
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
                            handleAddLayer('heading');
                            setShowAddBlockPanel(false);
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
                            handleAddLayer('text');
                            setShowAddBlockPanel(false);
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
                            handleAddLayer('image');
                            setShowAddBlockPanel(false);
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
=======
            <header className="py-5 flex justify-between">
              <span className="font-medium">Layers</span>
              <div className="-my-1">
                <Button size="xs" variant="secondary" onClick={() => setShowElementLibrary(prev => !prev)}>
                  <Icon name="plus" className={showElementLibrary ? "rotate-45" : "rotate-0"} />
                </Button>
              </div>
            </header>
>>>>>>> main

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
<<<<<<< HEAD
                <ThemeProvider theme={darkTheme}>
                  <RichTreeViewPro
                    items={treeItems}
                    selectedItems={selectedLayerId || null}
                    onSelectedItemsChange={(event, itemIds) => {
                      // Handle both single item and array of items
                      const itemId = Array.isArray(itemIds) ? itemIds[0] : itemIds;
                      if (typeof itemId === 'string') {
                        handleLayerSelect(itemId);
                      }
                    }}
                    expandedItems={expandedItems}
                    onExpandedItemsChange={(event, itemIds) => {
                      setExpandedItems(itemIds as string[]);
                    }}
                    onItemPositionChange={handleItemPositionChange}
                    itemsReordering
                    slots={{
                      item: (props: any) => (
                        <CustomTreeItem
                          {...props}
                          layersForCurrentPage={layersForCurrentPage}
                          selectedLayerId={selectedLayerId}
                          layerLocks={layerLocks}
                        />
                      ),
                    }}
                    sx={{
                      flexGrow: 1,
                      '--TreeView-itemChildrenIndentation': '16px',
                      '& ul': {
                        paddingLeft: '16px',
                      },
                    }}
                  />
                </ThemeProvider>
=======
                <LayersTree
                  layers={layersForCurrentPage}
                  selectedLayerId={selectedLayerId}
                  selectedLayerIds={selectedLayerIds}
                  onLayerSelect={onLayerSelect}
                  onReorder={handleLayersReorder}
                  pageId={currentPageId || ''}
                />
>>>>>>> main
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
