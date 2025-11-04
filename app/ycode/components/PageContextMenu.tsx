'use client';

import React from 'react';
import { ContextMenu,ContextMenuContent,ContextMenuItem,ContextMenuSeparator,ContextMenuTrigger } from '@/components/ui/context-menu';
import type { Page, PageFolder } from '@/types';

interface PageContextMenuProps {
  item: Page | PageFolder;
  children: React.ReactNode;
  nodeType: 'page' | 'folder';
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
  onRename,
  onDuplicate,
  onDelete,
  onSettings,
  onAddPage,
  onAddFolder,
}: PageContextMenuProps) {
  // Check if page is locked (locked pages cannot be deleted)
  const isLocked = nodeType === 'page' ? (item as Page).is_locked : false;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        {nodeType === 'page' && onSettings && (
          <>
            <ContextMenuItem onClick={onSettings}>
              <span>Edit page</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

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
            <ContextMenuSeparator />
          </>
        )}

        {onRename && (
          <ContextMenuItem onClick={onRename}>
            <span>Rename</span>
          </ContextMenuItem>
        )}

        {onDuplicate && (
          <ContextMenuItem onClick={onDuplicate}>
            <span>Duplicate</span>
          </ContextMenuItem>
        )}

        {onDelete && (onRename || onDuplicate) && <ContextMenuSeparator />}

        {onDelete && (
          <ContextMenuItem onClick={onDelete} disabled={isLocked}>
            <span>Delete</span>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

