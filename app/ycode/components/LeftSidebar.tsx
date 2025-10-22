'use client';

/**
 * Left Sidebar - Pages & Layers
 * 
 * Displays pages list and layers tree with navigation icons
 */

import React, { useEffect, useMemo, useState, useRef, useCallback, forwardRef } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { RichTreeViewPro } from '@mui/x-tree-view-pro/RichTreeViewPro';
import { TreeViewBaseItem } from '@mui/x-tree-view/models';
import { useTreeItem } from '@mui/x-tree-view/useTreeItem';
import { TreeItemProvider } from '@mui/x-tree-view/TreeItemProvider';
import { TreeItemDragAndDropOverlay } from '@mui/x-tree-view/TreeItemDragAndDropOverlay';
import { animated, useSpring } from '@react-spring/web';
import { useEditorStore } from '../../../stores/useEditorStore';
import { usePagesStore } from '../../../stores/usePagesStore';
import type { Layer, Page } from '../../../types';
import AssetLibrary from '../../../components/AssetLibrary';
import PageSettingsPanel, { type PageFormData } from './PageSettingsPanel';
import { pagesApi } from '../../../lib/api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

// Create dark theme for MUI
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#18181b',
      paper: '#18181b',
    },
    text: {
      primary: '#d4d4d8',
      secondary: '#a1a1aa',
    },
    primary: {
      main: '#3b82f6',
    },
  },
});

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
}

const CustomTreeItem = forwardRef<HTMLLIElement, CustomTreeItemProps>(
  function CustomTreeItem(props, ref) {
    const { itemId, label, disabled, children, layersForCurrentPage, selectedLayerId } = props;

    const {
      getRootProps,
      getContentProps,
      getIconContainerProps,
      getLabelProps,
      getGroupTransitionProps,
      getDragAndDropOverlayProps,
      status,
    } = useTreeItem({ itemId, label, disabled, rootRef: ref });

    // Find layer data to determine icon
    const layer = useMemo(() => findLayerById(layersForCurrentPage, itemId), [layersForCurrentPage, itemId]);

    const isSelected = selectedLayerId === itemId;
    const isExpanded = status.expanded;
    const hasChildren = Boolean(children);

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
              cursor: 'grab',
              borderRadius: '6px',
              marginBottom: '2px',
              transition: 'all 150ms cubic-bezier(0.25, 0.1, 0.25, 1)',
              backgroundColor: isSelected
                ? '#3b82f6'
                : status.focused
                  ? 'rgba(63, 63, 70, 0.4)'
                  : 'transparent',
              color: isSelected ? '#ffffff' : '#d4d4d8',
              position: 'relative',
            }}
            className="hover:bg-zinc-700/40"
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
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const addBlockPanelRef = useRef<HTMLDivElement>(null);
  const { draftsByPageId, loadPages, loadDraft, addLayer, updateLayer, moveLayer } = usePagesStore();
  const pages = usePagesStore((state) => state.pages);
  const { setSelectedLayerId, setCurrentPageId } = useEditorStore();
  
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

  // Convert Layer[] to MUI TreeViewBaseItem[]
  const convertToTreeItems = useCallback((layers: Layer[]): TreeViewBaseItem[] => {
    return layers.map((layer) => ({
      id: layer.id,
      label: getLayerDisplayName(layer),
      children: layer.children ? convertToTreeItems(layer.children) : undefined,
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
  }, [currentPageId, moveLayer]);

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
    if (!selectedLayerId) return null;
    
    const selectedItem = findLayer(layersForCurrentPage, selectedLayerId);
    if (!selectedItem) return null;
    
    // If selected is a container, add as child
    if (selectedItem.layer.type === 'container') {
      return selectedLayerId;
    }
    
    // Otherwise, add as sibling
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
    <div className="w-80 max-w-80 bg-neutral-950 border-r border-white/10 flex flex-col overflow-hidden p-4">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'pages' | 'layers' | 'assets')} className="flex flex-col flex-1">
          <TabsList className="w-full">
            <TabsTrigger value="layers">Layers</TabsTrigger>
            <TabsTrigger value="pages">Pages</TabsTrigger>
          </TabsList>

          {/* Content */}
          <TabsContent value="layers" className="flex-1 overflow-y-auto overflow-x-hidden mt-0 data-[state=inactive]:hidden">{' '}
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
                        className="absolute top-full right-0 mt-2 w-60 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden"
                      >
                        <div className="p-2 border-b border-zinc-700">
                          <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Add Block</h4>
                        </div>
                        
                        <div className="p-2 space-y-1">
                        <button
                          onClick={() => {
                            if (currentPageId) {
                              const parentId = getParentForNewLayer();
                              addLayer(currentPageId, parentId, 'container');
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
                              const parentId = getParentForNewLayer();
                              addLayer(currentPageId, parentId, 'heading');
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
                              const parentId = getParentForNewLayer();
                              addLayer(currentPageId, parentId, 'text');
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
                              const parentId = getParentForNewLayer();
                              addLayer(currentPageId, parentId, 'image');
                              setShowAddBlockPanel(false);
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
                <div className="text-center py-8 text-zinc-500">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-800 flex items-center justify-center">
                    <svg className="w-6 h-6 text-zinc-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <p className="text-sm text-zinc-400 mb-1">No page selected</p>
                  <p className="text-xs text-zinc-500">
                    Select a page from the Pages tab to start building
                  </p>
                </div>
              ) : layersForCurrentPage.length === 0 ? (
                <div className="text-center py-8 text-zinc-500">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-zinc-800 flex items-center justify-center">
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
                <ThemeProvider theme={darkTheme}>
                  <RichTreeViewPro
                    items={treeItems}
                    selectedItems={selectedLayerId || null}
                    onSelectedItemsChange={(event, itemId) => {
                      if (typeof itemId === 'string') {
                        onLayerSelect(itemId);
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
              )}
              </div>
          </TabsContent>

          <TabsContent value="pages" className="flex-1 overflow-y-auto overflow-x-hidden mt-0 data-[state=inactive]:hidden">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-zinc-300">Pages</h3>
                <button 
                  onClick={handleAddPage}
                  className="w-6 h-6 bg-zinc-800 hover:bg-zinc-700 rounded flex items-center justify-center border border-zinc-700 transition-colors"
                  title="Add Page"
                >
                  <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-2">
                {pages.map((page) => (
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
  return typeLabel;
}




