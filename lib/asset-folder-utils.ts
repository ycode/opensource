/**
 * Asset Folder Tree Utilities
 * Helpers for folder management, hierarchy, and tree operations
 */

import type { AssetFolder } from '@/types';
import {
  flattenTreeByParentRef,
  hasChildren,
  isDescendant,
  buildPath,
  type FlattenedTreeNode,
} from './tree-utilities';

/**
 * Flattened folder node with depth and index information
 * (extends generic FlattenedTreeNode with AssetFolder data)
 */
export type FlattenedAssetFolderNode = FlattenedTreeNode<AssetFolder>;

/**
 * Build a hierarchical folder path string (e.g., "Images / Products / Thumbnails")
 * Uses generic buildPath from tree-utilities
 *
 * @example
 * buildAssetFolderPath(folder, allFolders) // "Images / Products"
 * buildAssetFolderPath(folder, allFolders, true) // ["Images", "Products"]
 */
export function buildAssetFolderPath(
  folder: AssetFolder,
  allFolders: AssetFolder[],
  asArray: boolean = false
): string | string[] {
  return buildPath(
    folder,
    allFolders,
    (f) => f.id,
    (f) => f.asset_folder_id,
    (f) => f.name,
    asArray
  );
}

/**
 * Check if one folder is a descendant of another folder
 * Uses generic isDescendant from tree-utilities
 *
 * @example
 * isDescendantAssetFolder(childId, parentId, allFolders) // true if child is nested under parent
 */
export function isDescendantAssetFolder(
  folderId: string,
  potentialAncestorId: string,
  allFolders: AssetFolder[]
): boolean {
  return isDescendant(
    folderId,
    potentialAncestorId,
    allFolders,
    (f) => f.id,
    (f) => f.asset_folder_id
  );
}

/**
 * Flatten a folder tree structure into a linear array with depth information
 * Uses generic flattenTreeByParentRef from tree-utilities
 *
 * @param folders - Array of all folders
 * @param parentId - Current parent folder ID (null for root)
 * @param collapsedIds - Set of folder IDs that are collapsed
 * @param startDepth - Starting depth (default 0, use 1 if there's a virtual root)
 * @returns Flattened array with depth and index information
 */
export function flattenAssetFolderTree(
  folders: AssetFolder[],
  parentId: string | null = null,
  collapsedIds: Set<string> = new Set(),
  startDepth: number = 0
): FlattenedAssetFolderNode[] {
  return flattenTreeByParentRef(
    folders,
    (f) => f.id,
    (f) => f.asset_folder_id,
    (f) => f.order,
    parentId,
    collapsedIds,
    startDepth
  );
}

/**
 * Check if a folder has any children
 * Uses generic hasChildren from tree-utilities
 *
 * @param folderId - Folder ID to check, or 'root' for root-level folders
 * @param allFolders - Array of all folders
 */
export function hasChildFolders(folderId: string, allFolders: AssetFolder[]): boolean {
  if (folderId === 'root') {
    return allFolders.some(f => f.asset_folder_id === null);
  }
  return hasChildren(folderId, allFolders, (f) => f.asset_folder_id);
}

/**
 * Rebuild folder tree after drag and drop
 * Updates the moved folder's parent and reorders siblings
 *
 * @param flattenedNodes - Current flattened tree
 * @param movedId - ID of the moved folder
 * @param newParentId - New parent folder ID (null for root)
 * @param newOrder - New order index within the parent
 * @returns Array of updated folders
 */
export function rebuildAssetFolderTree(
  flattenedNodes: FlattenedAssetFolderNode[],
  movedId: string,
  newParentId: string | null,
  newOrder: number
): AssetFolder[] {
  // Create a copy of all nodes
  const nodeCopy = flattenedNodes.map(n => ({
    ...n,
    data: { ...n.data }
  }));

  // Find and update the moved node
  const movedNode = nodeCopy.find(n => n.id === movedId);
  if (!movedNode) {
    console.error('❌ REBUILD ERROR: Moved node not found!');
    return [];
  }

  // Update moved node's parent and index
  movedNode.parentId = newParentId;
  movedNode.index = newOrder;

  // Group nodes by parent
  const byParent = new Map<string | null, FlattenedAssetFolderNode[]>();
  nodeCopy.forEach(node => {
    const parent = node.parentId;
    if (!byParent.has(parent)) {
      byParent.set(parent, []);
    }
    byParent.get(parent)!.push(node);
  });

  // Sort each group by index and reassign indices
  byParent.forEach((children) => {
    // Sort by current index first
    children.sort((a, b) => a.index - b.index);

    // If this group contains the moved node, reorder it
    const movedNodeInGroup = children.find(n => n.id === movedId);
    if (movedNodeInGroup) {
      // Remove moved node from its current position
      const movedIndex = children.findIndex(n => n.id === movedId);
      children.splice(movedIndex, 1);

      // Insert at new position
      let insertIndex = 0;
      for (let i = 0; i < children.length; i++) {
        if (children[i].index < newOrder) {
          insertIndex = i + 1;
        } else {
          break;
        }
      }

      children.splice(insertIndex, 0, movedNodeInGroup);
    }

    // Reassign sequential indices
    children.forEach((child, idx) => {
      child.index = idx;
    });
  });

  // Calculate depth for each node based on its parent chain
  const calculateDepth = (nodeId: string, visited = new Set<string>()): number => {
    if (visited.has(nodeId)) {
      console.error('❌ Circular dependency detected in folder tree!');
      return 0;
    }
    visited.add(nodeId);

    const node = nodeCopy.find(n => n.id === nodeId);
    if (!node || !node.parentId) return 0;

    return 1 + calculateDepth(node.parentId, visited);
  };

  // Build the result array with updated folders
  const updatedFolders: AssetFolder[] = nodeCopy.map(node => ({
    ...node.data,
    asset_folder_id: node.parentId,
    order: node.index,
    depth: calculateDepth(node.id),
  }));

  return updatedFolders;
}
