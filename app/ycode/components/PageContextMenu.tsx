'use client';

import React from 'react';
import { ContextMenu,ContextMenuContent,ContextMenuItem,ContextMenuSeparator,ContextMenuTrigger } from '@/components/ui/context-menu';
import type { Page, PageFolder } from '@/types';
import { isHomepage } from '@/lib/page-utils';

interface PageContextMenuProps {
  item: Page | PageFolder;
  children: React.ReactNode;
  nodeType: 'page' | 'folder';
  onOpen?: () => void; // For pages
  onRename?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onSettings?: () => void;
  onAddPage?: () => void; // For folders
  onAddFolder?: () => void; // For folders
}

export default function PageContextMenu({
  item,
  children,
  nodeType,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onSettings,
  onAddPage,
  onAddFolder,
}: PageContextMenuProps) {
  // Check if page is the homepage (homepage cannot be deleted)
  const isItemHomepage = nodeType === 'page' && isHomepage(item as Page);

  // Check if page is dynamic (dynamic pages cannot be duplicated)
  const isItemDynamic = nodeType === 'page' && (item as Page).is_dynamic;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">

        {onSettings && (
          <ContextMenuItem onClick={onSettings}>
            <span>{nodeType === 'page' ? 'Page settings' : 'Folder settings'}</span>
          </ContextMenuItem>
        )}

        {nodeType === 'page' && onOpen && (
          <>
            <ContextMenuItem onClick={onOpen}>
              <span>Open page</span>
            </ContextMenuItem>
          </>
        )}

        {((nodeType === 'folder' && (onAddPage || onAddFolder)) || onRename) && <ContextMenuSeparator />}

        {nodeType === 'folder' && (
          <>
            {onAddPage && (
              <ContextMenuItem onClick={onAddPage}>
                <span>Add Page</span>
              </ContextMenuItem>
            )}
            {onAddFolder && (
              <ContextMenuItem onClick={onAddFolder}>
                <span>Add Folder</span>
              </ContextMenuItem>
            )}
          </>
        )}

        {onRename && (
          <ContextMenuItem onClick={onRename}>
            <span>Rename</span>
          </ContextMenuItem>
        )}

        {(onDuplicate || onDelete) && <ContextMenuSeparator />}

        {onDuplicate && (
          <ContextMenuItem onClick={onDuplicate} disabled={isItemDynamic}>
            <span>Duplicate</span>
          </ContextMenuItem>
        )}

        {onDelete && (
          <ContextMenuItem onClick={onDelete} disabled={isItemHomepage}>
            <span>Delete</span>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
