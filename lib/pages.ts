/**
 * Utilities for pages and folders
 */

import type { Page, PageFolder } from '../types';

export interface PageTreeNode {
  id: string;
  type: 'folder' | 'page';
  data: PageFolder | Page;
  children?: PageTreeNode[];
}

export interface FlattenedPageNode {
  id: string;
  type: 'folder' | 'page';
  data: PageFolder | Page;
  depth: number;
  parentId: string | null;
  index: number;
  collapsed?: boolean;
}

/**
 * Find the homepage from a list of pages
 */
export function findHomepage(pages: Page[]): Page | null {
  return pages.find(p => p.is_locked && p.is_index && p.depth === 0) || null;
}

/**
 * Build a tree structure from pages and folders
 */
export function buildPageTree(
  pages: Page[],
  folders: PageFolder[]
): PageTreeNode[] {
  // Create a map of folders by ID for quick lookup
  const folderMap = new Map<string, PageTreeNode>();

  // Initialize folder nodes
  folders.forEach(folder => {
    folderMap.set(folder.id, {
      id: folder.id,
      type: 'folder',
      data: folder,
      children: [],
    });
  });

  // Build folder hierarchy
  const rootFolders: PageTreeNode[] = [];

  folders.forEach(folder => {
    const node = folderMap.get(folder.id)!;

    if (folder.page_folder_id === null) {
      // Root folder
      rootFolders.push(node);
    } else {
      // Child folder
      const parent = folderMap.get(folder.page_folder_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(node);
      }
    }
  });

  // Add pages to appropriate folders or root
  pages.forEach(page => {
    const pageNode: PageTreeNode = {
      id: page.id,
      type: 'page',
      data: page,
    };

    if (page.page_folder_id === null) {
      // Root page
      rootFolders.push(pageNode);
    } else {
      // Page in folder
      const parent = folderMap.get(page.page_folder_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(pageNode);
      } else {
        // Parent folder not found, add to root
        rootFolders.push(pageNode);
      }
    }
  });

  // Sort children by order (for folders) and creation date (for pages)
  const sortChildren = (nodes: PageTreeNode[]) => {
    nodes.sort((a, b) => {
      // Folders before pages
      if (a.type === 'folder' && b.type === 'page') return -1;
      if (a.type === 'page' && b.type === 'folder') return 1;

      // Both folders: sort by order
      if (a.type === 'folder' && b.type === 'folder') {
        const folderA = a.data as PageFolder;
        const folderB = b.data as PageFolder;
        return folderA.order - folderB.order;
      }

      // Both pages: sort by creation date (newest first)
      if (a.type === 'page' && b.type === 'page') {
        const pageA = a.data as Page;
        const pageB = b.data as Page;
        return new Date(pageB.created_at).getTime() - new Date(pageA.created_at).getTime();
      }

      return 0;
    });

    // Recursively sort children
    nodes.forEach(node => {
      if (node.children) {
        sortChildren(node.children);
      }
    });
  };

  sortChildren(rootFolders);

  return rootFolders;
}

/**
 * Flatten a page tree structure into a linear array with depth information
 */
export function flattenPageTree(
  nodes: PageTreeNode[],
  parentId: string | null = null,
  depth: number = 0,
  collapsedIds: Set<string> = new Set()
): FlattenedPageNode[] {
  const flattened: FlattenedPageNode[] = [];

  nodes.forEach((node, index) => {
    const isCollapsed = collapsedIds.has(node.id);

    flattened.push({
      id: node.id,
      type: node.type,
      data: node.data,
      depth,
      parentId,
      index,
      collapsed: isCollapsed,
    });

    // Only flatten children if not collapsed and has children
    if (node.children && node.children.length > 0 && !isCollapsed) {
      flattened.push(
        ...flattenPageTree(node.children, node.id, depth + 1, collapsedIds)
      );
    }
  });

  return flattened;
}

/**
 * Rebuild tree structure after reordering
 */
export function rebuildPageTree(
  flattenedNodes: FlattenedPageNode[],
  movedId: string,
  newParentId: string | null,
  newOrder: number
): PageTreeNode[] {
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
  const byParent = new Map<string | null, FlattenedPageNode[]>();
  nodeCopy.forEach(node => {
    const parent = node.parentId;
    if (!byParent.has(parent)) {
      byParent.set(parent, []);
    }
    byParent.get(parent)!.push(node);
  });

  // Sort each group by index and reassign indices
  byParent.forEach((children, parentId) => {
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

  // Build tree recursively
  function buildNode(nodeId: string): PageTreeNode {
    const node = nodeCopy.find(n => n.id === nodeId)!;
    const childNodes = byParent.get(nodeId) || [];

    const result: PageTreeNode = {
      id: node.id,
      type: node.type,
      data: node.data,
    };

    if (childNodes.length > 0) {
      result.children = childNodes.map(child => buildNode(child.id));
    }

    return result;
  }

  // Build root level
  const rootNodes = byParent.get(null) || [];
  const result = rootNodes.map(node => buildNode(node.id));

  return result;
}

/**
 * Check if a node is a descendant of another
 */
export function isDescendant(
  node: FlattenedPageNode,
  target: FlattenedPageNode,
  allNodes: FlattenedPageNode[]
): boolean {
  if (node.id === target.id) return true;

  const parent = allNodes.find((n) => n.id === target.parentId);
  if (!parent) return false;

  return isDescendant(node, parent, allNodes);
}

