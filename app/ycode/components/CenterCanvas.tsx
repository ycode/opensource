'use client';

/**
 * Center Canvas - Preview Area with Isolated Iframe
 *
 * Shows live preview of the website being built using Tailwind JIT CDN
 */

// 1. React/Next.js
import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';

// 2. External libraries
import { ArrowLeft } from 'lucide-react';

// 3. ShadCN UI
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// 5. Stores
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useEditorUrl } from '@/hooks/use-editor-url';

// 6. Utils
import { sendToIframe, listenToIframe, serializeLayers } from '@/lib/iframe-bridge';
import type { IframeToParentMessage } from '@/lib/iframe-bridge';
import { buildPageTree, getNodeIcon, findHomepage } from '@/lib/page-utils';
import type { PageTreeNode } from '@/lib/page-utils';
import { cn } from '@/lib/utils';

// 7. Types
import type { Layer, Page, PageFolder } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

type ViewportMode = 'desktop' | 'tablet' | 'mobile';

interface CenterCanvasProps {
  selectedLayerId: string | null;
  currentPageId: string | null;
  viewportMode: ViewportMode;
  setViewportMode: (mode: ViewportMode) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
}

const viewportSizes: Record<ViewportMode, { width: string; label: string; icon: string }> = {
  desktop: { width: '1366px', label: 'Desktop', icon: '🖥️' },
  tablet: { width: '768px', label: 'Tablet', icon: '📱' },
  mobile: { width: '375px', label: 'Mobile', icon: '📱' },
};

const CenterCanvas = React.memo(function CenterCanvas({
  selectedLayerId,
  currentPageId,
  viewportMode,
  setViewportMode,
  zoom,
  setZoom,
}: CenterCanvasProps) {
  const [showAddBlockPanel, setShowAddBlockPanel] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [pagePopoverOpen, setPagePopoverOpen] = useState(false);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [iframeHeight, setIframeHeight] = useState<number | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Calculate scaled width for horizontal overflow when zoomed in
  // Include padding (p-8 = 32px per side = 64px total) in the width calculation
  const scaledWidth = useMemo(() => {
    if (zoom <= 100) return undefined;
    const viewportWidth = parseInt(viewportSizes[viewportMode].width);
    const padding = 64; // p-8 = 32px * 2 sides
    return viewportWidth * (zoom / 100) + padding;
  }, [zoom, viewportMode]);

  // Calculate spacer width for horizontal scrolling when zoomed in
  // Spacer should be at least half the container width to allow scrolling in both directions
  const spacerWidth = useMemo(() => {
    if (zoom <= 100) return undefined;
    // Use a large fixed value to ensure scrolling works in both directions
    return '50vw';
  }, [zoom]);

  // Optimize store subscriptions - use selective selectors
  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);
  const addLayerFromTemplate = usePagesStore((state) => state.addLayerFromTemplate);
  const updateLayer = usePagesStore((state) => state.updateLayer);
  const pages = usePagesStore((state) => state.pages);
  const folders = usePagesStore((state) => state.folders);

  const setSelectedLayerId = useEditorStore((state) => state.setSelectedLayerId);
  const activeUIState = useEditorStore((state) => state.activeUIState);
  const editingComponentId = useEditorStore((state) => state.editingComponentId);
  const setCurrentPageId = useEditorStore((state) => state.setCurrentPageId);
  const returnToPageId = useEditorStore((state) => state.returnToPageId);
  const currentPageCollectionItemId = useEditorStore((state) => state.currentPageCollectionItemId);
  const setCurrentPageCollectionItemId = useEditorStore((state) => state.setCurrentPageCollectionItemId);

  const getDropdownItems = useCollectionsStore((state) => state.getDropdownItems);
  const collectionItemsFromStore = useCollectionsStore((state) => state.items);
  const collectionsFromStore = useCollectionsStore((state) => state.collections);
  const collectionFieldsFromStore = useCollectionsStore((state) => state.fields);

  const { routeType, urlState, navigateToLayers, navigateToPage, navigateToPageEdit } = useEditorUrl();
  const components = useComponentsStore((state) => state.components);
  const componentDrafts = useComponentsStore((state) => state.componentDrafts);
  const [collectionItems, setCollectionItems] = useState<Array<{ id: string; label: string }>>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  const layers = useMemo(() => {
    // If editing a component, show component layers
    if (editingComponentId) {
      return componentDrafts[editingComponentId] || [];
    }

    // Otherwise show page layers
    if (!currentPageId) {
      return [];
    }

    const draft = draftsByPageId[currentPageId];
    return draft ? draft.layers : [];
  }, [editingComponentId, componentDrafts, currentPageId, draftsByPageId]);

  // Separate regular pages from error pages
  const { regularPages, errorPages } = useMemo(() => {
    const regular = pages.filter(page => page.error_page === null);
    const errors = pages
      .filter(page => page.error_page !== null)
      .sort((a, b) => (a.error_page || 0) - (b.error_page || 0));
    return { regularPages: regular, errorPages: errors };
  }, [pages]);

  // Build page tree for navigation (only with regular pages)
  const pageTree = useMemo(() => buildPageTree(regularPages, folders), [regularPages, folders]);

  // Create virtual "Error pages" folder node
  const errorPagesNode: PageTreeNode | null = useMemo(() => {
    if (errorPages.length === 0) return null;

    const virtualFolder: PageFolder = {
      id: 'virtual-error-pages-folder',
      name: 'Error pages',
      slug: 'error-pages',
      page_folder_id: null,
      depth: 0,
      order: 999999,
      settings: {},
      is_published: false,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const errorPageNodes: PageTreeNode[] = errorPages.map(page => ({
      id: page.id,
      type: 'page',
      data: page,
      children: [],
    }));

    return {
      id: virtualFolder.id,
      type: 'folder',
      data: virtualFolder,
      children: errorPageNodes,
    };
  }, [errorPages]);

  // Get current page name and icon
  const currentPage = useMemo(() => pages.find(p => p.id === currentPageId), [pages, currentPageId]);
  const currentPageName = currentPage?.name || 'Loading...';
  const currentPageIcon = useMemo(() => {
    if (!currentPage) return 'homepage';
    const node: PageTreeNode = {
      id: currentPage.id,
      type: 'page',
      data: currentPage,
      children: []
    };
    return getNodeIcon(node);
  }, [currentPage]);

  // Get collection ID from current page if it's dynamic
  const collectionId = useMemo(() => {
    if (!currentPage?.is_dynamic) return null;
    return currentPage.settings?.cms?.collection_id || null;
  }, [currentPage]);

  // Load collection items when dynamic page is selected
  useEffect(() => {
    if (!collectionId || !currentPage?.is_dynamic) {
      setCollectionItems([]);
      setIsLoadingItems(false);
      return;
    }

    const loadItems = async () => {
      setIsLoadingItems(true);
      try {
        const itemsWithLabels = await getDropdownItems(collectionId);
        setCollectionItems(itemsWithLabels);
        // Auto-select first item if none selected
        if (!currentPageCollectionItemId && itemsWithLabels.length > 0) {
          setCurrentPageCollectionItemId(itemsWithLabels[0].id);
        }
      } catch (error) {
        console.error('Failed to load collection items:', error);
      } finally {
        setIsLoadingItems(false);
      }
    };

    loadItems();
  }, [collectionId, currentPage?.is_dynamic, getDropdownItems]);

  // Get return page for component edit mode
  const returnToPage = useMemo(() => {
    return returnToPageId ? pages.find(p => p.id === returnToPageId) : null;
  }, [returnToPageId, pages]);

  // Exit component edit mode handler
  const handleExitComponentEditMode = useCallback(async () => {
    const { setEditingComponentId } = useEditorStore.getState();
    const { saveComponentDraft, clearComponentDraft } = useComponentsStore.getState();
    const { updateComponentOnLayers } = usePagesStore.getState();

    if (!editingComponentId) return;

    // Save component draft
    await saveComponentDraft(editingComponentId);

    // Get the updated component
    const updatedComponent = useComponentsStore.getState().getComponentById(editingComponentId);
    if (updatedComponent) {
      // Update all instances across pages
      await updateComponentOnLayers(editingComponentId, updatedComponent.layers);
    }

    // Clear component draft
    clearComponentDraft(editingComponentId);

    // Determine which page to navigate to
    let targetPageId = returnToPageId;
    if (!targetPageId) {
      // No return page - use homepage
      const homePage = findHomepage(pages);
      const defaultPage = homePage || pages[0];
      targetPageId = defaultPage?.id || null;
    }

    // IMPORTANT: Navigate FIRST, then clear state
    // This ensures the navigation happens before component unmounts
    if (targetPageId) {
      // Navigate to the target page
      navigateToLayers(targetPageId);

      // Small delay to ensure navigation starts before clearing state
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Exit edit mode
    setEditingComponentId(null, null);

    // Clear selection
    setSelectedLayerId(null);
  }, [editingComponentId, returnToPageId, pages, setSelectedLayerId, navigateToLayers]);

  // Initialize all folders as collapsed on mount (including virtual error pages folder)
  useEffect(() => {
    const allFolderIds = new Set(folders.map(f => f.id));
    // Also collapse the virtual error pages folder by default
    allFolderIds.add('virtual-error-pages-folder');
    setCollapsedFolderIds(allFolderIds);
  }, [folders]);

  // Toggle folder collapse state
  const toggleFolder = useCallback((folderId: string) => {
    setCollapsedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Handle page selection
  const handlePageSelect = useCallback((pageId: string) => {
    setCurrentPageId(pageId);
    setPagePopoverOpen(false);

    // Navigate to the same route type but with the new page ID
    if (routeType === 'layers') {
      navigateToLayers(pageId);
    } else if (routeType === 'page' && urlState.isEditing) {
      navigateToPageEdit(pageId);
    } else if (routeType === 'page') {
      navigateToPage(pageId);
    } else {
      // Default to layers if no route type
      navigateToLayers(pageId);
    }
  }, [setCurrentPageId, routeType, urlState.isEditing, navigateToLayers, navigateToPage, navigateToPageEdit]);

  // Render page tree recursively
  const renderPageTreeNode = useCallback((node: PageTreeNode, depth: number = 0) => {
    const isFolder = node.type === 'folder';
    const isCollapsed = isFolder && collapsedFolderIds.has(node.id);
    const isCurrentPage = !isFolder && node.id === currentPageId;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.id}>
        <div
          onClick={() => {
            if (isFolder) {
              toggleFolder(node.id);
            } else {
              handlePageSelect(node.id);
            }
          }}
          className={cn(
            "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-pointer items-center gap-1.25 rounded-sm py-1.5 pr-8 pl-2 text-xs outline-hidden select-none data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
            isCurrentPage && 'bg-secondary/50'
          )}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          {/* Expand/Collapse Button */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isFolder) {
                  toggleFolder(node.id);
                }
              }}
              className={cn(
                'size-3 flex items-center justify-center flex-shrink-0',
                isCollapsed ? '' : 'rotate-90'
              )}
            >
              <Icon name="chevronRight" className={cn('size-2.5 opacity-50', isCurrentPage && 'opacity-80')} />
            </button>
          ) : (
            <div className="size-3 flex-shrink-0 flex items-center justify-center">
              <div className={cn('ml-0.25 w-1.5 h-px bg-white opacity-0', isCurrentPage && 'opacity-0')} />
            </div>
          )}

          {/* Icon */}
          <Icon
            name={getNodeIcon(node)}
            className={cn('size-3 mr-0.5', isCurrentPage ? 'opacity-90' : 'opacity-50')}
          />

          {/* Label */}
          <span className="flex-grow text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none">
            {isFolder ? (node.data as PageFolder).name : (node.data as Page).name}
          </span>

          {/* Check indicator */}
          {isCurrentPage && (
            <span className="absolute right-2 flex size-3.5 items-center justify-center">
              <Icon name="check" className="size-3 opacity-50" />
            </span>
          )}

        </div>
        {isFolder && !isCollapsed && node.children && (
          <div>
            {node.children.map(child => renderPageTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }, [collapsedFolderIds, currentPageId, toggleFolder, handlePageSelect]);

  // Send layers to iframe whenever they change
  useEffect(() => {
    if (!iframeReady || !iframeRef.current) return;

    const { layers: serializedLayers, componentMap } = serializeLayers(layers, components);
    sendToIframe(iframeRef.current, {
      type: 'UPDATE_LAYERS',
      payload: {
        layers: serializedLayers,
        selectedLayerId,
        componentMap,
        editingComponentId: editingComponentId || null,
        collectionItems: collectionItemsFromStore,
        collectionFields: collectionFieldsFromStore,
      },
    });
  }, [layers, selectedLayerId, iframeReady, components, editingComponentId, collectionItemsFromStore, collectionFieldsFromStore]);

  // Send breakpoint updates to iframe
  useEffect(() => {
    if (!iframeReady || !iframeRef.current) return;

    sendToIframe(iframeRef.current, {
      type: 'UPDATE_BREAKPOINT',
      payload: { breakpoint: viewportMode },
    });
  }, [viewportMode, iframeReady]);

  // Send UI state updates to iframe
  useEffect(() => {
    if (!iframeReady || !iframeRef.current) return;

    sendToIframe(iframeRef.current, {
      type: 'UPDATE_UI_STATE',
      payload: { uiState: activeUIState },
    });
  }, [activeUIState, iframeReady]);

  // Listen for messages from iframe
  useEffect(() => {
    const handleIframeMessage = (message: IframeToParentMessage) => {

      switch (message.type) {
        case 'READY':
          setIframeReady(true);
          break;

        case 'LAYER_CLICK':
          setSelectedLayerId(message.payload.layerId);
          break;

        case 'LAYER_DOUBLE_CLICK':
          // Text editing is handled inside iframe
          break;

        case 'TEXT_CHANGE_START':
          break;

        case 'TEXT_CHANGE_END':
          if (editingComponentId) {
            // Update layer in component draft
            const { updateComponentDraft } = useComponentsStore.getState();
            const currentDraft = componentDrafts[editingComponentId] || [];

            // Helper to update a layer in the tree
            const updateLayerInTree = (layers: Layer[], layerId: string, updates: Partial<Layer>): Layer[] => {
              return layers.map(layer => {
                if (layer.id === layerId) {
                  return { ...layer, ...updates };
                }
                if (layer.children) {
                  return { ...layer, children: updateLayerInTree(layer.children, layerId, updates) };
                }
                return layer;
              });
            };

            const updatedLayers = updateLayerInTree(currentDraft, message.payload.layerId, {
              text: message.payload.text,
              content: message.payload.text,
            });

            updateComponentDraft(editingComponentId, updatedLayers);
          } else if (currentPageId) {
            // Update layer in page draft
            updateLayer(currentPageId, message.payload.layerId, {
              text: message.payload.text,
              content: message.payload.text,
            });
          }
          break;

        case 'CONTEXT_MENU':
          // Context menu will be handled later
          break;

        case 'CONTENT_HEIGHT':
          setIframeHeight(message.payload.height);
          break;

        case 'DRAG_START':
        case 'DRAG_OVER':
        case 'DROP':
          // Drag-and-drop will be handled later
          break;
      }
    };

    const cleanup = listenToIframe(handleIframeMessage);
    return cleanup;
  }, [currentPageId, editingComponentId, componentDrafts, setSelectedLayerId, updateLayer]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom(Math.min(zoom + 10, 200)); // Max 200%
  }, [zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(Math.max(zoom - 10, 25)); // Min 25%
  }, [zoom, setZoom]);

  const handleZoomTo100 = useCallback(() => {
    setZoom(100);
  }, [setZoom]);

  const handleZoomToFit = useCallback(() => {
    // Calculate zoom to fit based on viewport width
    const canvasContainer = document.querySelector('[data-canvas-container]');
    if (canvasContainer) {
      const containerWidth = canvasContainer.clientWidth - 64; // Account for padding
      const viewportWidth = parseInt(viewportSizes[viewportMode].width);
      const fitZoom = Math.floor((containerWidth / viewportWidth) * 100);
      setZoom(Math.max(25, Math.min(fitZoom, 200)));
    }
  }, [viewportMode, setZoom]);

  const handleAutofit = useCallback(() => {
    // Similar to zoom to fit but with more margin
    const canvasContainer = document.querySelector('[data-canvas-container]');
    if (canvasContainer) {
      const containerWidth = canvasContainer.clientWidth - 128; // More margin
      const viewportWidth = parseInt(viewportSizes[viewportMode].width);
      const fitZoom = Math.floor((containerWidth / viewportWidth) * 100);
      setZoom(Math.max(25, Math.min(fitZoom, 200)));
    }
  }, [viewportMode, setZoom]);

  // Preserve scroll position when zoom changes to prevent bouncing
  const previousZoomRef = useRef(zoom);
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container || zoom <= 100) {
      previousZoomRef.current = zoom;
      return;
    }

    // Only adjust scroll if zoom actually changed
    if (previousZoomRef.current !== zoom && previousZoomRef.current > 100) {
      // Store current scroll position
      const oldScrollLeft = container.scrollLeft;
      const oldScrollTop = container.scrollTop;

      // Calculate zoom ratio
      const zoomRatio = zoom / previousZoomRef.current;

      // Wait for layout to update, then adjust scroll proportionally
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Scale scroll position by zoom ratio to maintain relative position
          container.scrollLeft = oldScrollLeft * zoomRatio;
          container.scrollTop = oldScrollTop * zoomRatio;
        });
      });
    }

    previousZoomRef.current = zoom;
  }, [zoom]);

  // Pan/drag handlers for zoomed canvas
  // Enable panning when zoomed in using middle mouse button or spacebar + drag
  useEffect(() => {
    if (zoom <= 100) {
      setIsPanning(false);
      return;
    }

    const container = canvasContainerRef.current;
    if (!container) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let scrollLeft = 0;
    let scrollTop = 0;
    let spacePressed = false;

    const handleMouseDown = (e: MouseEvent) => {
      // Middle mouse button (button 1) or spacebar + left click
      const canPan = e.button === 1 || (e.button === 0 && spacePressed);

      if (canPan) {
        // Don't pan if clicking on the iframe
        const target = e.target as HTMLElement;
        if (target.tagName === 'IFRAME' || target.closest('iframe')) {
          return;
        }

        isDragging = true;
        setIsPanning(true);
        startX = e.pageX - container.offsetLeft;
        startY = e.pageY - container.offsetTop;
        scrollLeft = container.scrollLeft;
        scrollTop = container.scrollTop;
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      e.preventDefault();
      e.stopPropagation();
      const x = e.pageX - container.offsetLeft;
      const y = e.pageY - container.offsetTop;
      const walkX = (x - startX) * 1; // Scroll speed multiplier
      const walkY = (y - startY) * 1;
      container.scrollLeft = scrollLeft - walkX;
      container.scrollTop = scrollTop - walkY;
    };

    const handleMouseUp = () => {
      isDragging = false;
      setIsPanning(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        spacePressed = true;
        // Prevent page scroll when spacebar is pressed
        if (container.contains(document.activeElement) || document.activeElement === document.body) {
          e.preventDefault();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spacePressed = false;
        if (isDragging) {
          isDragging = false;
          setIsPanning(false);
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      // Only handle spacebar panning here - zoom is handled globally
      if (spacePressed && container.contains(e.target as Node)) {
        // Prevent default scroll when spacebar is held (for panning mode)
        e.preventDefault();
      }
    };

    // Use capture phase to catch events early
    container.addEventListener('mousedown', handleMouseDown, true);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Listen for wheel events on container
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Also listen on iframe contentDocument if it exists (for events inside iframe)
    const iframe = container.querySelector('iframe');
    if (iframe?.contentDocument) {
      iframe.contentDocument.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      container.removeEventListener('mousedown', handleMouseDown, true);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      container.removeEventListener('wheel', handleWheel);

      // Clean up iframe listener
      const iframe = container.querySelector('iframe');
      if (iframe?.contentDocument) {
        iframe.contentDocument.removeEventListener('wheel', handleWheel);
      }
    };
  }, [zoom, setZoom]);

  // Global wheel handler for zoom - works regardless of mouse position
  // This allows zoom to work anywhere in the editor, including inside the iframe
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Only zoom when Ctrl (Windows/Linux) or Cmd (Mac) is pressed
      // On Mac, trackpad pinch automatically sets metaKey
      if (!(e.ctrlKey || e.metaKey)) {
        return; // Let normal scrolling happen
      }

      // Check if user is typing in an input/textarea - don't interfere
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' ||
                             target.tagName === 'TEXTAREA' ||
                             target.isContentEditable;

      if (isInputFocused) {
        return; // Let input scrolling work normally
      }

      // Prevent default browser zoom behavior
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Handle different delta modes - trackpad gestures often use pixels (deltaMode 0)
      let deltaY = e.deltaY;
      if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        deltaY *= 16; // Convert lines to pixels
      } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        deltaY *= 100; // Convert pages to pixels
      }

      // Calculate zoom delta - negative multiplier so scroll up zooms in
      const zoomDelta = deltaY * -1;
      const newZoom = Math.max(25, Math.min(200, zoom + zoomDelta));
      setZoom(Math.round(newZoom));
    };

    // Attach to window for global zoom support (handles events outside iframe)
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [zoom, setZoom]);

  // Also attach zoom handler to iframe contentDocument when ready
  // This ensures zoom works even when iframe is focused/selected
  useEffect(() => {
    if (!iframeReady || !iframeRef.current) return;

    const handleWheel = (e: WheelEvent) => {
      // Only zoom when Ctrl (Windows/Linux) or Cmd (Mac) is pressed
      if (!(e.ctrlKey || e.metaKey)) {
        return;
      }

      // Check if user is typing in an input/textarea - don't interfere
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' ||
                             target.tagName === 'TEXTAREA' ||
                             target.isContentEditable;

      if (isInputFocused) {
        return;
      }

      // Prevent default browser zoom behavior
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Handle different delta modes
      let deltaY = e.deltaY;
      if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        deltaY *= 16;
      } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        deltaY *= 100;
      }

      // Calculate zoom delta - negative multiplier so scroll up zooms in
      const zoomDelta = deltaY * -1;
      const newZoom = Math.max(25, Math.min(200, zoom + zoomDelta));
      setZoom(Math.round(newZoom));
    };

    const iframe = iframeRef.current;
    const contentDoc = iframe?.contentDocument;

    if (contentDoc) {
      contentDoc.addEventListener('wheel', handleWheel, { passive: false });

      return () => {
        if (contentDoc) {
          contentDoc.removeEventListener('wheel', handleWheel);
        }
      };
    }
  }, [iframeReady, zoom, setZoom]);

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Top Bar */}
      <div className="grid grid-cols-3 items-center p-4 border-b bg-background">
        {/* Page Selector or Back to Page Button */}
        {editingComponentId ? (
          <Button
            variant="purple"
            size="sm"
            onClick={handleExitComponentEditMode}
            className="gap-1 w-fit"
          >
            <Icon name="arrowLeft" />
            Back to {returnToPage ? returnToPage.name : 'Homepage'}
          </Button>
        ) : (
          <div className="flex items-center gap-1.5">
            <Popover open={pagePopoverOpen} onOpenChange={setPagePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="input"
                  size="sm"
                  role="combobox"
                  aria-expanded={pagePopoverOpen}
                  className="w-40 justify-between"
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Icon name={currentPageIcon} className="size-3 opacity-50 shrink-0" />
                    <span className="truncate">
                      {currentPageName}
                    </span>
                  </div>
                  <div className="shrink-0">
                    <Icon name="chevronCombo" className="!size-2.5 shrink-0 opacity-50" />
                  </div>
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-auto min-w-60 max-w-96 p-1" align="start">
                <div className="max-h-[400px] overflow-y-auto">
                  {/* Regular pages tree */}
                  {pageTree.length > 0 && pageTree.map(node => renderPageTreeNode(node, 0))}

                  {/* Separator before error pages */}
                  <Separator className="my-1" />

                  {/* Virtual "Error pages" folder */}
                  {errorPagesNode && renderPageTreeNode(errorPagesNode, 0)}

                  {/* Empty state - only show if no pages at all */}
                  {pageTree.length === 0 && !errorPagesNode && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No pages found
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Collection item selector for dynamic pages */}
            {currentPage?.is_dynamic && collectionId && (
              <Select
                value={currentPageCollectionItemId || ''}
                onValueChange={setCurrentPageCollectionItemId}
                disabled={isLoadingItems || collectionItems.length === 0}
              >
                <SelectTrigger className="" size="sm">
                  {isLoadingItems ? (
                    <Spinner className="size-3" />
                  ) : (
                    <Icon name="database" className="size-3" />
                  )}
                </SelectTrigger>

                <SelectContent>
                  {collectionItems.length > 0 ? (
                    collectionItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No items available
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Viewport Controls */}
        <div className="flex justify-center gap-2">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="input" size="sm">
                {zoom}%
                <div>
                  <Icon name="chevronCombo" className="!size-2.5 opacity-50" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleZoomIn}>
                Zoom in
                <DropdownMenuShortcut>⌘+</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleZoomOut}>
                Zoom out
                <DropdownMenuShortcut>⌘-</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleZoomTo100}>
                Zoom to 100%
                <DropdownMenuShortcut>⌘0</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleZoomToFit}>
                Zoom to Fit
                <DropdownMenuShortcut>⌘1</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleAutofit}>
                Autofit
                <DropdownMenuShortcut>⌘2</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
        </div>

        {/* Undo/Redo Buttons */}
        <div className="flex justify-end gap-0">
          <Button size="sm" variant="ghost">
            <Icon name="undo" />
          </Button>
          <Button size="sm" variant="ghost">
            <Icon name="redo" />
          </Button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={canvasContainerRef}
        className={cn(
          'flex-1 overflow-auto bg-neutral-50 dark:bg-neutral-950/80',
          zoom > 100 && isPanning && 'cursor-grabbing',
          zoom > 100 && !isPanning && 'cursor-grab'
        )}
        data-canvas-container
      >
        <div
          className={cn(
            'flex p-8',
            zoom <= 100 ? 'flex-col justify-center items-center' : 'flex-row justify-center items-start'
          )}
          style={{
            minHeight: zoom <= 100 ? '100%' : undefined,
            width: scaledWidth ? `${scaledWidth}px` : undefined,
            minWidth: zoom > 100 ? '100%' : undefined,
            transition: 'width 0.2s ease-out',
          }}
        >
          {zoom <= 100 && (
            <div className="flex-shrink" style={{ flex: '1 1 auto' }} />
          )}
          {zoom > 100 && (
            <div className="flex-shrink-0" style={{ width: spacerWidth }} />
          )}
          <div
            className="bg-white shadow-3xl origin-top flex-shrink-0"
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              width: viewportSizes[viewportMode].width,
              minHeight: zoom > 100 ? '100%' : undefined,
              height: zoom > 100 ? '100%' : (iframeHeight ? `${iframeHeight * zoom / 100}px` : 'auto'),
              transition: 'transform 0.2s ease-out, height 0.2s ease-out',
              willChange: 'transform',
            }}
          >
          {/* Iframe Canvas */}
          {layers.length > 0 ? (
            <iframe
              ref={iframeRef}
              src="/canvas.html"
              className="w-full border-0"
              style={{
                minHeight: '100%',
                height: iframeHeight ? `${iframeHeight}px` : 'auto'
              }}
              title="Canvas Preview"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-12">
              <div className="text-center max-w-md relative">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                  <Icon name="layout" className="w-10 h-10 text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Start building
                </h2>
                <p className="text-gray-600 mb-8">
                  Add your first block to begin creating your page.
                </p>
                <div className="relative inline-block">
                  <Button
                    onClick={() => setShowAddBlockPanel(!showAddBlockPanel)}
                    size="lg"
                    className="gap-2"
                  >
                    <Icon name="plus" className="w-5 h-5" />
                    Add Block
                  </Button>

                  {/* Add Block Panel */}
                  {showAddBlockPanel && currentPageId && (
                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-lg shadow-2xl min-w-[240px]">
                      <div className="p-2">
                        <div className="text-xs text-gray-500 px-3 py-2 mb-1 font-medium">Choose a block</div>

                        <Button
                          onClick={() => {
                            // Always add inside Body container
                            addLayerFromTemplate(currentPageId, 'body', 'div');
                            setShowAddBlockPanel(false);
                          }}
                          variant="ghost"
                          className="w-full justify-start gap-3 px-3 py-3 h-auto"
                        >
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                            <Icon name="container" className="w-5 h-5 text-gray-700" />
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-semibold text-gray-900">Div</div>
                            <div className="text-xs text-gray-500">Container element</div>
                          </div>
                        </Button>

                        <Button
                          onClick={() => {
                            // Always add inside Body container
                            addLayerFromTemplate(currentPageId, 'body', 'heading');
                            setShowAddBlockPanel(false);
                          }}
                          variant="ghost"
                          className="w-full justify-start gap-3 px-3 py-3 h-auto"
                        >
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                            <Icon name="heading" className="w-5 h-5 text-gray-700" />
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-semibold text-gray-900">Heading</div>
                            <div className="text-xs text-gray-500">Title text</div>
                          </div>
                        </Button>

                        <Button
                          onClick={() => {
                            // Always add inside Body container
                            addLayerFromTemplate(currentPageId, 'body', 'p');
                            setShowAddBlockPanel(false);
                          }}
                          variant="ghost"
                          className="w-full justify-start gap-3 px-3 py-3 h-auto"
                        >
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                            <Icon name="type" className="w-5 h-5 text-gray-700" />
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-semibold text-gray-900">Paragraph</div>
                            <div className="text-xs text-gray-500">Body text</div>
                          </div>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>
          {zoom > 100 && (
            <div className="flex-shrink-0" style={{ width: spacerWidth }} />
          )}
          {zoom <= 100 && <div className="flex-shrink" style={{ flex: '1 1 auto' }} />}
        </div>
      </div>
    </div>
  );
});

export default CenterCanvas;
