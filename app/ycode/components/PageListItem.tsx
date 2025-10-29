'use client';

/**
 * PageListItem Component
 * 
 * Reusable page list item for LeftSidebar
 */

// 1. React/Next.js
import React from 'react';

// 3. ShadCN UI
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

// 6. Utils/lib
import { cn } from '@/lib/utils';

// 7. Types
import type { Page } from '@/types';

interface PageListItemProps {
  page: Page;
  isActive: boolean;
  onSelect: (pageId: string) => void;
  onSettings: (page: Page) => void;
}

export function PageListItem({
  page,
  isActive,
  onSelect,
  onSettings,
}: PageListItemProps) {
  return (
    <div
      className={cn(
        'group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors',
        isActive
          ? 'bg-zinc-700 text-white'
          : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
      )}
      onClick={() => onSelect(page.id)}
    >
      <div className='flex items-center gap-2 flex-1 min-w-0'>
        <Icon name='file-text' className='w-4 h-4 shrink-0' />
        <span className='text-sm truncate'>{page.title || 'Untitled'}</span>
      </div>
      <Button
        variant='ghost'
        size='icon-sm'
        onClick={(e) => {
          e.stopPropagation();
          onSettings(page);
        }}
        className='opacity-0 group-hover:opacity-100 transition-opacity'
        aria-label='Page settings'
      >
        <Icon name='edit' className='w-4 h-4' />
      </Button>
    </div>
  );
}

export default PageListItem;

