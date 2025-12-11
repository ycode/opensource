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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

// 4. Hooks
import { useEditorUrl } from '@/hooks/use-editor-url';
import { useZoom } from '@/hooks/use-zoom';

// 5. Stores
import { useEditorStore } from '@/stores/useEditorStore';
import { usePagesStore } from '@/stores/usePagesStore';
import { useComponentsStore } from '@/stores/useComponentsStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { useCollectionLayerStore } from '@/stores/useCollectionLayerStore';

// 6. Utils
import { sendToIframe, listenToIframe, serializeLayers } from '@/lib/iframe-bridge';
import type { IframeToParentMessage } from '@/lib/iframe-bridge';
import { buildPageTree, getNodeIcon, findHomepage, buildSlugPath, buildDynamicPageUrl } from '@/lib/page-utils';
import type { PageTreeNode } from '@/lib/page-utils';
import { cn } from '@/lib/utils';
import { getCollectionVariable } from '@/lib/layer-utils';
import { CANVAS_BORDER, CANVAS_PADDING } from '@/lib/canvas-utils';

// 7. Types
import type { Layer, Page, PageFolder, CollectionField } from '@/types';
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
}: CenterCanvasProps) {
  const [showAddBlockPanel, setShowAddBlockPanel] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const [pagePopoverOpen, setPagePopoverOpen] = useState(false);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Track iframe content height from iframe reports
  const [reportedContentHeight, setReportedContentHeight] = useState(0);

  // Track container height for dynamic alignment
  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  // Store initial canvas height and zoom on load - this sets the iframe height once
  const initialCanvasHeightRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number | null>(null);
  const [initialZoomSet, setInitialZoomSet] = useState(false);

  // Optimize store subscriptions - use selective selectors
  const draftsByPageId = usePagesStore((state) => state.draftsByPageId);
  const addLayerFromTemplate = usePagesStore((state) => state.addLayerFromTemplate);
  const updateLayer = usePagesStore((state) => state.updateLayer);
  const deleteLayer = usePagesStore((state) => state.deleteLayer);
  const deleteLayers = usePagesStore((state) => state.deleteLayers);
  const pages = usePagesStore((state) => state.pages);
  const folders = usePagesStore((state) => state.folders);

  const setSelectedLayerId = useEditorStore((state) => state.setSelectedLayerId);
  const selectedLayerIds = useEditorStore((state) => state.selectedLayerIds);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const activeUIState = useEditorStore((state) => state.activeUIState);
  const editingComponentId = useEditorStore((state) => state.editingComponentId);
  const setCurrentPageId = useEditorStore((state) => state.setCurrentPageId);
  const returnToPageId = useEditorStore((state) => state.returnToPageId);
  const currentPageCollectionItemId = useEditorStore((state) => state.currentPageCollectionItemId);
  const setCurrentPageCollectionItemId = useEditorStore((state) => state.setCurrentPageCollectionItemId);
  const hoveredLayerId = useEditorStore((state) => state.hoveredLayerId);
  const isPreviewMode = useEditorStore((state) => state.isPreviewMode);

  // Reset iframe ready state when switching between preview/editor mode or changing pages
  useEffect(() => {
    setIframeReady(false);
  }, [isPreviewMode, currentPageId]);

  // Load draft when page changes (ensure draft exists before rendering)
  const loadDraft = usePagesStore((state) => state.loadDraft);
  useEffect(() => {
    if (currentPageId && !draftsByPageId[currentPageId]) {
      loadDraft(currentPageId);
    }
  }, [currentPageId, loadDraft, draftsByPageId]);

  const getDropdownItems = useCollectionsStore((state) => state.getDropdownItems);
  const collectionItemsFromStore = useCollectionsStore((state) => state.items);
  const collectionsFromStore = useCollectionsStore((state) => state.collections);
  const collectionFieldsFromStore = useCollectionsStore((state) => state.fields);

  // Collection layer store for independent layer data
  const collectionLayerData = useCollectionLayerStore((state) => state.layerData);
  const referencedItems = useCollectionLayerStore((state) => state.referencedItems);
  const fetchReferencedCollectionItems = useCollectionLayerStore((state) => state.fetchReferencedCollectionItems);

  const { routeType, urlState, navigateToLayers, navigateToPage, navigateToPageEdit, updateQueryParams } = useEditorUrl();
  const components = useComponentsStore((state) => state.components);
  const componentDrafts = useComponentsStore((state) => state.componentDrafts);
  const [collectionItems, setCollectionItems] = useState<Array<{ id: string; label: string }>>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Parse viewport width
  const viewportWidth = useMemo(() => {
    return parseInt(viewportSizes[viewportMode].width);
  }, [viewportMode]);

  // Calculate default iframe height to fill canvas (set once on load)
  const defaultCanvasHeight = useMemo(() => {
    if (!containerHeight) return 600;
    const calculatedHeight = containerHeight - CANVAS_PADDING;

    // Store the initial height when first calculated
    if (initialCanvasHeightRef.current === null) {
      initialCanvasHeightRef.current = calculatedHeight;
    }

    // Always use the initial height - don't change with zoom or container changes
    return initialCanvasHeightRef.current;
  }, [containerHeight]);

  // Effective iframe height: max of reported content and canvas height
  // This ensures Body fills canvas (min-height: 100%), but iframe shrinks when content is removed
  const iframeContentHeight = useMemo(() => {
    // Use max of reported content and canvas height
    // When content is small: iframe = canvas height, Body fills it with min-height: 100%
    // When content is large: iframe = content height, and shrinks when content is deleted
    return Math.max(reportedContentHeight, defaultCanvasHeight);
  }, [reportedContentHeight, defaultCanvasHeight]);

  // Calculate "zoom to fit" level - where scaled height equals container height
  const zoomToFitLevel = useMemo(() => {
    if (!containerHeight || !iframeContentHeight) return 100;
    return ((containerHeight - CANVAS_PADDING) / iframeContentHeight) * 100;
  }, [containerHeight, iframeContentHeight]);

  // Calculate content height for zoom calculations
  // Use actual iframe content height for both modes
  // This allows "Fit height" to zoom based on document content, not viewport
  const zoomContentHeight = iframeContentHeight;

  // Initialize zoom hook
  const {
    zoom,
    zoomMode,
    zoomIn,
    zoomOut,
    setZoomTo,
    resetZoom,
    zoomToFit,
    autofit,
    handleZoomGesture,
  } = useZoom({
    containerRef: canvasContainerRef,
    contentWidth: viewportWidth,
    contentHeight: zoomContentHeight,
    minZoom: 10,
    maxZoom: 1000,
    zoomStep: 10,
  });

  // Determine if we should center (zoomed out beyond "zoom to fit" level)
  const shouldCenter = zoom < zoomToFitLevel;

  // Set initial zoom once after autofit runs (when zoom changes from default 100)
  useEffect(() => {
    if (initialZoomRef.current === null && zoom > 0 && zoom !== 100) {
      initialZoomRef.current = zoom;
      setInitialZoomSet(true); // Trigger recalculation of finalIframeHeight
    }
  }, [zoom]);

  // Calculate final iframe height - compensate for initial zoom if needed
  const finalIframeHeight = useMemo(() => {
    const initialZoom = initialZoomRef.current;

    // If initial zoom < 100%, calculate the compensated height
    if (initialZoom && initialZoom < 100) {
      const compensatedHeight = defaultCanvasHeight / (initialZoom / 100);
      // Use the larger of: compensated height or content height
      // This ensures iframe doesn't shrink when adding small content
      return Math.max(compensatedHeight, iframeContentHeight);
    }

    return iframeContentHeight;
  }, [iframeContentHeight, defaultCanvasHeight]);

  // Recalculate autofit when viewport/breakpoint changes
  const prevViewportMode = useRef(viewportMode);
  useEffect(() => {
    if (prevViewportMode.current !== viewportMode) {
      // Small delay to ensure container dimensions are updated
      setTimeout(() => {
        autofit();
      }, 50);
      prevViewportMode.current = viewportMode;
    }
  }, [viewportMode, autofit]);

  // Recalculate zoom when content height becomes ready in preview mode
  const hasRecalculatedForContent = useRef(false);
  useEffect(() => {
    // In preview mode, wait for meaningful content height then recalculate once
    if (isPreviewMode && !hasRecalculatedForContent.current && iframeContentHeight > 600) {
      hasRecalculatedForContent.current = true;
      // Delay to ensure everything is ready
      setTimeout(() => {
        if (zoomMode === 'autofit') {
          autofit();
        } else if (zoomMode === 'fit') {
          zoomToFit();
        }
      }, 150);
    }
  }, [isPreviewMode, iframeContentHeight, zoomMode, autofit, zoomToFit]);

  // Reset flag when preview mode changes
  useEffect(() => {
    hasRecalculatedForContent.current = false;
  }, [isPreviewMode]);

  // Track container dimensions for dynamic alignment
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const updateContainerDimensions = () => {
      setContainerHeight(container.clientHeight);
      setContainerWidth(container.clientWidth);
    };

    updateContainerDimensions();
    const resizeObserver = new ResizeObserver(updateContainerDimensions);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

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

  // Check if canvas is empty (only Body layer with no children)
  const isCanvasEmpty = useMemo(() => {
    if (layers.length === 0) return false; // No layers at all - handled separately

    // Find Body layer
    const bodyLayer = layers.find(layer => layer.id === 'body' || layer.name === 'body');

    if (!bodyLayer) return false;

    // Check if Body has no children or empty children array
    const hasNoChildren = !bodyLayer.children || bodyLayer.children.length === 0;

    // Canvas is empty if we only have Body with no children
    return layers.length === 1 && hasNoChildren;
  }, [layers]);

  // Fetch collection data for all collection layers in the page
  const fetchLayerData = useCollectionLayerStore((state) => state.fetchLayerData);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create a stable string representation of collection layer settings for dependency
  const collectionLayersKey = useMemo(() => {
    const extractCollectionSettings = (layerList: Layer[]): string[] => {
      const settings: string[] = [];
      layerList.forEach((layer) => {
        const collectionVariable = getCollectionVariable(layer);
        if (collectionVariable?.id) {
          settings.push(`${layer.id}:${collectionVariable.id}:${collectionVariable.sort_by ?? ''}:${collectionVariable.sort_order ?? ''}:${collectionVariable.limit ?? ''}:${collectionVariable.offset ?? ''}`);
        }
        if (layer.children && layer.children.length > 0) {
          settings.push(...extractCollectionSettings(layer.children));
        }
      });
      return settings;
    };

    return extractCollectionSettings(layers).join('|');
  }, [layers]);

  // Debounce the fetch to prevent duplicate calls during rapid updates
  useEffect(() => {
    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Set new timeout
    fetchTimeoutRef.current = setTimeout(() => {
      // Recursively find all collection layers and fetch their data
      const findAndFetchCollectionLayers = (layerList: Layer[]) => {
        layerList.forEach((layer) => {
          const collectionVariable = getCollectionVariable(layer);
          if (collectionVariable?.id) {
            fetchLayerData(
              layer.id,
              collectionVariable.id,
              collectionVariable.sort_by,
              collectionVariable.sort_order,
              collectionVariable.limit,
              collectionVariable.offset
            );
          }

          // Recursively check children
          if (layer.children && layer.children.length > 0) {
            findAndFetchCollectionLayers(layer.children);
          }
        });
      };

      if (layers.length > 0) {
        findAndFetchCollectionLayers(layers);
      }

      fetchTimeoutRef.current = null;
    }, 100); // 100ms debounce - waits for rapid updates to settle

    // Cleanup function
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, [collectionLayersKey, fetchLayerData, layers]);

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

  const pageCollectionItem = useMemo(() => {
    if (!currentPage?.is_dynamic) {
      return null;
    }

    // First, check if we have an optimistically updated item in the draft
    if (currentPageId) {
      const draft = draftsByPageId[currentPageId];
      if (draft && (draft as any).collectionItem) {
        return (draft as any).collectionItem;
      }
    }

    // Fall back to fetching from collections store
    const collectionId = currentPage.settings?.cms?.collection_id;
    if (!collectionId || !currentPageCollectionItemId) {
      return null;
    }
    const itemsForCollection = collectionItemsFromStore[collectionId] || [];
    return itemsForCollection.find((item) => item.id === currentPageCollectionItemId) || null;
  }, [currentPage, currentPageId, currentPageCollectionItemId, collectionItemsFromStore, draftsByPageId]);

  const pageCollectionFields = useMemo(() => {
    if (!currentPage?.is_dynamic) {
      return [];
    }
    const collectionId = currentPage.settings?.cms?.collection_id;
    if (!collectionId) {
      return [];
    }
    return collectionFieldsFromStore[collectionId] || [];
  }, [currentPage, collectionFieldsFromStore]);

  // Build preview URL for preview mode
  const previewUrl = useMemo(() => {
    if (!currentPage) return '';

    // Error pages use special preview route
    if (currentPage.error_page !== null) {
      return `/ycode/preview/error-pages/${currentPage.error_page}`;
    }

    // Build full page path including folders
    const fullPagePath = buildSlugPath(currentPage, folders, 'page');

    // Get collection item slug value for dynamic pages
    const collectionItemSlug = currentPage.is_dynamic && currentPageCollectionItemId
      ? (() => {
        const collectionId = currentPage.settings?.cms?.collection_id;
        const slugFieldId = currentPage.settings?.cms?.slug_field_id;

        if (!collectionId || !slugFieldId) return null;

        const collectionItems = collectionItemsFromStore[collectionId] || [];
        const selectedItem = collectionItems.find(item => item.id === currentPageCollectionItemId);

        if (!selectedItem || !selectedItem.values) return null;

        return selectedItem.values[slugFieldId] || null;
      })()
      : null;

    // For dynamic pages, use buildDynamicPageUrl to ensure slug value is always current
    const path = currentPage.is_dynamic
      ? buildDynamicPageUrl(currentPage, folders, collectionItemSlug)
      : fullPagePath;

    return `/ycode/preview${path === '/' ? '' : path}`;
  }, [currentPage, folders, currentPageCollectionItemId, collectionItemsFromStore]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Query params (including preview) are now preserved automatically by the navigation functions
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

  // Send layers to iframe whenever they change (excludes selection to avoid re-renders)
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
        collectionItems: { ...collectionItemsFromStore, ...referencedItems },
        collectionFields: collectionFieldsFromStore,
        pageCollectionItem,
        pageCollectionFields,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    layers,
    iframeReady,
    components,
    editingComponentId,
    collectionItemsFromStore,
    referencedItems,
    collectionFieldsFromStore,
    pageCollectionItem,
    pageCollectionFields,
  ]);

  // Send selection updates separately to avoid full re-renders
  useEffect(() => {
    if (!iframeReady || !iframeRef.current) return;

    sendToIframe(iframeRef.current, {
      type: 'UPDATE_SELECTION',
      payload: { layerId: selectedLayerId },
    });
  }, [selectedLayerId, iframeReady]);

  // Send collection layer data to iframe whenever it changes
  useEffect(() => {
    if (!iframeReady || !iframeRef.current) return;

    // Send each layer's data separately
    Object.entries(collectionLayerData).forEach(([layerId, items]) => {
      sendToIframe(iframeRef.current!, {
        type: 'COLLECTION_LAYER_DATA',
        payload: { layerId, items },
      });
    });
  }, [collectionLayerData, iframeReady]);

  // Fetch referenced collection items recursively when layers with reference fields are detected
  useEffect(() => {
    // Recursively find all referenced collection IDs by following reference chains
    const findAllReferencedCollections = (
      fieldsMap: Record<string, CollectionField[]>,
      visited: Set<string> = new Set()
    ): Set<string> => {
      const referencedIds = new Set<string>();

      const processFields = (fields: CollectionField[]) => {
        fields.forEach((field) => {
          if (field.type === 'reference' && field.reference_collection_id) {
            const refId = field.reference_collection_id;
            if (!visited.has(refId)) {
              referencedIds.add(refId);
              visited.add(refId);

              // Recursively check the referenced collection's fields
              const refFields = fieldsMap[refId];
              if (refFields) {
                processFields(refFields);
              }
            }
          }
        });
      };

      // Process all loaded collection fields
      Object.values(fieldsMap).forEach(processFields);

      return referencedIds;
    };

    // Start with loaded fields
    const allReferencedIds = findAllReferencedCollections(collectionFieldsFromStore);

    // Also check page collection fields
    if (pageCollectionFields) {
      pageCollectionFields.forEach((field) => {
        if (field.type === 'reference' && field.reference_collection_id) {
          allReferencedIds.add(field.reference_collection_id);
        }
      });
    }

    // Fetch items for each referenced collection
    allReferencedIds.forEach((collectionId) => {
      fetchReferencedCollectionItems(collectionId);
    });
  }, [collectionFieldsFromStore, pageCollectionFields, fetchReferencedCollectionItems]);

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

  // Send hover updates to iframe
  useEffect(() => {
    if (!iframeReady || !iframeRef.current) return;

    sendToIframe(iframeRef.current, {
      type: 'UPDATE_HOVER',
      payload: { layerId: hoveredLayerId },
    });
  }, [hoveredLayerId, iframeReady]);

  // Listen for messages from iframe
  useEffect(() => {
    const handleIframeMessage = (message: IframeToParentMessage) => {

      switch (message.type) {
        case 'READY':
          setIframeReady(true);
          break;

        case 'LAYER_CLICK':
          // Disable layer selection in preview mode
          if (!isPreviewMode) {
            setSelectedLayerId(message.payload.layerId);
            // Focus the iframe so it can receive keyboard events
            if (iframeRef.current) {
              iframeRef.current.focus();
            }
          }
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
            });

            updateComponentDraft(editingComponentId, updatedLayers);
          } else if (currentPageId) {
            // Update layer in page draft
            updateLayer(currentPageId, message.payload.layerId, {
              text: message.payload.text,
            });
          }
          break;

        case 'OPEN_COLLECTION_ITEM_SHEET':
          const { openCollectionItemSheet } = useEditorStore.getState();

          openCollectionItemSheet(
            message.payload.collectionId,
            message.payload.itemId
          );
          break;

        case 'CONTEXT_MENU':
          // Context menu will be handled later
          break;

        case 'ZOOM_GESTURE':
          // Handle zoom gestures from iframe (Ctrl+wheel, trackpad pinch, keyboard shortcuts)
          if (message.payload.reset) {
            resetZoom();
          } else if (message.payload.zoomToFit) {
            zoomToFit();
          } else if (message.payload.autofit) {
            autofit();
          } else {
            handleZoomGesture(message.payload.delta);
          }
          break;

        case 'CONTENT_HEIGHT':
          // Update reported content height from iframe
          setReportedContentHeight(message.payload.height);
          break;

        case 'DELETE_LAYER':
          // Handle layer deletion from iframe (Delete/Backspace key)
          if (selectedLayerId && currentPageId) {
            // Check if multi-select
            if (selectedLayerIds.length > 1) {
              // Delete all selected layers
              deleteLayers(currentPageId, selectedLayerIds);
              clearSelection();
            } else {
              // Single layer deletion
              const draft = draftsByPageId[currentPageId];
              if (draft) {
                // Helper to find next layer to select
                const findNextLayerToSelect = (layers: Layer[], layerIdToDelete: string): string | null => {
                  const findLayerContext = (
                    tree: Layer[],
                    targetId: string,
                    parent: Layer | null = null
                  ): { layer: Layer; parent: Layer | null; siblings: Layer[] } | null => {
                    for (let i = 0; i < tree.length; i++) {
                      const node = tree[i];
                      if (node.id === targetId) {
                        return { layer: node, parent, siblings: tree };
                      }
                      if (node.children) {
                        const found = findLayerContext(node.children, targetId, node);
                        if (found) return found;
                      }
                    }
                    return null;
                  };

                  const context = findLayerContext(layers, layerIdToDelete);
                  if (!context) return null;

                  const { parent, siblings } = context;
                  const currentIndex = siblings.findIndex(s => s.id === layerIdToDelete);

                  // Try next sibling
                  if (currentIndex < siblings.length - 1) {
                    return siblings[currentIndex + 1].id;
                  }

                  // Try previous sibling
                  if (currentIndex > 0) {
                    return siblings[currentIndex - 1].id;
                  }

                  // Select parent (or null if no parent)
                  return parent ? parent.id : null;
                };

                const nextLayerId = findNextLayerToSelect(draft.layers, selectedLayerId);
                deleteLayer(currentPageId, selectedLayerId);
                setSelectedLayerId(nextLayerId);
              }
            }
          }
          break;

        case 'UPDATE_GAP':
          // Handle gap value update from drag interaction
          if (message.payload.layerId && currentPageId) {
            const layerId = message.payload.layerId;
            const newGapValue = message.payload.gapValue;

            // Get current layer to update its classes
            const draft = draftsByPageId[currentPageId];
            if (draft) {
              // Helper to find and update layer
              const updateGapInLayer = (layers: Layer[]): Layer[] => {
                return layers.map(layer => {
                  if (layer.id === layerId) {
                    // Get current classes
                    const currentClasses = Array.isArray(layer.classes) 
                      ? layer.classes.join(' ') 
                      : (layer.classes || '');

                    // Remove existing gap classes
                    let newClasses = currentClasses
                      .split(' ')
                      .filter(cls => !cls.startsWith('gap-'))
                      .join(' ');

                    // Add new gap class with arbitrary value
                    newClasses = `${newClasses} gap-[${newGapValue}]`.trim();

                    return { ...layer, classes: newClasses };
                  }
                  if (layer.children) {
                    return { ...layer, children: updateGapInLayer(layer.children) };
                  }
                  return layer;
                });
              };

              const updatedLayers = updateGapInLayer(draft.layers);
              usePagesStore.getState().setDraftLayers(currentPageId, updatedLayers);
            }
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPageId, editingComponentId, componentDrafts, setSelectedLayerId, selectedLayerIds, updateLayer, deleteLayer, deleteLayers, clearSelection, draftsByPageId, handleZoomGesture, resetZoom, zoomToFit, autofit]);

  // Add zoom gesture handlers for preview mode (when iframe doesn't have them)
  useEffect(() => {
    if (!isPreviewMode) return; // Editor iframe handles its own zoom gestures

    const container = canvasContainerRef.current;
    const iframe = iframeRef.current;
    if (!container) return;

    // Get iframe's window and document for event listening
    let iframeWindow: Window | null = null;
    let iframeDocument: Document | null = null;

    // Wait for iframe to load before attaching listeners
    const setupIframeListeners = () => {
      try {
        iframeWindow = iframe?.contentWindow || null;
        iframeDocument = iframe?.contentDocument || null;

        if (!iframeWindow || !iframeDocument) return;

        // Attach listeners to iframe's document
        iframeDocument.addEventListener('wheel', handleWheel, { passive: false, capture: true });
        iframeDocument.addEventListener('touchstart', handleTouchStart, { passive: true });
        iframeDocument.addEventListener('touchmove', handleTouchMove, { passive: true });
        iframeDocument.addEventListener('touchend', handleTouchEnd, { passive: true });
      } catch (e) {
        // Cross-origin iframe - fall back to container listeners only
        console.warn('Cannot access iframe document for zoom gestures:', e);
      }
    };

    // Wheel event for Ctrl/Cmd + wheel zoom (includes trackpad pinch on Mac)
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();

        // Positive deltaY means zoom out, negative means zoom in
        const delta = -e.deltaY;
        handleZoomGesture(delta);

        return false;
      }
    };

    // Touch events for pinch zoom on mobile/tablet
    let lastTouchDistance: number | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && lastTouchDistance !== null) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);

        // Calculate delta and send zoom gesture
        const delta = (currentDistance - lastTouchDistance) * 2;
        handleZoomGesture(delta);

        lastTouchDistance = currentDistance;
      }
    };

    const handleTouchEnd = () => {
      lastTouchDistance = null;
    };

    // Add event listeners to container (fallback for when cursor is outside iframe)
    container.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    // Setup iframe listeners when iframe loads
    if (iframe) {
      iframe.addEventListener('load', setupIframeListeners);
      // Try to set up immediately in case iframe is already loaded
      if (iframe.contentDocument?.readyState === 'complete') {
        setupIframeListeners();
      }
    }

    return () => {
      // Remove container listeners
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);

      // Remove iframe listeners if they were added
      if (iframeDocument) {
        try {
          iframeDocument.removeEventListener('wheel', handleWheel);
          iframeDocument.removeEventListener('touchstart', handleTouchStart);
          iframeDocument.removeEventListener('touchmove', handleTouchMove);
          iframeDocument.removeEventListener('touchend', handleTouchEnd);
        } catch (e) {
          // Ignore errors when removing listeners
        }
      }

      if (iframe) {
        iframe.removeEventListener('load', setupIframeListeners);
      }
    };
  }, [isPreviewMode, handleZoomGesture, iframeReady]);

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
                {Math.round(zoom)}%
                <div>
                  <Icon name="chevronCombo" className="!size-2.5 opacity-50" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="bottom"
              sideOffset={4}
              avoidCollisions={false}
              collisionPadding={0}
              className="!max-h-[300px] w-38"
            >
              <DropdownMenuItem onClick={zoomIn}>
                Zoom in
                <DropdownMenuShortcut>⌘+</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={zoomOut}>
                Zoom out
                <DropdownMenuShortcut>⌘-</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={resetZoom}>
                Zoom to 100%
                <DropdownMenuShortcut>⌘0</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={zoomToFit}>
                Fit height
                <DropdownMenuShortcut>⌘1</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={autofit}>
                Fit width
                <DropdownMenuShortcut>⌘2</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Undo/Redo Buttons (hidden in preview mode) */}
        {!isPreviewMode && (
          <div className="flex justify-end gap-0">
            <Button size="sm" variant="ghost">
              <Icon name="undo" />
            </Button>
            <Button size="sm" variant="ghost">
              <Icon name="redo" />
            </Button>
          </div>
        )}
      </div>

      {/* Canvas Area */}
      <div
        ref={canvasContainerRef}
        className="flex-1 relative overflow-hidden bg-neutral-50 dark:bg-neutral-950/80"
      >
        {/* Scrollable container with hidden scrollbars */}
        <div
          ref={scrollContainerRef}
          className={cn(
            'absolute inset-0',
            isPreviewMode ? 'overflow-hidden' : 'overflow-auto'
          )}
          style={{
            // Hide scrollbars but keep scrolling functionality (editor mode only)
            scrollbarWidth: isPreviewMode ? undefined : 'none', // Firefox
            msOverflowStyle: isPreviewMode ? undefined : 'none', // IE/Edge
            WebkitOverflowScrolling: isPreviewMode ? undefined : 'touch', // Smooth scrolling on iOS
          }}
        >
          {/* Hide scrollbars for Webkit browsers (editor mode only) */}
          {!isPreviewMode && (
            <style jsx>{`
              div::-webkit-scrollbar {
                display: none;
              }
            `}</style>
          )}

          {/* Preview mode: Scaled iframe with internal scrolling */}
          {isPreviewMode ? (
            <div
              className="w-full h-full flex items-start justify-center"
              style={{
                padding: `${CANVAS_BORDER}px`,
              }}
            >
              <div
                className="bg-white shadow-3xl relative"
                style={{
                  width: viewportSizes[viewportMode].width,
                  // Compensate height for zoom so visual size = 100% after scaling
                  height: `${((containerHeight - CANVAS_PADDING) / (zoom / 100))}px`,
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'top center',
                  willChange: 'transform',
                  backfaceVisibility: 'hidden',
                  transition: 'none',
                }}
              >
                {layers.length > 0 ? (
                  <iframe
                    key={`preview-${currentPageId}`}
                    ref={iframeRef}
                    src={previewUrl}
                    className="w-full h-full border-0"
                    title="Preview"
                    tabIndex={-1}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-12">
                    <div className="text-center max-w-md">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 rounded-2xl mx-auto mb-6 flex items-center justify-center">
                        <Icon name="layout" className="w-10 h-10 text-blue-500" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-3">
                        No content
                      </h2>
                      <p className="text-gray-600">
                        This page has no content to preview.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Editor mode: Scaled canvas with zoom controls */
            <div
              style={{
                position: 'relative',
                minWidth: '100%',
                minHeight: '100%',
              }}
            >
              <div
                style={{
                  // Width: exact scaled size, min 100% to fill viewport horizontally
                  width: `${viewportWidth * (zoom / 100) + CANVAS_PADDING}px`,
                  minWidth: '100%',
                  // Height: exact viewport height when centered, scaled size when top-aligned
                  height: shouldCenter
                    ? `${containerHeight}px`  // Use actual viewport height
                    : `${finalIframeHeight * (zoom / 100) + CANVAS_PADDING}px`,
                  display: 'flex',
                  // Always use flex-start - we'll handle centering via padding
                  alignItems: 'flex-start',
                  justifyContent: 'center', // Center horizontally
                  // Calculate padding: center based on VISUAL (scaled) height, or fixed border when top-aligned
                  paddingTop: shouldCenter
                    ? `${Math.max(0, (containerHeight - finalIframeHeight * (zoom / 100)) / 2)}px`
                    : `${CANVAS_BORDER}px`,
                  position: 'relative',
                }}
              >
                <div
                  className="bg-white shadow-3xl relative"
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'top center', // Always scale from top
                    width: viewportSizes[viewportMode].width,
                    height: `${finalIframeHeight}px`,
                    flexShrink: 0, // Prevent shrinking - maintain fixed size
                    // GPU optimization hints
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                    // No transition to prevent shifts
                    transition: 'none',
                  }}
                >
                  {/* Iframe Canvas - either editor or preview */}
                  {layers.length > 0 ? (
                    <>
                      <iframe
                        key={`editor-${currentPageId}`}
                        ref={iframeRef}
                        src="/canvas.html"
                        className="w-full h-full border-0"
                        style={{
                          height: `${finalIframeHeight}px`,
                        }}
                        title="Canvas Preview"
                        tabIndex={-1}
                      />
                      {/* Empty overlay when only Body with no children */}
                      {isCanvasEmpty && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                          <div className="pointer-events-auto">
                            <Empty className="bg-transparent border-0 text-neutral-900">
                              <EmptyContent>
                                <EmptyMedia variant="icon" className="size-9 mb-0 bg-neutral-900/5">
                                  <Icon name="layout" className="size-3.5 text-neutral-900" />
                                </EmptyMedia>
                                <EmptyHeader>
                                  <EmptyTitle className="text-sm">Start building</EmptyTitle>
                                  <EmptyDescription>
                                    Add your first block to begin creating your page.
                                  </EmptyDescription>
                                </EmptyHeader>
                                <Button
                                  onClick={() => {
                                    // Open ElementLibrary with layouts tab active
                                    window.dispatchEvent(new CustomEvent('toggleElementLibrary', {
                                      detail: { tab: 'layouts' }
                                    }));
                                  }}
                                  size="sm"
                                  variant="secondary"
                                  className="bg-neutral-900/5 hover:bg-neutral-900/10 text-neutral-900"
                                >
                                  <Icon name="plus" />
                                  Add layout
                                </Button>
                              </EmptyContent>
                            </Empty>
                          </div>
                        </div>
                      )}
                    </>
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
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default CenterCanvas;
