'use client';

/**
 * PageSelector - Reusable page selector with folder tree
 *
 * Renders a Popover dropdown showing pages organized in a folder tree.
 * Used in link settings, rich text link settings, collection link fields,
 * and the center canvas page navigation.
 */

// 1. React
import React, { useState, useMemo, useCallback, useEffect } from 'react';

// 3. ShadCN UI
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// 5. Stores
import { usePagesStore } from '@/stores/usePagesStore';

// 6. Utils
import { buildPageTree, getNodeIcon, getPageIcon } from '@/lib/page-utils';
import { cn } from '@/lib/utils';

// 7. Types
import type { Page, PageFolder } from '@/types';
import type { PageTreeNode } from '@/lib/page-utils';

interface PageSelectorProps {
  value: string | null;
  onValueChange: (pageId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Show error pages in a separate "Error pages" folder. Default: false */
  includeErrorPages?: boolean;
  /** Custom class for the trigger button */
  className?: string;
  /** Popover alignment relative to trigger. Default: "end" (right-aligned) */
  align?: 'start' | 'center' | 'end';
  /** Custom class for the popover content */
  popoverClassName?: string;
}

/**
 * Reusable page selector with folder tree dropdown
 */
export default function PageSelector({
  value,
  onValueChange,
  placeholder = 'Select page',
  disabled = false,
  includeErrorPages = false,
  className,
  align = 'end',
  popoverClassName,
}: PageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<string>>(new Set());

  const pages = usePagesStore((state) => state.pages);
  const folders = usePagesStore((state) => state.folders);

  // Separate regular pages from error pages
  const { regularPages, errorPages } = useMemo(() => {
    const regular = pages.filter(page => page.error_page === null);
    const errors = pages
      .filter(page => page.error_page !== null)
      .sort((a, b) => (a.error_page || 0) - (b.error_page || 0));
    return { regularPages: regular, errorPages: errors };
  }, [pages]);

  // Build folder tree from regular (non-error) pages
  const pageTree = useMemo(
    () => buildPageTree(regularPages, folders),
    [regularPages, folders]
  );

  // Virtual "Error pages" folder node
  const errorPagesNode: PageTreeNode | null = useMemo(() => {
    if (!includeErrorPages || errorPages.length === 0) return null;

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
  }, [includeErrorPages, errorPages]);

  // Collapse all folders by default
  useEffect(() => {
    const allFolderIds = new Set(folders.map(f => f.id));
    if (includeErrorPages) {
      allFolderIds.add('virtual-error-pages-folder');
    }
    setCollapsedFolderIds(allFolderIds);
  }, [folders, includeErrorPages]);

  /** Get all ancestor folder IDs for a given page */
  const getAncestorFolderIds = useCallback((pageId: string): string[] => {
    const page = pages.find(p => p.id === pageId);
    if (!page?.page_folder_id) return [];

    const ancestors: string[] = [];
    let currentFolderId: string | null = page.page_folder_id;

    while (currentFolderId) {
      ancestors.push(currentFolderId);
      const folder = folders.find(f => f.id === currentFolderId);
      currentFolderId = folder?.page_folder_id || null;
    }

    return ancestors;
  }, [pages, folders]);

  /** When the popover opens, expand ancestors of the selected page */
  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (open && value) {
      const ancestorIds = getAncestorFolderIds(value);
      if (ancestorIds.length > 0) {
        setCollapsedFolderIds(prev => {
          const next = new Set(prev);
          for (const id of ancestorIds) {
            next.delete(id);
          }
          return next;
        });
      }
    }
  }, [value, getAncestorFolderIds]);

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

  const handlePageSelect = useCallback((pageId: string) => {
    onValueChange(pageId);
    setIsOpen(false);
  }, [onValueChange]);

  // Resolve selected page for the trigger display
  const selectedPage = useMemo(() => {
    if (!value) return null;
    return pages.find(p => p.id === value) || null;
  }, [value, pages]);

  // Recursive tree node renderer
  const renderTreeNode = useCallback((node: PageTreeNode, depth: number = 0) => {
    const isFolder = node.type === 'folder';
    const isCollapsed = isFolder && collapsedFolderIds.has(node.id);
    const isSelected = !isFolder && node.id === value;
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
            "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground relative flex w-full cursor-pointer items-center gap-1.25 rounded-sm py-1.5 pr-8 pl-2 text-xs outline-hidden select-none data-disabled:opacity-50 data-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
            isSelected && 'bg-secondary/50'
          )}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          {/* Expand/Collapse */}
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isFolder) {
                  toggleFolder(node.id);
                }
              }}
              className={cn(
                'size-3 flex items-center justify-center shrink-0',
                isCollapsed ? '' : 'rotate-90'
              )}
            >
              <Icon
                name="chevronRight"
                className={cn('size-2.5 opacity-50', isSelected && 'opacity-80')}
              />
            </button>
          ) : (
            <div className="size-3 shrink-0 flex items-center justify-center">
              <div className={cn('ml-px w-1.5 h-px bg-white opacity-0', isSelected && 'opacity-0')} />
            </div>
          )}

          {/* Icon */}
          <Icon
            name={getNodeIcon(node)}
            className={cn('size-3 mr-0.5', isSelected ? 'opacity-90' : 'opacity-50')}
          />

          {/* Label */}
          <span className="grow text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none">
            {isFolder ? (node.data as PageFolder).name : (node.data as Page).name}
          </span>

          {/* Check indicator */}
          {isSelected && (
            <span className="absolute right-2 flex size-3 items-center justify-center">
              <Icon name="check" className="size-3 opacity-50" />
            </span>
          )}
        </div>

        {isFolder && !isCollapsed && node.children && (
          <div>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }, [collapsedFolderIds, value, toggleFolder, handlePageSelect]);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="input"
          size="sm"
          role="combobox"
          aria-expanded={isOpen}
          disabled={disabled}
          className={cn('w-full justify-between', className)}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {selectedPage ? (
              <>
                <Icon
                  name={getPageIcon(selectedPage)}
                  className="size-3 opacity-50 shrink-0"
                />
                <span className="truncate">{selectedPage.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground truncate">{placeholder}</span>
            )}
          </div>
          <div className="shrink-0">
            <Icon name="chevronCombo" className="size-2.5! shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className={cn('w-auto min-w-56 max-w-96 p-1', popoverClassName)} align={align}>
        <div className="max-h-100 overflow-y-auto">
          {/* Regular pages tree */}
          {pageTree.length > 0 && pageTree.map(node => renderTreeNode(node, 0))}

          {/* Error pages section */}
          {errorPagesNode && (
            <>
              <Separator className="my-1" />
              {renderTreeNode(errorPagesNode, 0)}
            </>
          )}

          {/* Empty state */}
          {pageTree.length === 0 && !errorPagesNode && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No pages found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
