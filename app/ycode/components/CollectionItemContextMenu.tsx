'use client';

import React from 'react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';

interface CollectionItemContextMenuProps {
  children: React.ReactNode;
  isPublishable: boolean;
  hasPublishedVersion: boolean;
  isCollectionPublished: boolean;
  onSetAsDraft: () => void;
  onStageForPublish: () => void;
  onSetAsPublished: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  disabled?: boolean;
}

export default function CollectionItemContextMenu({
  children,
  isPublishable,
  hasPublishedVersion,
  isCollectionPublished,
  onSetAsDraft,
  onStageForPublish,
  onSetAsPublished,
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
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          disabled={!isPublishable && !hasPublishedVersion}
          onClick={onSetAsDraft}
        >
          Set as draft
        </ContextMenuItem>
        <ContextMenuItem
          disabled={isPublishable && !hasPublishedVersion}
          onClick={onStageForPublish}
        >
          Stage for publish
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!isCollectionPublished || (hasPublishedVersion && isPublishable)}
          onClick={onSetAsPublished}
        >
          Set as published
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onDuplicate}>
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem onClick={onDelete}>
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
