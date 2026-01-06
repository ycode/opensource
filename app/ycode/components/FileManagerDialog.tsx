'use client';

/**
 * File Manager Dialog
 *
 * Dialog for managing files and assets
 */

import React, { useState, useMemo, useCallback } from 'react';
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
import Icon from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { assetFoldersApi, assetsApi, uploadFileApi } from '@/lib/api';
import type { AssetFolder, Asset } from '@/types';
import { getAcceptString, getAssetIcon } from '@/lib/asset-utils';
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

interface FileManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssetSelect?: (asset: Asset) => void;
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

        {/* Options Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div
              className={cn(
                'size-5.75 opacity-0 group-hover:opacity-100 mr-1 p-0.5 rounded-sm backdrop-blur-sm hover:bg-secondary/80 cursor-pointer flex items-center justify-center',
                isSelected && 'hover:bg-primary-foreground/20'
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
  // For assets
  mimeType?: string | null;
  imageUrl?: string;
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
  mimeType,
  imageUrl,
  file,
}: FileGridItemProps) {
  const showMenu = (type === 'folder' || type === 'asset') && (onDelete || onEdit || onPreview);
  const isUploading = type === 'uploading';
  const isImage = type === 'asset' && mimeType?.startsWith('image/') && imageUrl;

  return (
    <div className={cn('flex flex-col gap-1.5', !isUploading && 'group')}>
      <div
        className={cn(
          'relative aspect-square bg-secondary/30 rounded-md overflow-visible flex items-center justify-center',
          !isUploading && 'hover:bg-secondary/60 cursor-pointer',
          isUploading && 'overflow-hidden'
        )}
        onClick={!isUploading ? onClick : undefined}
      >
        {/* Folder Icon */}
        {type === 'folder' && <Icon name="folder" className="size-10 opacity-50" />}

        {/* Asset Content */}
        {type === 'asset' && (
          <>
            {mimeType?.startsWith('image/') && imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="w-full h-full object-contain pointer-events-none rounded-md"
                  src={imageUrl}
                  alt={name}
                />
              </>
            ) : (
              <Icon name={getAssetIcon(mimeType) as any} className="size-10 opacity-50" />
            )}
          </>
        )}

        {/* Uploading Asset Content */}
        {isUploading && file && (
          <>
            {file.type.startsWith('image/') ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="w-full h-full object-contain pointer-events-none opacity-40"
                  src={URL.createObjectURL(file)}
                  alt={name}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-background/20">
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
        )}

        {/* Options Menu */}
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'absolute top-1.5 right-1.5 size-5.75 opacity-0 group-hover:opacity-80 p-0.5 rounded-sm bg-secondary/80 backdrop-blur-sm hover:bg-secondary/80 cursor-pointer flex items-center justify-center'
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
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadingAssets, setUploadingAssets] = useState<Array<{ id: string; filename: string; file: File }>>([]);
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

  // Filter assets by selected folder
  const assets = useMemo(() => {
    const filteredAssets = selectedFolderId === null
      ? storeAssets.filter((asset) => !asset.asset_folder_id)
      : storeAssets.filter((asset) => asset.asset_folder_id === selectedFolderId);

    return filteredAssets;
  }, [storeAssets, selectedFolderId]);

  // Get uploading assets for the current folder
  const currentUploadingAssets = useMemo(() => {
    return uploadingAssets;
  }, [uploadingAssets]);

  // Get child folders for the selected folder
  const childFolders = useMemo(() => {
    return folders.filter((folder) => folder.asset_folder_id === selectedFolderId);
  }, [folders, selectedFolderId]);

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

  // Preview asset (open in new tab)
  const handlePreviewAsset = (imageUrl: string) => {
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
  };

  // Start editing asset
  const handleEditAsset = (id: string) => {
    const asset = storeAssets.find(a => a.id === id);
    if (asset) {
      setEditingAssetId(id);
      setEditAssetName(asset.filename);
      setEditAssetFolderId(asset.asset_folder_id || null);
      setShowEditAssetDialog(true);
    }
  };

  // Confirm asset edit
  const handleConfirmEditAsset = async (newName: string, newFolderId: string | null) => {
    if (!editingAssetId || !newName.trim()) return;

    // Save original asset for rollback
    const originalAsset = storeAssets.find(a => a.id === editingAssetId);
    if (!originalAsset) return;

    try {
      // Build update data
      const updateData: { filename?: string; asset_folder_id?: string | null } = {};
      if (newName !== originalAsset.filename) {
        updateData.filename = newName;
      }
      if (newFolderId !== originalAsset.asset_folder_id) {
        updateData.asset_folder_id = newFolderId;
      }

      // Only update if there are changes
      if (Object.keys(updateData).length === 0) {
        setEditingAssetId(null);
        setEditAssetName('');
        setEditAssetFolderId(null);
        return;
      }

      // Optimistically update in store
      updateAsset(editingAssetId, updateData);
      setEditingAssetId(null);
      setEditAssetName('');
      setEditAssetFolderId(null);

      // Make API call
      const response = await assetsApi.update(editingAssetId, updateData);

      if (response.error) {
        console.error('Failed to update asset:', response.error);
        // Rollback: restore original values
        updateAsset(editingAssetId, originalAsset);
        return;
      }

      if (response.data) {
        // Update with server response to ensure consistency
        updateAsset(editingAssetId, response.data);
      }
    } catch (error) {
      console.error('Failed to update asset:', error);
      // Rollback on error
      updateAsset(editingAssetId, originalAsset);
    }
  };

  // Handle file upload button click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
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
            <Button
              size="sm"
              onClick={handleUploadClick}
              disabled={isUploading}
            >
              <Icon name="upload" className="size-3" />
              Upload
            </Button>
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
            <div className="w-60 border-r h-full overflow-y-auto px-4">
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
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
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
            </div>

            {childFolders.length === 0 && assets.length === 0 && currentUploadingAssets.length === 0 ? (
              <div className="flex items-center justify-center flex-1 text-muted-foreground">
                No folders or assets in this folder
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-4">
                {/* Display child folders */}
                {childFolders.map((folder) => (
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
                    onClick={() => onAssetSelect?.(asset)}
                    onPreview={
                      asset.mime_type?.startsWith('image/') && asset.public_url
                        ? () => handlePreviewAsset(asset.public_url)
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

      {/* Edit Asset Dialog */}
      <Dialog open={showEditAssetDialog} onOpenChange={setShowEditAssetDialog}>
        <DialogContent
          width="400px" aria-describedby={undefined}
          className="gap-0"
        >
          <DialogHeader>
            <DialogTitle>Edit asset</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-name">Asset name</Label>
              <Input
                id="asset-name"
                value={editAssetName}
                onChange={(e) => setEditAssetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmEditAsset(editAssetName, editAssetFolderId);
                    setShowEditAssetDialog(false);
                  }
                }}
                autoFocus
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

            <DialogFooter className="grid grid-cols-2 mt-1">
              <Button
                variant="secondary"
                onClick={() => setShowEditAssetDialog(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  handleConfirmEditAsset(editAssetName, editAssetFolderId);
                  setShowEditAssetDialog(false);
                }}
                disabled={!editAssetName.trim()}
              >
                Save
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
