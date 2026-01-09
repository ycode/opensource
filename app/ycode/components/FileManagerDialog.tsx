'use client';

/**
 * File Manager Dialog
 *
 * Dialog for managing files and assets
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { assetFoldersApi, assetsApi, uploadFileApi } from '@/lib/api';
import type { AssetFolder, Asset } from '@/types';
import { getAcceptString, getAssetIcon, getOptimizedImageUrl, isAssetOfType, getAssetCategoryFromMimeType } from '@/lib/asset-utils';
import { ASSET_CATEGORIES } from '@/lib/asset-constants';
import type { AssetCategory } from '@/types';
import {
  flattenAssetFolderTree,
  hasChildFolders,
  rebuildAssetFolderTree,
  isDescendantAssetFolder,
  type FlattenedAssetFolderNode,
} from '@/lib/asset-folder-utils';
import { Spinner } from '@/components/ui/spinner';
import { useAssetsStore } from '@/stores/useAssetsStore';
import AssetFolderDialog from './AssetFolderDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useTreeDragDrop } from '@/hooks/use-tree-drag-drop';
import { toast } from 'sonner';

interface FileManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssetSelect?: (asset: Asset) => void | false;
  assetId?: string | null;
  category?: AssetCategory | 'all' | null;
}

interface FolderRowProps {
  node: FlattenedAssetFolderNode;
  isSelected: boolean;
  hasChildren: boolean;
  isCollapsed: boolean;
  isOver: boolean;
  isDragging: boolean;
  isDragActive: boolean;
  dropPosition: 'above' | 'below' | 'inside' | null;
  assetCount: number;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

function FolderRow({
  node,
  isSelected,
  hasChildren,
  isCollapsed,
  isOver,
  isDragging,
  isDragActive,
  dropPosition,
  assetCount,
  onSelect,
  onToggle,
  onDelete,
  onEdit,
}: FolderRowProps) {
  // Setup drag and drop
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
        {...listeners}
        data-drag-active={isDragActive}
        data-node-id={node.id}
        className={cn(
          'group relative flex items-center h-8 outline-none focus:outline-none rounded-lg cursor-pointer select-none',
          !isDragActive && !isDragging && 'hover:bg-secondary/50',
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
          {node.data.name}
        </span>

        {/* Asset Count - shown when not hovering */}
        {assetCount > 0 && (
          <span
            className={cn(
              'text-xs mr-3 pointer-events-none flex-shrink-0 group-hover:opacity-0',
              isSelected ? 'opacity-80' : 'opacity-60'
            )}
          >
            {assetCount}
          </span>
        )}

        {/* Options Menu - shown when hovering */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div
              className={cn(
                'size-5.75 opacity-0 group-hover:opacity-100 mr-1 p-0.5 rounded-sm backdrop-blur-sm hover:bg-secondary/80 cursor-pointer flex items-center justify-center',
                isSelected && 'hover:bg-primary-foreground/20',
                assetCount > 0 ? 'absolute right-0' : ''
              )}
            >
              <Icon name="dotsHorizontal" className="size-3" />
            </div>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            side="right"
            className="min-w-24"
          >
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onEdit(node.id);
              }}
            >
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete(node.id);
              }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface FileGridItemProps {
  id: string;
  name: string;
  type: 'folder' | 'asset' | 'uploading';
  onClick?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onPreview?: () => void;
  // For bulk selection
  isSelected?: boolean;
  onSelectChange?: (selected: boolean) => void;
  // For assets
  mimeType?: string | null;
  imageUrl?: string | null;
  content?: string | null; // For inline SVG content
  // For uploading assets
  file?: File;
}

function FileGridItem({
  id,
  name,
  type,
  onClick,
  onDelete,
  onEdit,
  onPreview,
  isSelected = false,
  onSelectChange,
  mimeType,
  imageUrl,
  content,
  file,
}: FileGridItemProps) {
  const showMenu = (type === 'folder' || type === 'asset') && (onDelete || onEdit || onPreview);
  const isUploading = type === 'uploading';
  const isImage = type === 'asset' && mimeType?.startsWith('image/') && (imageUrl || content);
  const showCheckbox = type === 'asset' && onSelectChange !== undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', !isUploading && 'group')}>
      <div
        className={cn(
          'relative aspect-square bg-secondary/30 rounded-md flex items-center justify-center overflow-hidden',
          !isUploading && 'hover:bg-secondary/60 cursor-pointer',
          isSelected && 'ring-2 ring-primary/75',
        )}
        onClick={!isUploading ? onClick : undefined}
      >
        {/* Checkbox - top left corner (only for assets) */}
        {showCheckbox && (
          <div
            className="absolute top-1.5 left-1.5 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelectChange?.(checked === true)}
              className={cn(
                'bg-background/90 backdrop-blur border',
                isSelected ? 'border-primary' : 'border-foreground/10'
              )}
            />
          </div>
        )}

        {/* Folder Icon */}
        {type === 'folder' && <Icon name="folder" className="size-10 opacity-50" />}

        {/* Asset Content */}
        {type === 'asset' && (
          <>
            {(() => {
              const isIcon = content || (mimeType && isAssetOfType(mimeType, ASSET_CATEGORIES.ICONS));
              const isImage = mimeType?.startsWith('image/') && !isIcon && imageUrl;
              const showCheckerboard = isIcon || isImage;

              if (isIcon || (mimeType?.startsWith('image/') && imageUrl)) {
                return (
                  <>
                    {/* Checkerboard pattern for transparency - only for images and icons */}
                    {showCheckerboard && (
                      <div className="absolute inset-0 opacity-10 bg-checkerboard" />
                    )}
                    {content ? (
                      // Inline SVG content (icon)
                      <div
                        data-icon
                        className="relative w-full h-full flex items-center justify-center p-5 pointer-events-none text-foreground z-10"
                        dangerouslySetInnerHTML={{ __html: content }}
                      />
                    ) : imageUrl ? (
                      // Image URL
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className="relative w-full h-full object-contain pointer-events-none rounded-md z-10"
                          src={getOptimizedImageUrl(imageUrl)}
                          alt={name}
                          loading="lazy"
                          width={110}
                          height={110}
                        />
                      </>
                    ) : null}
                  </>
                );
              }
              return <Icon name={getAssetIcon(mimeType) as any} className="size-10 opacity-50" />;
            })()}
          </>
        )}

        {/* Uploading Asset Content */}
        {isUploading && file && (
          <>
            {(() => {
              const isIcon = isAssetOfType(file.type, ASSET_CATEGORIES.ICONS);
              const isImage = file.type.startsWith('image/') && !isIcon;
              const showCheckerboard = isIcon || isImage;

              return (
                <>
                  {/* Checkerboard pattern for transparency - only for images and icons */}
                  {showCheckerboard && (
                    <div className="absolute inset-0 opacity-10 bg-checkerboard" />
                  )}
                  {isIcon ? (
                    <>
                      <div
                        className="relative w-full h-full flex items-center justify-center p-5 pointer-events-none text-foreground opacity-30 z-10"
                      >
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="icon" className="size-15" />
                        </div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-background/20 z-20">
                        <Spinner className="size-10 opacity-60" />
                      </div>
                    </>
                  ) : isImage ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="relative w-full h-full object-contain pointer-events-none opacity-40 z-10"
                        src={URL.createObjectURL(file)}
                        alt={name}
                        width={110}
                        height={110}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-background/20 z-20">
                        <Spinner className="size-10 opacity-60" />
                      </div>
                    </>
                  ) : (
                    <>
                      <Icon name={getAssetIcon(file.type) as any} className="size-10 opacity-30" />
                      <div className="absolute inset-0 flex items-center justify-center bg-background/20">
                        <Spinner className="size-10 opacity-60" />
                      </div>
                    </>
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* Options Menu */}
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'absolute top-1.5 right-1.5 size-5.75 opacity-0 group-hover:opacity-80 p-0.5 rounded-sm bg-secondary/80 backdrop-blur-sm hover:bg-secondary cursor-pointer flex items-center justify-center z-20'
                )}
              >
                <Icon name="dotsHorizontal" className="size-3" />
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start"
              side="bottom"
              className="min-w-24"
            >
              {isImage && onPreview && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onPreview();
                  }}
                >
                  Preview
                </DropdownMenuItem>
              )}
              {onEdit && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                >
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <span className="truncate max-w-full text-xs opacity-60 text-center" title={name}>
        {name}
      </span>
    </div>
  );
}

export default function FileManagerDialog({
  open,
  onOpenChange,
  onAssetSelect,
  assetId,
  category,
}: FileManagerDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [showCreateFolderDialog, setShowCreateFolderDialog] = useState(false);
  const [showEditFolderDialog, setShowEditFolderDialog] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [editFolderParentId, setEditFolderParentId] = useState<string | null>(null);
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [showDeleteAssetConfirmDialog, setShowDeleteAssetConfirmDialog] = useState(false);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [showEditAssetDialog, setShowEditAssetDialog] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editAssetName, setEditAssetName] = useState('');
  const [editAssetFolderId, setEditAssetFolderId] = useState<string | null>(null);
  const [editAssetContent, setEditAssetContent] = useState<string | null>(null);
  const [isCreateSvgMode, setIsCreateSvgMode] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadingAssets, setUploadingAssets] = useState<Array<{ id: string; filename: string; file: File }>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | 'all'>(category || 'all');

  // Update selectedCategory when category prop changes
  useEffect(() => {
    if (category !== undefined) {
      setSelectedCategory(category || 'all');
    }
  }, [category]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [showBulkMoveDialog, setShowBulkMoveDialog] = useState(false);
  const [bulkMoveTargetFolderId, setBulkMoveTargetFolderId] = useState<string | null>(null);
  const [showBulkDeleteConfirmDialog, setShowBulkDeleteConfirmDialog] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Get folders and assets from store
  const folders = useAssetsStore((state) => state.folders);
  const setFolders = useAssetsStore((state) => state.setFolders);
  const storeAssets = useAssetsStore((state) => state.assets);
  const addFolder = useAssetsStore((state) => state.addFolder);
  const updateFolder = useAssetsStore((state) => state.updateFolder);
  const deleteFolder = useAssetsStore((state) => state.deleteFolder);
  const batchReorderFolders = useAssetsStore((state) => state.batchReorderFolders);
  const addAsset = useAssetsStore((state) => state.addAsset);
  const updateAsset = useAssetsStore((state) => state.updateAsset);
  const removeAsset = useAssetsStore((state) => state.removeAsset);

  // Get all descendant folder IDs for a folder (including the folder itself)
  const getAllDescendantFolderIds = useCallback((folderId: string | null): string[] => {
    if (folderId === null) {
      // Root: return all folder IDs plus null for root assets
      return ['root', ...folders.map(f => f.id)];
    }

    const descendants: string[] = [folderId];
    const children = folders.filter(f => f.asset_folder_id === folderId);

    for (const child of children) {
      descendants.push(...getAllDescendantFolderIds(child.id));
    }

    return descendants;
  }, [folders]);

  // Filter assets by selected folder, search query, and category
  const assets = useMemo(() => {
    let filteredAssets: typeof storeAssets;

    if (searchQuery.trim()) {
      // Search mode: include assets from current folder and all descendants
      const searchLower = searchQuery.toLowerCase().trim();
      const allowedFolderIds = getAllDescendantFolderIds(selectedFolderId);

      filteredAssets = storeAssets.filter((asset) => {
        // Check if asset is in current folder or descendants
        const assetFolderId = asset.asset_folder_id || 'root';
        const isInScope = allowedFolderIds.includes(assetFolderId);

        // Check if filename matches search query
        const matchesSearch = asset.filename.toLowerCase().includes(searchLower);

        // Check if asset matches selected category
        let matchesCategory = false;
        if (selectedCategory === 'all') {
          matchesCategory = true;
        } else {
          const assetCategory = getAssetCategoryFromMimeType(asset.mime_type);
          matchesCategory = assetCategory === selectedCategory;
        }

        return isInScope && matchesSearch && matchesCategory;
      });
    } else {
      // Normal mode: only show assets in current folder (not descendants)
      filteredAssets = selectedFolderId === null
        ? storeAssets.filter((asset) => !asset.asset_folder_id)
        : storeAssets.filter((asset) => asset.asset_folder_id === selectedFolderId);

      // Apply category filter
      if (selectedCategory !== 'all') {
        filteredAssets = filteredAssets.filter((asset) => {
          const assetCategory = getAssetCategoryFromMimeType(asset.mime_type);
          return assetCategory === selectedCategory;
        });
      }
    }

    return filteredAssets;
  }, [storeAssets, selectedFolderId, searchQuery, selectedCategory, getAllDescendantFolderIds]);

  // Get uploading assets for the current folder
  const currentUploadingAssets = useMemo(() => {
    return uploadingAssets;
  }, [uploadingAssets]);

  // Get child folders for the selected folder
  const childFolders = useMemo(() => {
    return folders.filter((folder) => folder.asset_folder_id === selectedFolderId);
  }, [folders, selectedFolderId]);

  // Calculate asset counts for each folder
  const folderAssetCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    // Count assets per folder (including root)
    storeAssets.forEach((asset) => {
      const folderId = asset.asset_folder_id || 'root';
      counts[folderId] = (counts[folderId] || 0) + 1;
    });

    return counts;
  }, [storeAssets]);

  // Build flattened folder tree with virtual "All Files" root
  const flattenedFolders = useMemo(() => {
    const virtualRoot: FlattenedAssetFolderNode = {
      id: 'root',
      data: {
        id: 'root',
        asset_folder_id: null,
        name: 'All files',
        depth: 0,
        order: 0,
        is_published: false,
        created_at: '',
        updated_at: '',
        deleted_at: null,
      },
      depth: 0,
      parentId: null,
      index: 0,
    };

    // If root is collapsed, only show the root
    if (collapsedIds.has('root')) {
      return [virtualRoot];
    }

    // Flatten actual folders starting at depth 1
    const actualFolders = flattenAssetFolderTree(folders, null, collapsedIds, 1);

    return [virtualRoot, ...actualFolders];
  }, [folders, collapsedIds]);

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

  // Auto-expand node callback for drag and drop
  const handleAutoExpandNode = useCallback((nodeId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.delete(nodeId);
      return next;
    });
  }, []);

  // Drag and drop using the reusable hook
  const {
    activeId,
    overId,
    dropPosition,
    isDropNotAllowed,
    sensors,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  } = useTreeDragDrop({
    flattenedNodes: flattenedFolders.filter(n => n.id !== 'root'), // Exclude virtual root
    canDrag: (node) => node.id !== 'root',
    canDrop: (activeNode, overNode, position, targetParentId) => {
      // Can't drop on virtual root
      if (overNode && overNode.id === 'root') return false;

      // Can't drop folder into its own descendant
      if (overNode) {
        return !isDescendantAssetFolder(overNode.id, activeNode.id, folders);
      }

      return true;
    },
    onRebuild: (activeNode, newParentId, newOrder) => {
      return rebuildAssetFolderTree(
        flattenedFolders.filter(n => n.id !== 'root'),
        activeNode.id,
        newParentId,
        newOrder
      );
    },
    onReorder: async (updatedFolders) => {
      try {
        await batchReorderFolders(updatedFolders);
      } catch (error) {
        console.error('Failed to reorder folders:', error);
      }
    },
    onAutoExpandNode: handleAutoExpandNode,
  });

  // Calculate depth of a folder by traversing up the tree (database depth, 0 for root)
  const calculateFolderDepth = (folderId: string | null): number => {
    if (!folderId) return 0;
    const folder = folders.find(f => f.id === folderId);
    if (!folder || !folder.asset_folder_id) return 0;
    return 1 + calculateFolderDepth(folder.asset_folder_id);
  };

  // Clear selection when folder changes or dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedAssetIds(new Set());
    }
  }, [open]);

  useEffect(() => {
    setSelectedAssetIds(new Set());
  }, [selectedFolderId]);

  // When dialog opens with an assetId, navigate to that asset's folder
  useEffect(() => {
    if (open && assetId) {
      const asset = storeAssets.find(a => a.id === assetId);
      if (asset) {
        const assetFolderId = asset.asset_folder_id || null;

        // Set the folder as selected
        setSelectedFolderId(assetFolderId);

        // Expand all parent folders to show the asset's folder
        if (assetFolderId) {
          const expandParentFolders = (folderId: string | null) => {
            if (!folderId) return;

            const folder = folders.find(f => f.id === folderId);
            if (folder) {
              // Expand this folder
              setCollapsedIds((prev) => {
                const next = new Set(prev);
                next.delete(folderId);
                return next;
              });

              // Recursively expand parent folders
              if (folder.asset_folder_id) {
                expandParentFolders(folder.asset_folder_id);
              }
            }
          };

          expandParentFolders(assetFolderId);
        }
      }
    }
  }, [open, assetId, storeAssets, folders]);

  // Build breadcrumb path from root to selected folder
  const breadcrumbPath = useMemo(() => {
    const path: Array<{ id: string | null; name: string }> = [
      { id: null, name: 'All files' }
    ];

    if (selectedFolderId) {
      const buildPath = (folderId: string): void => {
        const folder = folders.find(f => f.id === folderId);
        if (folder) {
          if (folder.asset_folder_id) {
            buildPath(folder.asset_folder_id);
          }
          path.push({ id: folder.id, name: folder.name });
        }
      };

      buildPath(selectedFolderId);
    }

    return path;
  }, [selectedFolderId, folders]);

  // Build full path for a folder (for select dropdown)
  const buildFolderPath = useCallback((folderId: string | null): string => {
    if (!folderId) return 'All files';

    const pathParts: string[] = [];
    let currentId: string | null = folderId;

    while (currentId) {
      const folder = folders.find(f => f.id === currentId);
      if (!folder) break;
      pathParts.unshift(folder.name);
      currentId = folder.asset_folder_id;
    }

    return `All files / ${pathParts.join(' / ')}`;
  }, [folders]);

  // Create new folder
  const handleCreateFolder = async (folderName: string, parentFolderId: string | null) => {
    try {
      const depth = parentFolderId ? calculateFolderDepth(parentFolderId) + 1 : 0;
      const order = folders.filter(f => f.asset_folder_id === parentFolderId).length;

      const response = await assetFoldersApi.create({
        name: folderName,
        asset_folder_id: parentFolderId,
        depth,
        order,
        is_published: false,
      });

      if (response.error) {
        console.error('Failed to create folder:', response.error);
        return;
      }

      if (response.data) {
        addFolder(response.data);

        // Auto-expand parent folder so the new child is visible
        if (parentFolderId) {
          setCollapsedIds((prev) => {
            const next = new Set(prev);
            next.delete(parentFolderId);
            return next;
          });
        } else {
          // If creating at root, auto-expand root
          setCollapsedIds((prev) => {
            const next = new Set(prev);
            next.delete('root');
            return next;
          });
        }
      }
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  // Show delete confirmation
  const handleDeleteFolder = (id: string) => {
    setDeletingFolderId(id);
    setShowDeleteConfirmDialog(true);
  };

  // Get all descendant folder IDs recursively (for UI calculations only)
  const getDescendantFolderIds = (folderId: string): string[] => {
    const children = folders.filter(f => f.asset_folder_id === folderId);
    const descendants: string[] = children.map(c => c.id);

    for (const child of children) {
      descendants.push(...getDescendantFolderIds(child.id));
    }

    return descendants;
  };

  // Confirm delete folder
  const handleConfirmDeleteFolder = async () => {
    if (!deletingFolderId) return;

    try {
      // Get the parent folder of the folder being deleted before deletion
      const folderBeingDeleted = folders.find(f => f.id === deletingFolderId);
      const parentFolderId = folderBeingDeleted?.asset_folder_id || null;

      // Delete folder via store (handles all cascading logic)
      const deletedFolderIds = await deleteFolder(deletingFolderId);

      // If deleted folder or its descendants were selected, select the parent folder
      if (selectedFolderId && deletedFolderIds.includes(selectedFolderId)) {
        setSelectedFolderId(parentFolderId);
      }

      setDeletingFolderId(null);
    } catch (error) {
      console.error('Failed to delete folder:', error);
    }
  };

  // Start editing folder
  const handleEditFolder = (id: string) => {
    const folder = folders.find(f => f.id === id);
    if (folder) {
      setEditingFolderId(id);
      setEditFolderName(folder.name);
      setEditFolderParentId(folder.asset_folder_id);
      setShowEditFolderDialog(true);
    }
  };

  // Confirm folder edit
  const handleConfirmEdit = async (newName: string, newParentFolderId: string | null) => {
    if (!editingFolderId) return;

    try {
      const folder = folders.find(f => f.id === editingFolderId);
      const updateData: { name: string; asset_folder_id?: string | null; depth?: number } = {
        name: newName,
      };

      // If parent folder changed, update it and recalculate depth
      if (newParentFolderId !== folder?.asset_folder_id) {
        updateData.asset_folder_id = newParentFolderId;
        updateData.depth = newParentFolderId ? calculateFolderDepth(newParentFolderId) + 1 : 0;
      }

      const response = await assetFoldersApi.update(editingFolderId, updateData);

      if (response.error) {
        console.error('Failed to update folder:', response.error);
        return;
      }

      if (response.data) {
        updateFolder(editingFolderId, response.data);
        setEditingFolderId(null);
        setEditFolderName('');
        setEditFolderParentId(null);

        // Auto-expand new parent folder if parent changed
        if (newParentFolderId && newParentFolderId !== folder?.asset_folder_id) {
          setCollapsedIds((prev) => {
            const next = new Set(prev);
            next.delete(newParentFolderId);
            return next;
          });
        }
      }
    } catch (error) {
      console.error('Failed to update folder:', error);
    }
  };

  // Show delete asset confirmation
  const handleDeleteAsset = (id: string) => {
    setDeletingAssetId(id);
    setShowDeleteAssetConfirmDialog(true);
  };

  // Confirm delete asset
  const handleConfirmDeleteAsset = async () => {
    if (!deletingAssetId) return;

    // Save asset for rollback if needed
    const assetToDelete = storeAssets.find((a) => a.id === deletingAssetId);
    if (!assetToDelete) return;

    try {
      // Optimistically remove from store
      removeAsset(deletingAssetId);
      setDeletingAssetId(null);

      // Make API call
      const response = await assetsApi.delete(deletingAssetId);

      if (response.error) {
        console.error('Failed to delete asset:', response.error);
        // Rollback: add asset back to store
        addAsset(assetToDelete);
        return;
      }
    } catch (error) {
      console.error('Failed to delete asset:', error);
      // Rollback: add asset back to store
      addAsset(assetToDelete);
    }
  };

  // Bulk delete assets
  const handleBulkDelete = async () => {
    if (selectedAssetIds.size === 0) return;

    const idsToDelete = Array.from(selectedAssetIds);

    // Save assets for rollback
    const assetsToDelete = idsToDelete.map((id) => {
      const asset = storeAssets.find((a) => a.id === id);
      return { id, asset };
    }).filter((item) => item.asset) as Array<{ id: string; asset: Asset }>;

    if (assetsToDelete.length === 0) return;

    try {
      // Optimistically remove from store
      assetsToDelete.forEach(({ id }) => {
        removeAsset(id);
      });

      // Clear selection
      setSelectedAssetIds(new Set());

      // Make bulk API call
      const response = await assetsApi.bulkDelete(idsToDelete);

      if (response.error) {
        console.error('Failed to delete assets:', response.error);
        // Rollback: add all assets back to store
        assetsToDelete.forEach(({ asset }) => {
          addAsset(asset);
        });
        toast.error('Failed to delete assets', {
          description: response.error,
        });
        return;
      }

      if (response.data) {
        const { success, failed } = response.data;

        // Rollback failed deletions
        if (failed.length > 0) {
          failed.forEach((id) => {
            const item = assetsToDelete.find((a) => a.id === id);
            if (item) {
              addAsset(item.asset);
            }
          });
        }

        if (failed.length > 0) {
          toast.error('Some assets could not be deleted', {
            description: `${success.length} deleted, ${failed.length} failed`,
          });
        }
      }
    } catch (error) {
      console.error('Failed to delete assets:', error);
      // Rollback: add all assets back to store
      assetsToDelete.forEach(({ asset }) => {
        addAsset(asset);
      });
      toast.error('Failed to delete assets');
    }
  };

  // Bulk move assets
  const handleBulkMove = async (targetFolderId: string | null) => {
    if (selectedAssetIds.size === 0) return;

    const idsToMove = Array.from(selectedAssetIds);

    // Save original folder IDs for rollback
    const assetsToMove = idsToMove.map((id) => {
      const asset = storeAssets.find((a) => a.id === id);
      return { id, asset, originalFolderId: asset?.asset_folder_id };
    }).filter((item) => item.asset) as Array<{ id: string; asset: Asset; originalFolderId: string | null | undefined }>;

    if (assetsToMove.length === 0) return;

    try {
      // Optimistically update in store
      assetsToMove.forEach(({ id }) => {
        updateAsset(id, { asset_folder_id: targetFolderId });
      });

      // Clear selection
      setSelectedAssetIds(new Set());
      setShowBulkMoveDialog(false);

      // Make bulk API call
      const response = await assetsApi.bulkMove(idsToMove, targetFolderId);

      if (response.error) {
        console.error('Failed to move assets:', response.error);
        // Rollback: restore original folders
        assetsToMove.forEach(({ id, originalFolderId }) => {
          updateAsset(id, { asset_folder_id: originalFolderId });
        });
        toast.error('Failed to move assets', {
          description: response.error,
        });
        return;
      }

      if (response.data) {
        const { success, failed } = response.data;

        // Rollback failed moves
        if (failed.length > 0) {
          failed.forEach((id) => {
            const item = assetsToMove.find((a) => a.id === id);
            if (item) {
              updateAsset(id, { asset_folder_id: item.originalFolderId });
            }
          });
        }

        if (failed.length > 0) {
          toast.error('Some assets could not be moved', {
            description: `${success.length} moved, ${failed.length} failed`,
          });
        }
      }
    } catch (error) {
      console.error('Failed to move assets:', error);
      // Rollback: restore original folders
      assetsToMove.forEach(({ id, originalFolderId }) => {
        updateAsset(id, { asset_folder_id: originalFolderId });
      });
      toast.error('Failed to move assets');
    }
  };

  // Preview asset (open in new tab)
  const handlePreviewAsset = (imageUrl: string) => {
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
  };

  // Start creating SVG
  const handleCreateSvg = () => {
    setIsCreateSvgMode(true);
    setEditingAssetId(null);
    setEditAssetName('');
    setEditAssetFolderId(selectedFolderId);
    setEditAssetContent('');
    setShowEditAssetDialog(true);
  };

  // Start editing asset
  const handleEditAsset = (id: string) => {
    setIsCreateSvgMode(false);
    const asset = storeAssets.find(a => a.id === id);
    if (asset) {
      setEditingAssetId(id);
      setEditAssetName(asset.filename);
      setEditAssetFolderId(asset.asset_folder_id || null);
      setEditAssetContent(asset.content || null);
      setShowEditAssetDialog(true);
    }
  };

  // Create SVG asset
  const handleCreateSvgAsset = async (name: string, folderId: string | null, content: string) => {
    if (!name.trim() || !content.trim()) return;

    try {
      const response = await assetsApi.create({
        filename: name,
        content,
        asset_folder_id: folderId,
        source: 'file-manager',
      });

      if (response.error) {
        toast.error('Unable to create SVG icon', {
          description: response.error,
        });
        return;
      }

      if (response.data) {
        addAsset(response.data);
      }

      setShowEditAssetDialog(false);
      setEditAssetName('');
      setEditAssetFolderId(null);
      setEditAssetContent(null);
      setIsCreateSvgMode(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create SVG asset';
      toast.error('Unable to create SVG icon', {
        description: errorMessage,
      });
    }
  };

  // Confirm asset edit
  const handleConfirmEditAsset = async (newName: string, newFolderId: string | null, newContent?: string | null) => {
    if (isCreateSvgMode) {
      await handleCreateSvgAsset(newName, newFolderId, newContent || '');
      return;
    }

    if (!editingAssetId || !newName.trim()) return;

    // Save original asset for rollback
    const originalAsset = storeAssets.find(a => a.id === editingAssetId);
    if (!originalAsset) return;

    try {
      // Build update data
      const updateData: { filename?: string; asset_folder_id?: string | null; content?: string | null } = {};
      if (newName !== originalAsset.filename) {
        updateData.filename = newName;
      }
      if (newFolderId !== originalAsset.asset_folder_id) {
        updateData.asset_folder_id = newFolderId;
      }
      if (newContent !== undefined && newContent !== originalAsset.content) {
        updateData.content = newContent;
      }

      // Only update if there are changes
      if (Object.keys(updateData).length === 0) {
        setEditingAssetId(null);
        setEditAssetName('');
        setEditAssetFolderId(null);
        setEditAssetContent(null);
        return;
      }

      // Optimistically update in store
      updateAsset(editingAssetId, updateData);
      setEditingAssetId(null);
      setEditAssetName('');
      setEditAssetFolderId(null);
      setEditAssetContent(null);

      // Make API call (server will clean SVG content and save it)
      const response = await assetsApi.update(editingAssetId, updateData);

      if (response.error) {
        // Rollback: restore original values
        updateAsset(editingAssetId, originalAsset);
        toast.error('Unable to update asset', {
          description: response.error,
        });
        return;
      }

      if (response.data) {
        // Update with server response to ensure consistency
        updateAsset(editingAssetId, response.data);
      }
    } catch (error) {
      // Rollback on error
      updateAsset(editingAssetId, originalAsset);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update asset';
      toast.error('Unable to update asset', {
        description: errorMessage,
      });
    }
  };

  // Handle file upload button click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Selection handlers
  const handleAssetSelect = (assetId: string, selected: boolean) => {
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(assetId);
      } else {
        next.delete(assetId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedAssetIds.size === assets.length) {
      setSelectedAssetIds(new Set());
    } else {
      setSelectedAssetIds(new Set(assets.map((asset) => asset.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedAssetIds(new Set());
  };

  // Handle file selection
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    // Create temporary uploading assets
    const tempAssets = Array.from(files).map((file) => ({
      id: `temp-${Math.random().toString(36).substr(2, 9)}`,
      filename: file.name,
      file,
    }));
    setUploadingAssets(tempAssets);

    try {
      const uploadPromises = tempAssets.map(async (tempAsset) => {
        try {
          const asset = await uploadFileApi(
            tempAsset.file,
            'file-manager',
            null,
            undefined,
            selectedFolderId
          );

          if (asset) {
            addAsset(asset);
            setUploadProgress((prev) => prev ? { ...prev, current: prev.current + 1 } : null);

            // Remove the temp asset once real asset is added
            setUploadingAssets((prev) => prev.filter((temp) => temp.id !== tempAsset.id));
          }
        } catch (error) {
          console.error(`Failed to upload ${tempAsset.filename}:`, error);
          // Remove the temp asset on error too
          setUploadingAssets((prev) => prev.filter((temp) => temp.id !== tempAsset.id));
        }
      });

      await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Failed to upload files:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      setUploadingAssets([]);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          width="1200px"
          className="h-[80vh]"
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle className="sr-only">File Manager</DialogTitle>

            <div className="flex items-center justify-between gap-2 pr-7 -ml-2.5">
              <div className="flex items-center gap-2 flex-1">
                <div className="flex-1">
                  <InputGroup>
                    <InputGroupAddon>
                      <Icon name="search" className="size-3" />
                    </InputGroupAddon>

                    <InputGroupInput
                      placeholder="Search..."
                      autoFocus={false}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoComplete="off"
                    />

                    {searchQuery.trim() && (
                      <InputGroupAddon align="inline-end">
                        <button
                          onClick={() => setSearchQuery('')}
                          className="size-6 transition-opacity flex items-center justify-center cursor-pointer rounded-sm hover:bg-secondary/80"
                          aria-label="Clear search"
                        >
                          <Icon name="x" className="size-3" />
                        </button>
                      </InputGroupAddon>
                    )}
                  </InputGroup>
                </div>

                <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as AssetCategory | 'all')}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all"><Icon name="layers" className="size-3" /> All types</SelectItem>
                    <SelectItem value={ASSET_CATEGORIES.ICONS}><Icon name="icon" className="size-3" /> Icons</SelectItem>
                    <SelectItem value={ASSET_CATEGORIES.IMAGES}><Icon name="image" className="size-3" /> Images</SelectItem>
                    <SelectItem value={ASSET_CATEGORIES.VIDEOS}><Icon name="video" className="size-3" /> Videos</SelectItem>
                    <SelectItem value={ASSET_CATEGORIES.AUDIO}><Icon name="audio" className="size-3" /> Audio</SelectItem>
                    <SelectItem value={ASSET_CATEGORIES.DOCUMENTS}><Icon name="file-text" className="size-3" /> Documents</SelectItem>
                  </SelectContent>
                </Select>

                <Separator orientation="vertical" className="h-7! shrink-0 mx-0.5" />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCreateSvg}
                >
                  <Icon name="icon" />
                  SVG
                </Button>
                <Button
                  size="sm"
                  onClick={handleUploadClick}
                  disabled={isUploading}
                >
                  <Icon name="upload" />
                  Upload
                </Button>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={getAcceptString()}
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </DialogHeader>

          <div className="flex-1 flex -my-6 -mx-6 overflow-hidden">
            {/* Folder Sidebar */}
            <div className="w-64 border-r h-full overflow-y-auto px-4">
            <header className="py-5 flex justify-between">
              <span className="font-medium">File manager</span>
              <div className="-my-1">
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => {
                    // Expand selected folder when creating a child
                    if (selectedFolderId) {
                      setCollapsedIds((prev) => {
                        const next = new Set(prev);
                        next.delete(selectedFolderId);
                        return next;
                      });
                    } else {
                      // Expand root if creating at root level
                      setCollapsedIds((prev) => {
                        const next = new Set(prev);
                        next.delete('root');
                        return next;
                      });
                    }
                    setShowCreateFolderDialog(true);
                  }}
                >
                  <Icon name="plus" />
                </Button>
              </div>
            </header>
            <div className="space-y-0">
              {flattenedFolders.map((folder) => {
                // Virtual root gets special treatment
                if (folder.id === 'root') {
                  const hasRootChildren = folders.some(f => f.asset_folder_id === null);
                  const isRootCollapsed = collapsedIds.has('root');

                  return (
                    <div
                      key="root"
                      className={cn(
                        'group relative flex items-center h-8 outline-none focus:outline-none rounded-lg cursor-pointer select-none',
                        'hover:bg-secondary/50',
                        selectedFolderId === null && 'bg-primary text-primary-foreground hover:bg-primary',
                        selectedFolderId !== null && 'text-secondary-foreground/80 dark:text-muted-foreground'
                      )}
                      style={{ paddingLeft: '8px' }}
                      onClick={() => setSelectedFolderId(null)}
                    >
                      {/* Expand/Collapse Button */}
                      {hasRootChildren ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggle('root');
                          }}
                          className={cn(
                            'w-4 h-4 flex items-center justify-center flex-shrink-0 cursor-pointer',
                            isRootCollapsed ? '' : 'rotate-90'
                          )}
                        >
                          <Icon name="chevronRight" className={cn('size-2.5 opacity-50', selectedFolderId === null && 'opacity-80')} />
                        </div>
                      ) : (
                        <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
                          <div className={cn('ml-0.25 w-1.5 h-px bg-white opacity-0', selectedFolderId === null && 'opacity-0')} />
                        </div>
                      )}

                      {/* Folder Icon */}
                      <Icon
                        name="folder"
                        className={`size-3 ml-1 mr-2 ${selectedFolderId === null ? 'opacity-90' : 'opacity-50'}`}
                      />

                      {/* Label */}
                      <span className="flex-grow text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap pointer-events-none">
                        All files
                      </span>

                      {/* Asset Count - shown when not hovering */}
                      {(folderAssetCounts['root'] || 0) > 0 && (
                        <span
                          className={cn(
                            'text-xs mr-1 pointer-events-none flex-shrink-0 group-hover:opacity-0',
                            selectedFolderId === null ? 'opacity-70' : 'opacity-40'
                          )}
                        >
                          {folderAssetCounts['root'] || 0}
                        </span>
                      )}
                    </div>
                  );
                }

                return (
                  <FolderRow
                    key={folder.id}
                    node={folder}
                    isSelected={folder.id === selectedFolderId}
                    hasChildren={hasChildFolders(folder.id, folders)}
                    isCollapsed={collapsedIds.has(folder.id)}
                    isOver={folder.id === overId}
                    isDragging={folder.id === activeId}
                    isDragActive={activeId !== null}
                    dropPosition={folder.id === overId ? dropPosition : null}
                    assetCount={folderAssetCounts[folder.id] || 0}
                    onSelect={setSelectedFolderId}
                    onToggle={handleToggle}
                    onDelete={handleDeleteFolder}
                    onEdit={handleEditFolder}
                  />
                );
              })}
            </div>
          </div>

          {/* File Grid */}
          <div className="flex-1 py-5 px-6 overflow-y-auto flex flex-col gap-6">
            {/* Breadcrumb */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {searchQuery.trim() ? (
                  <>
                    <span className="text-foreground font-medium">
                      Results for &quot;{searchQuery}&quot;
                    </span>
                    <Icon name="chevronRight" className="size-2.5 opacity-50" />
                    <span className="text-muted-foreground font-medium">
                      {assets.length} {assets.length === 1 ? 'file' : 'files'}
                    </span>
                  </>
                ) : (
                  <>
                    {breadcrumbPath.map((item, index) => (
                      <React.Fragment key={item.id || 'root'}>
                        <button
                          onClick={() => setSelectedFolderId(item.id)}
                          className={cn(
                            'hover:text-foreground transition-colors',
                            index === breadcrumbPath.length - 1 ? 'text-foreground font-medium' : 'cursor-pointer'
                          )}
                        >
                          {item.name}
                        </button>
                        {index < breadcrumbPath.length - 1 && (
                          <Icon name="chevronRight" className="size-2.5 opacity-50" />
                        )}
                      </React.Fragment>
                    ))}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedAssetIds.size > 0 ? (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {selectedAssetIds.size} selected
                    </span>

                    <Button
                      size="xs"
                      variant="secondary"
                      className="px-2!"
                      onClick={() => {
                        setBulkMoveTargetFolderId(selectedFolderId);
                        setShowBulkMoveDialog(true);
                      }}
                    >
                      <Icon name="folder" />
                      Move
                    </Button>

                    <Button
                      size="xs"
                      variant="destructive"
                      className="px-2!"
                      onClick={() => setShowBulkDeleteConfirmDialog(true)}
                    >
                      <Icon name="trash" />
                      Delete
                    </Button>

                    <Button
                      size="xs"
                      variant="secondary"
                      onClick={handleClearSelection}
                    >
                      Deselect all
                    </Button>
                  </>
                ) : (
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={handleSelectAll}
                    disabled={assets.length === 0}
                    className="text-xs"
                  >
                    Select all
                  </Button>
                )}
              </div>
            </div>

            {(searchQuery.trim() ? true : childFolders.length === 0) && assets.length === 0 && currentUploadingAssets.length === 0 ? (
              <div className="flex-1 flex flex-col">
                <div className="flex-1 w-full flex-col flex gap-1 items-center justify-center">
                  <div>
                    No files found
                  </div>
                  <div className="text-muted-foreground">
                    {searchQuery.trim() || selectedCategory !== 'all'
                      ? 'No files were found using the current filters'
                      : selectedFolderId === null
                        ? 'No files'
                        : 'No folders or assets in this folder'}
                  </div>
                </div>
                <div className="flex-1"></div>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-4">
                {/* Display child folders (hide when searching) */}
                {!searchQuery.trim() && childFolders.map((folder) => (
                  <FileGridItem
                    key={folder.id}
                    id={folder.id}
                    name={folder.name}
                    type="folder"
                    onClick={() => {
                      setSelectedFolderId(folder.id);
                      // Auto-expand the folder in the tree
                      setCollapsedIds((prev) => {
                        const next = new Set(prev);
                        next.delete(folder.id);
                        return next;
                      });
                    }}
                    onEdit={() => handleEditFolder(folder.id)}
                    onDelete={() => handleDeleteFolder(folder.id)}
                  />
                ))}

                {/* Display uploading assets */}
                {currentUploadingAssets.map((uploadingAsset) => {
                  // Remove file extension from name
                  const nameWithoutExtension = uploadingAsset.filename.replace(/\.[^/.]+$/, '');

                  return (
                    <FileGridItem
                      key={uploadingAsset.id}
                      id={uploadingAsset.id}
                      name={nameWithoutExtension}
                      type="uploading"
                      file={uploadingAsset.file}
                    />
                  );
                })}

                {/* Display existing assets */}
                {assets.map((asset) => (
                  <FileGridItem
                    key={asset.id}
                    id={asset.id}
                    name={asset.filename}
                    type="asset"
                    mimeType={asset.mime_type}
                    imageUrl={asset.public_url}
                    content={asset.content}
                    onClick={() => onAssetSelect?.(asset)}
                    isSelected={selectedAssetIds.has(asset.id)}
                    onSelectChange={(selected) => handleAssetSelect(asset.id, selected)}
                    onPreview={
                      asset.mime_type?.startsWith('image/') && asset.public_url
                        ? () => handlePreviewAsset(asset.public_url!)
                        : undefined
                    }
                    onEdit={() => handleEditAsset(asset.id)}
                    onDelete={() => handleDeleteAsset(asset.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        </DialogContent>
      </Dialog>

      {/* Create Folder Dialog */}
      <AssetFolderDialog
        open={showCreateFolderDialog}
        onOpenChange={setShowCreateFolderDialog}
        onConfirm={handleCreateFolder}
        mode="create"
        initialParentFolderId={selectedFolderId}
        folders={folders}
      />

      {/* Edit Folder Dialog */}
      <AssetFolderDialog
        open={showEditFolderDialog}
        onOpenChange={setShowEditFolderDialog}
        onConfirm={handleConfirmEdit}
        mode="rename"
        initialName={editFolderName}
        initialParentFolderId={editFolderParentId}
        folders={folders}
        currentFolderId={editingFolderId}
      />

      {/* Delete Folder Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirmDialog}
        onOpenChange={setShowDeleteConfirmDialog}
        title="Delete folder"
        description={(() => {
          if (!deletingFolderId) return 'Are you sure you want to delete this folder?';

          const descendantIds = getDescendantFolderIds(deletingFolderId);
          const assetsCount = storeAssets.filter(asset =>
            asset.asset_folder_id === deletingFolderId ||
            descendantIds.includes(asset.asset_folder_id || '')
          ).length;

          if (descendantIds.length > 0 || assetsCount > 0) {
            const parts = [];
            if (descendantIds.length > 0) {
              parts.push(`${descendantIds.length} subfolder${descendantIds.length > 1 ? 's' : ''}`);
            }
            if (assetsCount > 0) {
              parts.push(`${assetsCount} asset${assetsCount > 1 ? 's' : ''}`);
            }
            return `Are you sure you want to delete this folder and all its contents (${parts.join(' and ')})? This action cannot be undone.`;
          }

          return 'Are you sure you want to delete this folder? This action cannot be undone.';
        })()}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onConfirm={handleConfirmDeleteFolder}
      />

      {/* Delete Asset Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteAssetConfirmDialog}
        onOpenChange={setShowDeleteAssetConfirmDialog}
        title="Delete asset"
        description="Are you sure you want to delete this asset? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onConfirm={handleConfirmDeleteAsset}
      />

      {/* Bulk Delete Assets Confirmation Dialog */}
      <ConfirmDialog
        open={showBulkDeleteConfirmDialog}
        onOpenChange={setShowBulkDeleteConfirmDialog}
        title={`Delete ${selectedAssetIds.size} file${selectedAssetIds.size > 1 ? 's' : ''}`}
        description={`Are you sure you want to delete ${selectedAssetIds.size} file${selectedAssetIds.size > 1 ? 's' : ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        onConfirm={() => {
          handleBulkDelete();
          setShowBulkDeleteConfirmDialog(false);
        }}
      />

      {/* Bulk Move Assets Dialog */}
      <Dialog
        open={showBulkMoveDialog}
        onOpenChange={setShowBulkMoveDialog}
      >
        <DialogContent
          width="320px"
          aria-describedby={undefined}
          className="gap-0"
        >
          <DialogHeader>
            <DialogTitle>Move {selectedAssetIds.size} asset{selectedAssetIds.size > 1 ? 's' : ''}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bulk-move-folder">Folder</Label>
              <Select
                value={bulkMoveTargetFolderId || 'root'}
                onValueChange={(value) => setBulkMoveTargetFolderId(value === 'root' ? null : value)}
              >
                <SelectTrigger id="bulk-move-folder">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">All files</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {buildFolderPath(folder.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="grid grid-cols-2 mt-1">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowBulkMoveDialog(false);
                  setBulkMoveTargetFolderId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  handleBulkMove(bulkMoveTargetFolderId);
                  setBulkMoveTargetFolderId(null);
                }}
              >
                Move
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Asset / Create SVG Dialog */}
      <Dialog
        open={showEditAssetDialog}
        onOpenChange={(open) => {
          setShowEditAssetDialog(open);
          if (!open) {
            setEditAssetContent(null);
            setIsCreateSvgMode(false);
          }
        }}
      >
        <DialogContent
          width="400px" aria-describedby={undefined}
          className="gap-0"
        >
          <DialogHeader>
            <DialogTitle>{isCreateSvgMode ? 'New SVG icon' : 'Edit asset'}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-name">File name</Label>
              <Input
                id="asset-name"
                value={editAssetName}
                onChange={(e) => setEditAssetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isCreateSvgMode && !editAssetContent) {
                    e.preventDefault();
                    handleConfirmEditAsset(editAssetName, editAssetFolderId, editAssetContent);
                    setShowEditAssetDialog(false);
                  }
                }}
                autoFocus
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-folder">Folder</Label>
              <Select
                value={editAssetFolderId || 'root'}
                onValueChange={(value) => setEditAssetFolderId(value === 'root' ? null : value)}
              >
                <SelectTrigger id="asset-folder">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">All files</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {buildFolderPath(folder.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(isCreateSvgMode || editAssetContent !== null) && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="svg-code">SVG code</Label>
                <Textarea
                  id="svg-code"
                  value={editAssetContent || ''}
                  onChange={(e) => setEditAssetContent(e.target.value)}
                  className="font-mono text-xs min-h-[200px] max-h-[400px]"
                  placeholder="<svg>...</svg>"
                  autoComplete="off"
                />
              </div>
            )}

            <DialogFooter className="grid grid-cols-2 mt-1">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowEditAssetDialog(false);
                  setEditAssetContent(null);
                  setIsCreateSvgMode(false);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  handleConfirmEditAsset(editAssetName, editAssetFolderId, editAssetContent);
                  setShowEditAssetDialog(false);
                }}
                disabled={!editAssetName.trim() || (isCreateSvgMode && !editAssetContent?.trim())}
              >
                {isCreateSvgMode ? 'Create' : 'Save'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Drag Overlay - rendered outside Dialog for correct positioning */}
      <DragOverlay dropAnimation={null}>
        {activeId ? (
          <div
            className={cn(
              'flex items-center h-8 rounded-lg px-2 select-none pointer-events-none',
              'bg-primary text-primary-foreground',
              isDropNotAllowed && 'opacity-50'
            )}
          >
            <Icon name="folder" className="size-3 mr-2 opacity-90" />
            <span className="text-xs font-medium">
              {flattenedFolders.find(n => n.id === activeId)?.data.name || 'Folder'}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
