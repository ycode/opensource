'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { DndContext, DragOverlay, DragStartEvent, DragEndEvent, DragOverEvent, PointerSensor, useSensor, useSensors, closestCenter, useDraggable, useDroppable } from '@dnd-kit/core';
import { buildPageTree, flattenPageTree, rebuildPageTree, getNodeIcon, isHomepage, type PageTreeNode, type FlattenedPageNode } from '@/lib/page-utils';
import Icon from '@/components/ui/icon';
import PageContextMenu from './PageContextMenu';
import type { Page, PageFolder } from '@/types';
import { cn } from '@/lib/utils';

interface PagesTreeProps {
  pages: Page[];
  folders: PageFolder[];
  selectedItemId: string | null;
  currentPageId?: string | null;
  onPageSelect: (pageId: string) => void;
  onFolderSelect?: (folderId: string) => void;
  onPageOpen?: (pageId: string) => void;
  onReorder?: (pages: Page[], folders: PageFolder[]) => void;
  onPageSettings?: (page: Page) => void;
  onFolderSettings?: (folder: PageFolder) => void;
  onDelete?: (id: string, type: 'folder' | 'page') => void;
  onDuplicate?: (id: string, type: 'folder' | 'page') => void;
  onRename?: (id: string, type: 'folder' | 'page') => void;
}

interface PageRowProps {
  node: FlattenedPageNode;
  isSelected: boolean;
  isChildOfSelected: boolean;
  isOver: boolean;
  isDragging: boolean;
  isDragActive: boolean;
  dropPosition: 'above' | 'below' | 'inside' | null;
  highlightedDepths: Set<number>; // Depths that should be highlighted
  onSelect: (id: string, type: 'folder' | 'page') => void;
  onOpen?: (id: string) => void;
  onToggle: (id: string) => void;
  onSettings?: (item: Page | PageFolder) => void;
  onDelete?: (id: string, type: 'folder' | 'page') => void;
  onDuplicate?: (id: string, type: 'folder' | 'page') => void;
  onRename?: (id: string, type: 'folder' | 'page') => void;
}

// Helper function to get display name
function getNodeDisplayName(node: FlattenedPageNode): string {
  if (node.type === 'folder') {
    const folder = node.data as PageFolder;
    return folder.name;
  } else {
    const page = node.data as Page;
    return page.name || 'Untitled';
  }
}

// Helper to check if a node is a descendant of another
function checkIsDescendant(
  node: FlattenedPageNode,
  target: FlattenedPageNode,
  allNodes: FlattenedPageNode[]
): boolean {
  if (node.id === target.id) return true;

  const parent = allNodes.find((n) => n.id === target.parentId);
  if (!parent) return false;

  return checkIsDescendant(node, parent, allNodes);
}

// PageRow Component - Individual draggable/droppable tree node
function PageRow({
  node,
  isSelected,
  isChildOfSelected,
  isOver,
  isDragging,
  isDragActive,
  dropPosition,
  highlightedDepths,
  onSelect,
  onOpen,
  onToggle,
  onSettings,
  onDelete,
  onDuplicate,
  onRename,
}: PageRowProps) {
  // Check if this is an error page or the virtual error pages folder
  const isErrorPage = node.type === 'page' && (node.data as Page).error_page !== null;
  const isVirtualErrorFolder = node.id === 'virtual-error-pages-folder';
  const isDragDropDisabled = isErrorPage || isVirtualErrorFolder;

  // Error pages and virtual error folder cannot be dropped on
  const { setNodeRef: setDropRef } = useDroppable({
    id: node.id,
    disabled: isDragDropDisabled,
  });

  // Error pages and virtual error folder cannot be dragged
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id: node.id,
    disabled: isDragDropDisabled,
  });

  // Combine refs for drag and drop
  const setRefs = (element: HTMLDivElement | null) => {
    setDragRef(element);
    setDropRef(element);
  };

  const hasChildren = node.type === 'folder';
  const isCollapsed = node.collapsed || false;

  return (
    <PageContextMenu
      item={node.data}
      nodeType={node.type}
      onOpen={node.type === 'page' && onOpen ? () => onOpen(node.id) : undefined}
      onSettings={onSettings ? () => onSettings(node.data) : undefined}
      onDelete={onDelete ? () => onDelete(node.id, node.type) : undefined}
      onDuplicate={onDuplicate ? () => onDuplicate(node.id, node.type) : undefined}
      onRename={onRename ? () => onRename(node.id, node.type) : undefined}
    >
      <div className="relative">
      {/* Vertical connector lines - one for each depth level */}
      {node.depth > 0 && (
        <>
          {Array.from({ length: node.depth }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'absolute z-10 top-0 bottom-0 w-px',
                // Highlight depth guides if this node is selected OR is a child of the selected folder
                (isSelected || isChildOfSelected) && highlightedDepths.has(i) ? 'bg-white/30' : 'bg-white/10'
              )}
              style={{
                left: `${i * 14 + 16}px`,
              }}
            />
          ))}
        </>
      )}

      {/* Drop Indicators */}
      {isOver && dropPosition === 'above' && (
        <div
          className="absolute top-0 left-0 right-0 h-[1.5px] bg-primary z-50"
          style={{
            marginLeft: `${node.depth * 14 + 8}px`,
          }}
        >
          <div className="absolute -bottom-[3px] -left-[5.5px] size-2 rounded-full border-[1.5px] bg-neutral-950 border-primary" />
        </div>
      )}
      {isOver && dropPosition === 'below' && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-primary z-50"
          style={{
            marginLeft: `${node.depth * 14 + 8}px`,
          }}
        >
          <div className="absolute -bottom-[3px] -left-[5.5px] size-2 rounded-full border-[1.5px] bg-neutral-950 border-primary" />
        </div>
      )}
      {isOver && dropPosition === 'inside' && (
        <div className="absolute inset-0 border-[1.5px] border-primary rounded-lg z-40 pointer-events-none" />
      )}

      {/* Main Row */}
      <div
        ref={setRefs}
        {...attributes}
        {...(!isDragDropDisabled && listeners)}
        data-drag-active={isDragActive}
        data-node-id={node.id}
        className={cn(
          'group relative flex items-center h-8 outline-none focus:outline-none rounded-lg cursor-pointer select-none',
          !isDragActive && !isDragging && 'hover:bg-secondary/50',
          isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
          !isSelected && 'text-secondary-foreground/80 dark:text-muted-foreground'
        )}
        style={{ paddingLeft: `${node.depth * 14 + 8}px` }}
        onClick={() => onSelect(node.id, node.type)}
        onDoubleClick={() => {
          if (node.type === 'page' && onOpen) {
            onOpen(node.id);
          }
        }}
        onContextMenu={() => onSelect(node.id, node.type)}
      >
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className={cn(
              'w-4 h-4 flex items-center justify-center flex-shrink-0 cursor-pointer',
              isCollapsed ? '' : 'rotate-90'
            )}
          >
            <Icon name="chevronRight" className={cn('size-2.5 opacity-50', isSelected && 'opacity-80')} />
          </div>
        ) : (
          <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
            <div className={cn('ml-0.25 w-1.5 h-px bg-white opacity-0', isSelected && 'opacity-0')} />
          </div>
        )}

        {/* Icon */}
        <Icon
          name={getNodeIcon(node)}
          className={`size-3 ml-1 mr-2 ${isSelected ? 'opacity-90' : 'opacity-50'}`}
        />

        {/* Label */}
        <span className="flex-grow text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none">
          {getNodeDisplayName(node)}
        </span>

        {/* Settings button (for pages only) */}
        {onSettings && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSettings(node.data as Page | PageFolder);
            }}
            className="opacity-0 group-hover:opacity-80 hover:opacity-100 transition-opacity mr-2.5 cursor-pointer"
          >
            <Icon name="dotsHorizontal" className="size-3" />
          </div>
        )}
      </div>
    </div>
    </PageContextMenu>
  );
}

// EndDropZone Component - Drop target for adding items at the end of the list
function EndDropZone({
  isDragActive,
  isOver,
}: {
  isDragActive: boolean;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: 'end-drop-zone',
  });

  if (!isDragActive) return null;

  return (
    <div
      ref={setNodeRef}
      className="relative h-8 flex items-center"
    >
      {isOver && (
        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-primary z-50 ml-2">
          <div className="absolute -bottom-[3px] -left-[5.5px] size-2 rounded-full border-[1.5px] bg-neutral-950 border-primary" />
        </div>
      )}
    </div>
  );
}

// Main PagesTree Component
export default function PagesTree({
  pages,
  folders,
  selectedItemId,
  onPageSelect,
  onFolderSelect,
  onPageOpen,
  onReorder,
  onPageSettings,
  onFolderSettings,
  onDelete,
  onDuplicate,
  onRename,
}: PagesTreeProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | 'inside' | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [cursorOffsetY, setCursorOffsetY] = useState<number>(0);
  const [isDropNotAllowed, setIsDropNotAllowed] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Build tree structure
  const tree = useMemo(
    () => buildPageTree(pages, folders),
    [pages, folders]
  );

  // Flatten the tree for rendering
  const flattenedNodes = useMemo(
    () => flattenPageTree(tree, null, 0, collapsedIds),
    [tree, collapsedIds]
  );

  // Calculate which depth levels should be highlighted (selected folders)
  const highlightedDepths = useMemo(() => {
    const depths = new Set<number>();

    if (selectedItemId) {
      const selectedNode = flattenedNodes.find(n => n.id === selectedItemId);
      if (selectedNode && selectedNode.type === 'folder') {
        depths.add(selectedNode.depth);
      }
    }

    return depths;
  }, [flattenedNodes, selectedItemId]);

  // Helper to check if a node is a child/descendant of the selected folder
  const isChildOfSelected = useCallback((node: FlattenedPageNode): boolean => {
    if (!selectedItemId) return false;

    const selectedNode = flattenedNodes.find(n => n.id === selectedItemId);
    if (!selectedNode || selectedNode.type !== 'folder') return false;

    // Check if this node's parentId chain leads to the selected folder
    let currentParentId = node.parentId;
    while (currentParentId) {
      if (currentParentId === selectedItemId) return true;
      const parentNode = flattenedNodes.find(n => n.id === currentParentId);
      if (!parentNode) break;
      currentParentId = parentNode.parentId;
    }

    return false;
  }, [flattenedNodes, selectedItemId]);

  // Get the currently active node being dragged
  const activeNode = useMemo(
    () => flattenedNodes.find((node) => node.id === activeId),
    [activeId, flattenedNodes]
  );

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required to start drag
      },
    })
  );

  // Handle drag start
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (isProcessing) return;

      const draggedId = event.active.id as string;

      // Calculate where user clicked within the element
      const activeRect = event.active.rect.current.initial;
      if (activeRect && event.activatorEvent) {
        const clickY = (event.activatorEvent as PointerEvent).clientY;
        const elementTop = activeRect.top;
        const offsetWithinElement = clickY - elementTop;
        setCursorOffsetY(offsetWithinElement);
      } else if (activeRect) {
        setCursorOffsetY(activeRect.height / 2);
      }

      // Automatically select the dragged item
      const draggedNode = flattenedNodes.find((n) => n.id === draggedId);
      if (draggedNode) {
        if (draggedNode.type === 'page') {
          onPageSelect(draggedId);
        } else if (onFolderSelect) {
          onFolderSelect(draggedId);
        }
      }

      setActiveId(draggedId);
      setIsDropNotAllowed(false);
    },
    [isProcessing, flattenedNodes, onPageSelect, onFolderSelect]
  );

  // Handle drag over
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const overId = event.over?.id as string | null;

      if (!overId || !event.over?.rect) {
        setIsDropNotAllowed(false);
        setOverId(null);
        setDropPosition(null);
        return;
      }

      const overNode = flattenedNodes.find((n) => n.id === overId);
      const activeNode = activeId ? flattenedNodes.find((n) => n.id === activeId) : null;

      // Handle drop at the end of the list
      if (overId === 'end-drop-zone') {
        // Check if dragging a dynamic page to root that already has one
        if (activeNode && activeNode.type === 'page') {
          const activePage = activeNode.data as Page;
          if (activePage.is_dynamic) {
            const rootHasDynamicPage = pages.some(
              (p) =>
                p.id !== activePage.id &&
                p.is_dynamic &&
                p.page_folder_id === null &&
                p.is_published === activePage.is_published
            );

            if (rootHasDynamicPage) {
              setIsDropNotAllowed(true);
              setOverId(null);
              setDropPosition(null);
              return;
            }
          }
        }
        setIsDropNotAllowed(false);
        setOverId(overId);
        setDropPosition('below'); // Will be treated as "after last item"
        return;
      }

      if (!overNode) {
        setDropPosition(null);
        return;
      }

      // Calculate pointer position relative to the hovered element
      const activeRect = event.active.rect.current;
      if (!activeRect.initial) {
        setOverId(overId);
        setDropPosition(null);
        return;
      }

      const pointerY = activeRect.translated?.top ?? activeRect.initial.top;
      const { top, height } = event.over.rect;

      const actualPointerY = pointerY + cursorOffsetY;
      const offsetY = actualPointerY - top;
      const relativeY = offsetY / height;

      // Determine drop position
      let position: 'above' | 'below' | 'inside';

      if (overNode.type === 'folder') {
        // Folders can accept children
        if (relativeY < 0.25) {
          position = 'above';
        } else if (relativeY > 0.75) {
          position = 'below';
        } else {
          position = 'inside';
        }
      } else {
        // Pages cannot have children
        position = relativeY < 0.5 ? 'above' : 'below';
      }

      // Prevent showing drop indicator if moving into self or descendant
      if (activeNode && checkIsDescendant(activeNode, overNode, flattenedNodes)) {
        setOverId(null);
        setDropPosition(null);
        return;
      }

      // Determine the target parent folder for this drop position
      let targetParentId: string | null;
      if (position === 'inside' && overNode.type === 'folder') {
        targetParentId = overNode.id;
      } else {
        targetParentId = overNode.parentId;
      }

      // Prevent showing drop indicator if moving an index page to a folder that already has one
      if (activeNode && activeNode.type === 'page') {
        const activePage = activeNode.data as Page;

        // Prevent dragging homepage out of root folder
        if (isHomepage(activePage)) {
          if (targetParentId !== null) {
            setIsDropNotAllowed(true);
            setOverId(null);
            setDropPosition(null);
            return;
          }
        }

        if (activePage.is_index) {
          const targetFolderHasIndex = pages.some(
            (p) =>
              p.id !== activePage.id &&
              p.is_index &&
              p.page_folder_id === targetParentId
          );

          if (targetFolderHasIndex) {
            // Don't show drop indicator for invalid drop
            setIsDropNotAllowed(true);
            setOverId(null);
            setDropPosition(null);
            return;
          }
        }

        // Prevent showing drop indicator if moving a page would create a slug conflict
        // Pages must have unique (slug, is_published, page_folder_id)
        const slugConflict = pages.some(
          (p) =>
            p.id !== activePage.id &&
            p.slug === activePage.slug &&
            p.is_published === activePage.is_published &&
            p.page_folder_id === targetParentId
        );

        if (slugConflict) {
          setIsDropNotAllowed(true);
          setOverId(null);
          setDropPosition(null);
          return;
        }

        // Check if moving a dynamic page into a folder that already contains a dynamic page
        if (activePage.is_dynamic) {
          const targetFolderHasDynamicPage = pages.some(
            (p) =>
              p.id !== activePage.id &&
              p.is_dynamic &&
              p.page_folder_id === targetParentId &&
              p.is_published === activePage.is_published
          );

          if (targetFolderHasDynamicPage) {
            setIsDropNotAllowed(true);
            setOverId(null);
            setDropPosition(null);
            return;
          }
        }
      }

      // Prevent showing drop indicator if moving a folder would create a slug conflict
      // Folders must have unique (slug, page_folder_id)
      if (activeNode && activeNode.type === 'folder') {
        const activeFolder = activeNode.data as PageFolder;
        const slugConflict = folders.some(
          (f) =>
            f.id !== activeFolder.id &&
            f.slug === activeFolder.slug &&
            f.page_folder_id === targetParentId
        );

        if (slugConflict) {
          setIsDropNotAllowed(true);
          setOverId(null);
          setDropPosition(null);
          return;
        }
      }

      // Reset drop not allowed if we get here (valid drop)
      setIsDropNotAllowed(false);
      setOverId(overId);
      setDropPosition(position);
    },
    [flattenedNodes, activeId, cursorOffsetY, pages, folders]
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        setActiveId(null);
        setOverId(null);
        setDropPosition(null);
        setCursorOffsetY(0);
        return;
      }

      setIsProcessing(true);

      const activeNode = flattenedNodes.find((n) => n.id === active.id);

      // Handle drop at the end of the list
      if (over.id === 'end-drop-zone') {
        if (!activeNode) {
          setActiveId(null);
          setOverId(null);
          setDropPosition(null);
          setCursorOffsetY(0);
          setIsProcessing(false);
          return;
        }

        // Find the last root-level item and place the dragged item after it
        const rootItems = flattenedNodes.filter(n => n.depth === 0);
        const lastRootItem = rootItems[rootItems.length - 1];

        if (!lastRootItem) {
          setActiveId(null);
          setOverId(null);
          setDropPosition(null);
          setCursorOffsetY(0);
          setIsProcessing(false);
          return;
        }

        // Place at root level (parentId = null), after the last root item
        const newParentId = null;
        const newOrder = lastRootItem.index + 1;

        // Validate dynamic page constraint for end-drop-zone
        if (activeNode.type === 'page') {
          const activePage = activeNode.data as Page;
          if (activePage.is_dynamic) {
            const targetFolderHasDynamicPage = pages.some(
              (p) =>
                p.id !== activePage.id &&
                p.is_dynamic &&
                p.page_folder_id === newParentId &&
                p.is_published === activePage.is_published
            );

            if (targetFolderHasDynamicPage) {
              console.warn('Cannot move dynamic page: target folder already contains a dynamic page');
              setActiveId(null);
              setOverId(null);
              setDropPosition(null);
              setCursorOffsetY(0);
              setIsProcessing(false);
              return;
            }
          }
        }

        // Rebuild tree with the item moved to the end
        const newTree = rebuildPageTree(
          flattenedNodes,
          activeNode.id,
          newParentId,
          newOrder
        );

        // Extract updated pages and folders from the new tree
        const extractPagesAndFolders = (
          nodes: PageTreeNode[],
          parentId: string | null = null,
          currentOrder: number = 0,
          currentDepth: number = 0
        ): { pages: Page[]; folders: PageFolder[] } => {
          const updatedPages: Page[] = [];
          const updatedFolders: PageFolder[] = [];

          nodes.forEach((node, index) => {
            const orderValue = currentOrder + index;

            if (node.type === 'folder') {
              const folder = node.data as PageFolder;
              updatedFolders.push({
                ...folder,
                page_folder_id: parentId,
                order: orderValue,
                depth: currentDepth,
              });

              if (node.children) {
                const childResult = extractPagesAndFolders(
                  node.children,
                  folder.id,
                  0,
                  currentDepth + 1
                );
                updatedPages.push(...childResult.pages);
                updatedFolders.push(...childResult.folders);
              }
            } else {
              const page = node.data as Page;
              updatedPages.push({
                ...page,
                page_folder_id: parentId,
                order: orderValue,
                depth: currentDepth,
              });
            }
          });

          return { pages: updatedPages, folders: updatedFolders };
        };

        const { pages: updatedPages, folders: updatedFolders } = extractPagesAndFolders(newTree);

        if (onReorder) {
          onReorder(updatedPages, updatedFolders);
        }

        setActiveId(null);
        setOverId(null);
        setDropPosition(null);
        setCursorOffsetY(0);
        setIsProcessing(false);
        return;
      }

      const overNode = flattenedNodes.find((n) => n.id === over.id);

      if (!activeNode || !overNode) {
        setActiveId(null);
        setOverId(null);
        setDropPosition(null);
        setCursorOffsetY(0);
        setIsProcessing(false);
        return;
      }

      // Prevent moving into self or descendant
      if (checkIsDescendant(activeNode, overNode, flattenedNodes)) {
        setActiveId(null);
        setOverId(null);
        setDropPosition(null);
        setCursorOffsetY(0);
        setIsProcessing(false);
        return;
      }

      // Determine the target parent folder
      let targetParentId: string | null;
      if (dropPosition === 'inside' && overNode.type === 'folder') {
        targetParentId = overNode.id;
      } else {
        targetParentId = overNode.parentId;
      }

      // Prevent moving an index page to a folder that already has an index page
      if (activeNode.type === 'page') {
        const activePage = activeNode.data as Page;

        // Prevent moving homepage out of root folder
        if (isHomepage(activePage)) {
          if (targetParentId !== null) {
            console.warn('Cannot move homepage: homepage must remain in the root folder');
            setActiveId(null);
            setOverId(null);
            setDropPosition(null);
            setCursorOffsetY(0);
            setIsDropNotAllowed(false);
            setIsProcessing(false);
            return;
          }
        }

        if (activePage.is_index) {
          // Check if target folder already has an index page (excluding the one being moved)
          const targetFolderHasIndex = pages.some(
            (p) =>
              p.id !== activePage.id &&
              p.is_index &&
              p.page_folder_id === targetParentId
          );

          if (targetFolderHasIndex) {
            console.warn('Cannot move index page: target folder already has an index page');
            setActiveId(null);
            setOverId(null);
            setDropPosition(null);
            setCursorOffsetY(0);
            setIsProcessing(false);
            return;
          }
        }

        // Prevent moving a page if it would create a slug conflict
        // Pages must have unique (slug, is_published, page_folder_id)
        const slugConflict = pages.some(
          (p) =>
            p.id !== activePage.id &&
            p.slug === activePage.slug &&
            p.is_published === activePage.is_published &&
            p.page_folder_id === targetParentId
        );

        if (slugConflict) {
          console.warn('Cannot move page: slug conflict in target folder');
          setActiveId(null);
          setOverId(null);
          setDropPosition(null);
          setCursorOffsetY(0);
          setIsProcessing(false);
          return;
        }

        // Prevent moving a dynamic page into a folder that already contains a dynamic page
        if (activePage.is_dynamic) {
          const targetFolderHasDynamicPage = pages.some(
            (p) =>
              p.id !== activePage.id &&
              p.is_dynamic &&
              p.page_folder_id === targetParentId &&
              p.is_published === activePage.is_published
          );

          if (targetFolderHasDynamicPage) {
            console.warn('Cannot move dynamic page: target folder already contains a dynamic page');
            setActiveId(null);
            setOverId(null);
            setDropPosition(null);
            setCursorOffsetY(0);
            setIsProcessing(false);
            return;
          }
        }
      }

      // Prevent moving a folder if it would create a slug conflict
      // Folders must have unique (slug, page_folder_id)
      if (activeNode.type === 'folder') {
        const activeFolder = activeNode.data as PageFolder;
        const slugConflict = folders.some(
          (f) =>
            f.id !== activeFolder.id &&
            f.slug === activeFolder.slug &&
            f.page_folder_id === targetParentId
        );

        if (slugConflict) {
          console.warn('Cannot move folder: slug conflict in target folder');
          setActiveId(null);
          setOverId(null);
          setDropPosition(null);
          setCursorOffsetY(0);
          setIsProcessing(false);
          return;
        }
      }

      // Handle drop based on dropPosition
      let newParentId: string | null;
      let newOrder: number;

      if (dropPosition === 'above') {
        newParentId = overNode.parentId;
        newOrder = overNode.index;
      } else if (dropPosition === 'inside') {
        // Can only drop inside folders
        if (overNode.type !== 'folder') {
          setActiveId(null);
          setOverId(null);
          setDropPosition(null);
          setCursorOffsetY(0);
          setIsProcessing(false);
          return;
        }

        newParentId = overNode.id;
        const childrenOfOver = flattenedNodes.filter((n) => n.parentId === overNode.id);
        newOrder = childrenOfOver.length > 0 ? Math.max(...childrenOfOver.map((n) => n.index)) + 1 : 0;
      } else {
        // Drop below
        newParentId = overNode.parentId;
        newOrder = overNode.index + 1;
      }

      // Rebuild the tree structure
      const newTree = rebuildPageTree(flattenedNodes, activeNode.id, newParentId, newOrder);

      // Extract updated pages and folders from the new tree
      const extractPagesAndFolders = (
        nodes: PageTreeNode[],
        parentId: string | null = null,
        currentOrder: number = 0,
        currentDepth: number = 0
      ): { pages: Page[]; folders: PageFolder[] } => {
        const updatedPages: Page[] = [];
        const updatedFolders: PageFolder[] = [];

        // Pages and folders at the same depth share continuous order
        nodes.forEach((node, index) => {
          const orderValue = currentOrder + index;

          if (node.type === 'folder') {
            const folder = node.data as PageFolder;
            updatedFolders.push({
              ...folder,
              page_folder_id: parentId,
              order: orderValue,
              depth: currentDepth,
            });

            if (node.children) {
              // Children start with order 0 within their parent and depth increases by 1
              const childResults = extractPagesAndFolders(node.children, node.id, 0, currentDepth + 1);
              updatedPages.push(...childResults.pages);
              updatedFolders.push(...childResults.folders);
            }
          } else {
            const page = node.data as Page;
            updatedPages.push({
              ...page,
              page_folder_id: parentId,
              order: orderValue,
              depth: currentDepth,
            });
          }
        });

        return { pages: updatedPages, folders: updatedFolders };
      };

      const { pages: updatedPages, folders: updatedFolders } = extractPagesAndFolders(newTree);

      if (onReorder) {
        onReorder(updatedPages, updatedFolders);
      }

      setActiveId(null);
      setOverId(null);
      setDropPosition(null);
      setCursorOffsetY(0);
      setIsDropNotAllowed(false);

      setTimeout(() => setIsProcessing(false), 0);
    },
    [flattenedNodes, dropPosition, onReorder, pages, folders]
  );

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    setDropPosition(null);
    setCursorOffsetY(0);
    setIsDropNotAllowed(false);
  }, []);

  // Handle expand/collapse toggle
  const handleToggle = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Handle folder/page selection
  const handleSelect = useCallback(
    (id: string, type: 'folder' | 'page') => {
      if (type === 'page') {
        onPageSelect(id);
      } else if (onFolderSelect) {
        onFolderSelect(id);
      }
    },
    [onPageSelect, onFolderSelect]
  );

  // Update cursor style based on drop not allowed state
  React.useEffect(() => {
    if (isDropNotAllowed && activeId) {
      document.body.style.cursor = 'not-allowed';
    } else if (activeId) {
      document.body.style.cursor = 'grabbing';
    } else {
      document.body.style.cursor = '';
    }

    return () => {
      if (!activeId) {
        document.body.style.cursor = '';
      }
    };
  }, [isDropNotAllowed, activeId]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="space-y-0">
        {flattenedNodes.map((node) => (
          <PageRow
            key={node.id}
            node={node}
            isSelected={node.id === selectedItemId}
            isChildOfSelected={isChildOfSelected(node)}
            isOver={overId === node.id}
            isDragging={activeId === node.id}
            isDragActive={!!activeId}
            dropPosition={overId === node.id ? dropPosition : null}
            highlightedDepths={highlightedDepths}
            onSelect={handleSelect}
            onOpen={onPageOpen}
            onToggle={handleToggle}
            onSettings={
              node.type === 'page'
                ? (onPageSettings ? () => onPageSettings(node.data as Page) : undefined)
                : (onFolderSettings ? () => onFolderSettings(node.data as PageFolder) : undefined)
            }
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onRename={onRename}
          />
        ))}

        {/* Drop zone at the end of the list for dropping items after the last item */}
        <EndDropZone
          isDragActive={!!activeId}
          isOver={overId === 'end-drop-zone'}
        />
      </div>

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={null}>
        {activeNode ? (
          <div
            className="flex items-center text-white text-xs h-8 rounded-lg"
            style={{ transform: 'translateX(40px)' }}
          >
            <Icon
              name={getNodeIcon(activeNode)}
              className="size-3 mr-2"
            />
            <span className="pointer-events-none">{getNodeDisplayName(activeNode)}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
