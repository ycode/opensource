'use client';

/**
 * File Manager Dialog
 *
 * Dialog for managing files and assets
 */

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';

interface FileManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  collapsed?: boolean;
}

interface FlattenedFolderNode extends FolderNode {
  index: number;
}

// Mock folder data
const mockFolders: FolderNode[] = [
  { id: '1', name: 'Images', parentId: null, depth: 0 },
  { id: '2', name: 'Product Photos', parentId: '1', depth: 1 },
  { id: '3', name: 'Hero Images', parentId: '1', depth: 1 },
  { id: '4', name: 'Icons', parentId: null, depth: 0 },
  { id: '5', name: 'Social', parentId: '4', depth: 1 },
  { id: '6', name: 'UI', parentId: '4', depth: 1 },
  { id: '7', name: 'Documents', parentId: null, depth: 0 },
  { id: '8', name: 'Videos', parentId: null, depth: 0 },
];

interface FolderRowProps {
  node: FlattenedFolderNode;
  isSelected: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}

function FolderRow({
  node,
  isSelected,
  hasChildren,
  isCollapsed,
  onSelect,
  onToggle,
}: FolderRowProps) {
  return (
    <div className="relative">
      {/* Vertical connector lines */}
      {node.depth > 0 && (
        <>
          {Array.from({ length: node.depth }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'absolute z-10 top-0 bottom-0 w-px',
                isSelected ? 'bg-white/30' : 'bg-white/10'
              )}
              style={{
                left: `${i * 14 + 16}px`,
              }}
            />
          ))}
        </>
      )}

      {/* Main Row */}
      <div
        className={cn(
          'group relative flex items-center h-8 outline-none focus:outline-none rounded-lg cursor-pointer select-none',
          'hover:bg-secondary/50',
          isSelected && 'bg-primary text-primary-foreground hover:bg-primary',
          !isSelected && 'text-secondary-foreground/80 dark:text-muted-foreground'
        )}
        style={{ paddingLeft: `${node.depth * 14 + 8}px` }}
        onClick={() => onSelect(node.id)}
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

        {/* Folder Icon */}
        <Icon
          name="folder"
          className={`size-3 ml-1 mr-2 ${isSelected ? 'opacity-90' : 'opacity-50'}`}
        />

        {/* Label */}
        <span className="flex-grow text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none">
          {node.name}
        </span>
      </div>
    </div>
  );
}

export function FileManagerDialog({
  open,
  onOpenChange,
}: FileManagerDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>('1');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  // Build flattened folder tree
  const flattenedFolders = useMemo(() => {
    const buildTree = (parentId: string | null, depth: number): FlattenedFolderNode[] => {
      const children = mockFolders.filter(f => f.parentId === parentId);
      const result: FlattenedFolderNode[] = [];

      children.forEach((folder, index) => {
        result.push({ ...folder, depth, index });

        // Add children if not collapsed
        if (!collapsedIds.has(folder.id)) {
          result.push(...buildTree(folder.id, depth + 1));
        }
      });

      return result;
    };

    return buildTree(null, 0);
  }, [collapsedIds]);

  const handleToggle = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Check if folder has children
  const hasChildren = (folderId: string) => {
    return mockFolders.some(f => f.parentId === folderId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="1200px" className="h-[80vh]">
        <DialogHeader>
          <DialogTitle className="sr-only">File Manager</DialogTitle>
          <div className="flex items-center justify-between gap-2 pr-7 -ml-2.5">
            <div className="w-full">
              <InputGroup>
                <InputGroupInput
                  placeholder="Search..."
                  autoFocus={false}
                />
                <InputGroupAddon>
                  <Icon name="search" className="size-3" />
                </InputGroupAddon>
              </InputGroup>
            </div>
            <Button size="sm">Upload</Button>
          </div>
        </DialogHeader>
        <div className="flex-1 flex -my-6 -mx-6 overflow-hidden">
          {/* Folder Sidebar */}
          <div className="w-60 border-r h-full overflow-y-auto px-4">
            <header className="py-5 flex justify-between">
              <span className="font-medium">File manager</span>
              <div className="-my-1">
                <Button
                  size="xs"
                  variant="secondary"
                >
                  <Icon name="plus" />
                </Button>
              </div>
            </header>
            <div className="space-y-0">
              {flattenedFolders.map((folder) => (
                <FolderRow
                  key={folder.id}
                  node={folder}
                  isSelected={folder.id === selectedFolderId}
                  hasChildren={hasChildren(folder.id)}
                  isCollapsed={collapsedIds.has(folder.id)}
                  onSelect={setSelectedFolderId}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>

          {/* File Grid */}
          <div className="flex-1 p-6 grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-4 overflow-y-auto">
            {Array.from({ length: 100 }).map((_, index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <div className="aspect-square bg-secondary/30 hover:bg-secondary/60 rounded-md overflow-hidden">
                  <img className="w-full h-full object-contain pointer-events-none" src="https://assets.ycodeapp.com/assets/app13650/Images/black-friday-seo-zyzdrwruvz.webp" />
                </div>
                <span className="truncate max-w-full text-[10px] opacity-60">academic-cap-solid-{index}</span>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
