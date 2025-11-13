/**
 * Utilities for pages and folders
 */

import { IconProps } from '@/components/ui/icon';
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
  return pages.find(isHomepage) || null;
}

/**
 * Check if a page is the homepage
 */
export function isHomepage(page: Page): boolean {
  return page.is_index && page.page_folder_id === null;
}

/**
 * Build the full slug path for a page or folder
 * Returns the full URL path starting with "/"
 *
 * @example
 * buildSlugPath(page, folders) // "/products/item-1"
 * buildSlugPath(indexPage, folders) // "/products" (index pages don't have slug)
 * buildSlugPath(folder, folders) // "/products"
 */
export function buildSlugPath(
  item: Page | PageFolder | null,
  allFolders: PageFolder[],
  itemType: 'page' | 'folder'
): string {
  if (!item) return '/';

  const slugParts: string[] = [];

  // Build folder path
  let currentFolderId = item.page_folder_id;
  while (currentFolderId) {
    const folder = allFolders.find(f => f.id === currentFolderId);
    if (!folder) break;
    slugParts.unshift(folder.slug);
    currentFolderId = folder.page_folder_id;
  }

  // Add item's own slug (for folders or non-index pages)
  if (itemType === 'folder') {
    slugParts.push((item as PageFolder).slug);
  } else if (itemType === 'page') {
    const page = item as Page;
    // Index pages don't have their own slug, just the folder path
    if (!page.is_index && page.slug) {
      slugParts.push(page.slug);
    }
  }

  return '/' + slugParts.filter(Boolean).join('/');
}

/**
 * Build a hierarchical folder path string (e.g., "Products / Electronics / Phones")
 * Used for displaying folder paths in UI
 *
 * @example
 * buildFolderPath(folder, allFolders) // "Products / Electronics"
 */
export function buildFolderPath(folder: PageFolder, allFolders: PageFolder[]): string {
  if (!folder.page_folder_id) {
    return folder.name;
  }
  const parent = allFolders.find(f => f.id === folder.page_folder_id);
  if (!parent) {
    return folder.name;
  }
  return `${buildFolderPath(parent, allFolders)} / ${folder.name}`;
}

/**
 * Check if one folder is a descendant of another folder
 *
 * @example
 * isDescendantFolder(childId, parentId, allFolders) // true if child is nested under parent
 */
export function isDescendantFolder(
  folderId: string,
  potentialAncestorId: string,
  allFolders: PageFolder[]
): boolean {
  const targetFolder = allFolders.find(f => f.id === folderId);
  if (!targetFolder || !targetFolder.page_folder_id) return false;
  if (targetFolder.page_folder_id === potentialAncestorId) return true;
  return isDescendantFolder(targetFolder.page_folder_id, potentialAncestorId, allFolders);
}

/**
 * Check if a folder contains an index page
 *
 * @param folderId - The folder ID to check (null for root folder)
 * @param pages - Array of all pages
 * @param excludePageId - Optional page ID to exclude from check (useful when editing a page)
 * @returns true if the folder has an index page
 *
 * @example
 * folderHasIndexPage(folderId, pages) // true if folder has an index page
 * folderHasIndexPage(null, pages) // check if root folder has homepage
 * folderHasIndexPage(folderId, pages, currentPageId) // exclude current page from check
 */
export function folderHasIndexPage(
  folderId: string | null,
  pages: Page[],
  excludePageId?: string
): boolean {
  return pages.some(
    p => p.id !== excludePageId &&
        p.is_index &&
        p.page_folder_id === folderId
  );
}

/**
 * Get all descendant folder IDs for a given folder
 *
 * This function builds a map for efficient lookup and recursively finds
 * all child folders at any depth.
 *
 * @param folderId - The parent folder ID to find descendants for
 * @param allFolders - Array of all folders to search through
 * @returns Array of descendant folder IDs (does not include the parent folder ID)
 *
 * @example
 * const folders = [
 *   { id: 'a', page_folder_id: null },
 *   { id: 'b', page_folder_id: 'a' },
 *   { id: 'c', page_folder_id: 'b' },
 * ];
 * getDescendantFolderIds('a', folders); // Returns: ['b', 'c']
 */
export function getDescendantFolderIds(
  folderId: string,
  allFolders: PageFolder[]
): string[] {
  // Build a map for quick lookup: parentId -> childIds[]
  const foldersByParent = new Map<string, string[]>();
  for (const folder of allFolders) {
    const parentId = folder.page_folder_id || 'root';
    if (!foldersByParent.has(parentId)) {
      foldersByParent.set(parentId, []);
    }
    foldersByParent.get(parentId)!.push(folder.id);
  }

  // Recursively collect all descendant IDs
  const collectDescendants = (parentId: string): string[] => {
    const children = foldersByParent.get(parentId) || [];
    const descendants: string[] = [...children];

    for (const childId of children) {
      descendants.push(...collectDescendants(childId));
    }

    return descendants;
  };

  return collectDescendants(folderId);
}

/**
 * Get icon name based on node type and data
 */
export function getNodeIcon(node: FlattenedPageNode | PageTreeNode): IconProps['name'] {
  if (node.type === 'folder') {
    return 'folder';
  } else {
    return getPageIcon(node.data as Page);
  }
}

/**
 * Get icon name based on node type and data
 */
export function getPageIcon(page: Page): IconProps['name'] {
  return page.is_index ? 'homepage' : 'page';
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

  // Sort children by order for both folders and pages
  const sortChildren = (nodes: PageTreeNode[]) => {
    nodes.sort((a, b) => {
      // Get order values (default to 0 if not set)
      const orderA = a.type === 'folder' ? (a.data as PageFolder).order : (a.data as Page).order;
      const orderB = b.type === 'folder' ? (b.data as PageFolder).order : (b.data as Page).order;

      const finalOrderA = orderA ?? 0;
      const finalOrderB = orderB ?? 0;

      // Sort by order (ascending: 0, 1, 2, 3...)
      return finalOrderA - finalOrderB;
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

/**
 * Generate a URL-safe slug from a name
 * @example generateSlug('About Us') // 'about-us'
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generate a unique page slug, appending -2, -3, etc. if duplicates exist in the same folder
 * @param excludePageId - Optional page ID to exclude when checking duplicates (for editing)
 */
export function generateUniqueSlug(
  baseName: string,
  pages: Page[],
  folderId: string | null = null,
  isPublished: boolean = false,
  excludePageId?: string
): string {
  const baseSlug = generateSlug(baseName);

  if (!baseSlug) return '';

  // Check if base slug exists in the same folder and published state
  const existingSlugs = pages
    .filter(p =>
      p.id !== excludePageId && // Exclude current page if editing
      p.page_folder_id === folderId && // Same folder
      p.is_published === isPublished && // Same published state
      p.error_page === null // Exclude error pages
    )
    .map(p => p.slug.toLowerCase());

  // If base slug is unique, use it
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  // Otherwise, find the next available number
  let counter = 2;
  let uniqueSlug = `${baseSlug}-${counter}`;

  while (existingSlugs.includes(uniqueSlug)) {
    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;
  }

  return uniqueSlug;
}

/**
 * Generate a unique folder slug, appending -2, -3, etc. if duplicates exist in the same parent
 * @param excludeFolderId - Optional folder ID to exclude when checking duplicates (for editing)
 */
export function generateUniqueFolderSlug(
  baseName: string,
  folders: PageFolder[],
  parentFolderId: string | null = null,
  excludeFolderId?: string
): string {
  const baseSlug = generateSlug(baseName);

  if (!baseSlug) return '';

  // Check if base slug exists in the same parent folder
  const existingSlugs = folders
    .filter(f =>
      f.id !== excludeFolderId && // Exclude current folder if editing
      f.page_folder_id === parentFolderId // Same parent folder
    )
    .map(f => f.slug.toLowerCase());

  // If base slug is unique, use it
  if (!existingSlugs.includes(baseSlug)) {
    return baseSlug;
  }

  // Otherwise, find the next available number
  let counter = 2;
  let uniqueSlug = `${baseSlug}-${counter}`;

  while (existingSlugs.includes(uniqueSlug)) {
    counter++;
    uniqueSlug = `${baseSlug}-${counter}`;
  }

  return uniqueSlug;
}

/**
 * Find the highest number in names matching "Prefix N" pattern and return next number
 * @example getNextNumberFromNames([{ name: 'Page 5' }], 'Page') // 6
 */
export function getNextNumberFromNames(
  items: Array<{ name: string }>,
  prefix: string
): number {
  // Extract numbers from names that match the pattern "Prefix N"
  const numbers = items
    .map(item => {
      const match = item.name.match(new RegExp(`^${prefix}\\s+(\\d+)$`, 'i'));
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(num => num > 0);

  // If no numbered items exist, start at 1
  if (numbers.length === 0) {
    return 1;
  }

  // Return the highest number + 1
  return Math.max(...numbers) + 1;
}

/**
 * Determine where to place a new item based on current selection
 * Folder selected: place inside. Page selected: place at same level. Nothing: place at root.
 */
export function getParentContextFromSelection(
  selectedItemId: string | null,
  pages: Page[],
  folders: PageFolder[]
): { parentFolderId: string | null; newDepth: number } {
  let parentFolderId: string | null = null;
  let newDepth = 0;

  if (selectedItemId) {
    // Check if selected item is a folder
    const selectedFolder = folders.find(f => f.id === selectedItemId);
    if (selectedFolder) {
      // Add inside the folder
      parentFolderId = selectedFolder.id;
      newDepth = selectedFolder.depth + 1;
    } else {
      // Selected item is a page - add at the same level
      const selectedPage = pages.find(p => p.id === selectedItemId);
      if (selectedPage) {
        parentFolderId = selectedPage.page_folder_id;
        newDepth = selectedPage.depth;
      }
    }
  }

  return { parentFolderId, newDepth };
}

/**
 * Calculate the next order value for a new item (max order of siblings + 1)
 */
export function calculateNextOrder(
  parentFolderId: string | null,
  depth: number,
  pages: Page[],
  folders: PageFolder[]
): number {
  const siblingPages = pages.filter(p => p.page_folder_id === parentFolderId && p.depth === depth);
  const siblingFolders = folders.filter(f => f.page_folder_id === parentFolderId && f.depth === depth);
  const maxPageOrder = siblingPages.length > 0 ? Math.max(...siblingPages.map(p => p.order || 0)) : -1;
  const maxFolderOrder = siblingFolders.length > 0 ? Math.max(...siblingFolders.map(f => f.order || 0)) : -1;
  return Math.max(maxPageOrder, maxFolderOrder) + 1;
}
