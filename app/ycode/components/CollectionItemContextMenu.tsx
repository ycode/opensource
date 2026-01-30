'use client';

import React from 'react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';

interface CollectionItemContextMenuProps {
  children: React.ReactNode;
  onDuplicate: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

export default function CollectionItemContextMenu({
  children,
  onDuplicate,
  onDelete,
  disabled = false,
}: CollectionItemContextMenuProps) {
  if (disabled) {
    return <>{children}</>;
  }

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
