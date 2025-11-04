'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { DndContext, DragOverlay, DragStartEvent, DragEndEvent, DragOverEvent, PointerSensor, useSensor, useSensors, closestCenter, useDraggable, useDroppable } from '@dnd-kit/core';
import { buildPageTree, flattenPageTree, rebuildPageTree, type PageTreeNode, type FlattenedPageNode } from '@/lib/pages';
import Icon from '@/components/ui/icon';
import PageContextMenu from './PageContextMenu';
import type { Page, PageFolder } from '@/types';
import { cn } from '@/lib/utils';

interface PagesTreeProps {
  pages: Page[];
  folders: PageFolder[];
  selectedPageId: string | null;
  onPageSelect: (pageId: string) => void;
  onFolderSelect?: (folderId: string) => void;
  onReorder?: (pages: Page[], folders: PageFolder[]) => void;
  onPageSettings?: (page: Page) => void;
  onDelete?: (id: string, type: 'folder' | 'page') => void;
  onDuplicate?: (id: string, type: 'folder' | 'page') => void;
  onRename?: (id: string, type: 'folder' | 'page') => void;
}

interface PageRowProps {
  node: FlattenedPageNode;
  isSelected: boolean;
  isOver: boolean;
  isDragging: boolean;
  isDragActive: boolean;
  dropPosition: 'above' | 'below' | 'inside' | null;
  onSelect: (id: string, type: 'folder' | 'page') => void;
  onToggle: (id: string) => void;
  onSettings?: (page: Page) => void;
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
  isOver,
  isDragging,
  isDragActive,
  dropPosition,
  onSelect,
  onToggle,
  onSettings,
  onDelete,
  onDuplicate,
  onRename,
}: PageRowProps) {
  const { setNodeRef: setDropRef } = useDroppable({
    id: node.id,
  });

  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id: node.id,
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
      onSettings={node.type === 'page' && onSettings ? () => onSettings(node.data as Page) : undefined}
      onDelete={onDelete ? () => onDelete(node.id, node.type) : undefined}
      onDuplicate={onDuplicate ? () => onDuplicate(node.id, node.type) : undefined}
      onRename={onRename ? () => onRename(node.id, node.type) : undefined}
    >
      <div className="relative">
      {/* Vertical connector line */}
      {node.depth > 0 && (
        <div
          className={cn(
            'absolute z-10 top-0 bottom-0 w-px bg-secondary',
            isSelected && 'bg-white/10'
          )}
          style={{
            left: `${node.depth * 18 - 2}px`,
          }}
        />
      )}

      {/* Drop Indicators */}
      {isOver && dropPosition === 'above' && (
        <div
          className="absolute top-0 left-0 right-0 h-[1.5px] bg-primary z-50"
          style={{
            marginLeft: `${node.depth * 18}px`,
          }}
        >
          <div className="absolute -bottom-[3px] -left-[5.5px] size-2 rounded-full border-[1.5px] bg-neutral-950 border-primary" />
        </div>
      )}
      {isOver && dropPosition === 'below' && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-primary z-50"
          style={{
            marginLeft: `${node.depth * 18}px`,
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
        {...listeners}
        data-drag-active={isDragActive}
        data-node-id={node.id}
        className={cn(
          'group relative flex items-center h-8 outline-none focus:outline-none rounded-lg',
          !isDragActive && !isDragging && 'hover:bg-secondary/50',
          isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
          !isSelected && 'text-secondary-foreground/80 dark:text-primary-foreground/80'
        )}
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        onClick={() => onSelect(node.id, node.type)}
      >
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className={cn(
              'w-4 h-4 flex items-center justify-center flex-shrink-0',
              isCollapsed ? '' : 'rotate-90'
            )}
          >
            <Icon name="chevronRight" className="size-2.5 opacity-50" />
          </button>
        ) : (
          <div className="w-4 h-4 flex-shrink-0" />
        )}

        {/* Icon */}
        <div
          className={cn(
            'size-3 bg-secondary rounded mx-1.5',
            isSelected && 'opacity-10 dark:bg-white'
          )}
        />

        {/* Label */}
        <span className="flex-grow text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none">
          {getNodeDisplayName(node)}
        </span>

        {/* Settings button (for pages only) */}
        {node.type === 'page' && onSettings && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSettings(node.data as Page);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity mr-2"
          >
            <Icon name="edit" className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
    </PageContextMenu>
  );
}

// Main PagesTree Component
export default function PagesTree({
  pages,
  folders,
  selectedPageId,
  onPageSelect,
  onFolderSelect,
  onReorder,
  onPageSettings,
  onDelete,
  onDuplicate,
  onRename,
}: PagesTreeProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'above' | 'below' | 'inside' | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [cursorOffsetY, setCursorOffsetY] = useState<number>(0);
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

      setActiveId(draggedId);
    },
    [isProcessing]
  );

  // Handle drag over
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const overId = event.over?.id as string | null;

      if (!overId || !event.over?.rect) {
        setOverId(null);
        setDropPosition(null);
        return;
      }

      const overNode = flattenedNodes.find((n) => n.id === overId);
      const activeNode = activeId ? flattenedNodes.find((n) => n.id === activeId) : null;

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

      setOverId(overId);
      setDropPosition(position);
    },
    [flattenedNodes, activeId, cursorOffsetY]
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
        currentOrder: number = 0
      ): { pages: Page[]; folders: PageFolder[] } => {
        const updatedPages: Page[] = [];
        const updatedFolders: PageFolder[] = [];

        nodes.forEach((node, index) => {
          if (node.type === 'folder') {
            const folder = node.data as PageFolder;
            updatedFolders.push({
              ...folder,
              page_folder_id: parentId,
              order: currentOrder + index,
            });

            if (node.children) {
              const childResults = extractPagesAndFolders(node.children, node.id, 0);
              updatedPages.push(...childResults.pages);
              updatedFolders.push(...childResults.folders);
            }
          } else {
            const page = node.data as Page;
            updatedPages.push({
              ...page,
              page_folder_id: parentId,
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

      setTimeout(() => setIsProcessing(false), 0);
    },
    [flattenedNodes, dropPosition, onReorder]
  );

  // Handle drag cancel
  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverId(null);
    setDropPosition(null);
    setCursorOffsetY(0);
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
            isSelected={node.type === 'page' && node.id === selectedPageId}
            isOver={overId === node.id}
            isDragging={activeId === node.id}
            isDragActive={!!activeId}
            dropPosition={overId === node.id ? dropPosition : null}
            onSelect={handleSelect}
            onToggle={handleToggle}
            onSettings={onPageSettings}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onRename={onRename}
          />
        ))}
      </div>

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={null}>
        {activeNode ? (
          <div
            className="flex items-center text-white text-xs h-8 rounded-lg"
            style={{ transform: 'translateX(40px)' }}
          >
            <div className="size-3 bg-white/10 rounded mx-1.5" />
            <span className="pointer-events-none">{getNodeDisplayName(activeNode)}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

