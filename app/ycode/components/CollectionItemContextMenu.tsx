'use client';

import React from 'react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';

interface CollectionItemContextMenuProps {
  children: React.ReactNode;
  onDuplicate: () => void;
  onDelete: () => void;
}

export default function CollectionItemContextMenu({
  children,
  onDuplicate,
  onDelete,
}: CollectionItemContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-44">
        <ContextMenuItem onClick={onDuplicate}>
          <span>Duplicate</span>
        </ContextMenuItem>
        
        <ContextMenuItem onClick={onDelete}>
          <span>Delete</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

