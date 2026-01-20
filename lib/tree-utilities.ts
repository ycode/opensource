import type { Layer, Breakpoint } from '../types';
import { canHaveChildren } from './layer-utils';
import { getBreakpointPrefix } from './breakpoint-utils';

export interface FlattenedItem {
  id: string;
  layer: Layer;
  depth: number;
  parentId: string | null;
  index: number;
  collapsed?: boolean;
  canHaveChildren: boolean;
}

/**
 * Generic flattened tree node (for any tree structure)
 */
export interface FlattenedTreeNode<T> {
  id: string;
  data: T;
  depth: number;
  parentId: string | null;
  index: number;
}

/**
 * Get the CSS order value from a layer's classes for a specific breakpoint
 * Handles CSS cascade: mobile inherits from tablet if no mobile-specific override
 * 
 * Desktop-first cascade:
 * - Desktop: no order classes apply
 * - Tablet: max-lg:order-* applies
 * - Mobile: max-md:order-* applies, OR falls back to max-lg:order-*
 * 
 * Returns null if no order class is found
 */
function getOrderValueForBreakpoint(layer: Layer, breakpoint: Breakpoint): number | null {
  if (breakpoint === 'desktop') return null;
  
  const classes = Array.isArray(layer.classes) ? layer.classes.join(' ') : (layer.classes || '');
  
  if (breakpoint === 'mobile') {
    // First check for mobile-specific order (max-md:)
    const mobileRegex = /max-md\:order-(\d+)/;
    const mobileMatch = classes.match(mobileRegex);
    if (mobileMatch) {
      return parseInt(mobileMatch[1], 10);
    }
    
    // Fall back to tablet order (max-lg:) which also applies to mobile
    const tabletRegex = /max-lg\:order-(\d+)/;
    const tabletMatch = classes.match(tabletRegex);
    if (tabletMatch) {
      return parseInt(tabletMatch[1], 10);
    }
    
    return null;
  }
  
  // Tablet breakpoint - only check max-lg:
  const prefix = getBreakpointPrefix(breakpoint);
  const regex = new RegExp(`${prefix.replace(':', '\\:')}order-(\\d+)`);
  const match = classes.match(regex);
  
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Check if any layer has an order class for the given breakpoint
 * For mobile, also checks tablet classes (due to CSS cascade)
 */
function hasAnyOrderClassForBreakpoint(layers: Layer[], breakpoint: Breakpoint): boolean {
  if (breakpoint === 'desktop') return false;
  
  return layers.some(layer => {
    const classes = Array.isArray(layer.classes) ? layer.classes.join(' ') : (layer.classes || '');
    
    if (breakpoint === 'mobile') {
      // Check both mobile and tablet (tablet cascades to mobile)
      return /max-md\:order-\d+/.test(classes) || /max-lg\:order-\d+/.test(classes);
    }
    
    // Tablet - only check max-lg:
    return /max-lg\:order-\d+/.test(classes);
  });
}

/**
 * Sort layers by their CSS order value for the given breakpoint
 * Layers without order classes maintain their DOM position relative to each other
 */
function sortByOrderClass(layers: Layer[], breakpoint: Breakpoint): Layer[] {
  if (breakpoint === 'desktop') return layers;
  
  // Check if any layer has an order class (including cascade)
  if (!hasAnyOrderClassForBreakpoint(layers, breakpoint)) return layers;
  
  // Sort by order value, maintaining DOM order for items with same/no order
  return [...layers].sort((a, b) => {
    const orderA = getOrderValueForBreakpoint(a, breakpoint);
    const orderB = getOrderValueForBreakpoint(b, breakpoint);
    
    // Both have order values - sort by order
    if (orderA !== null && orderB !== null) {
      return orderA - orderB;
    }
    
    // Only one has order - items without order default to 0
    if (orderA !== null && orderB === null) {
      return orderA - 0; // Compare with implicit 0
    }
    if (orderA === null && orderB !== null) {
      return 0 - orderB; // Compare with implicit 0
    }
    
    // Neither has order - maintain DOM order (return 0 for stable sort)
    return 0;
  });
}

/**
 * Flatten a tree structure into a linear array with depth information
 * Supports both 'children' and 'items' properties for nested layers
 * 
 * @param items - The layer tree to flatten
 * @param parentId - The parent ID (for recursion)
 * @param depth - Current depth (for recursion)
 * @param collapsedIds - Set of collapsed layer IDs
 * @param breakpoint - Active breakpoint for visual order sorting
 */
export function flattenTree(
  items: Layer[],
  parentId: string | null = null,
  depth: number = 0,
  collapsedIds: Set<string> = new Set(),
  breakpoint: Breakpoint = 'desktop'
): FlattenedItem[] {
  const flattened: FlattenedItem[] = [];
  
  // Sort items by CSS order for responsive breakpoints
  const sortedItems = sortByOrderClass(items, breakpoint);

  sortedItems.forEach((item, index) => {
    const isCollapsed = collapsedIds.has(item.id);

    flattened.push({
      id: item.id,
      layer: item,
      depth,
      parentId,
      index,
      collapsed: isCollapsed,
      canHaveChildren: canHaveChildren(item),
    });

    // Only flatten children if not collapsed
    if (item.children && item.children.length > 0 && !isCollapsed) {
      flattened.push(
        ...flattenTree(item.children, item.id, depth + 1, collapsedIds, breakpoint)
      );
    }
  });

  return flattened;
}

/**
 * Get the maximum depth a layer can be moved to (for containers only)
 * Unlimited nesting support - containers can nest infinitely
 */
function getMaxDepth(layer: Layer): number {
  // Elements that cannot have children
  if (!canHaveChildren(layer)) {
    return 0;
  }

  // Allow unlimited nesting for containers
  if (!layer.children || layer.children.length === 0) {
    return Number.MAX_SAFE_INTEGER; // No limit
  }

  return 1 + Math.max(...layer.children.map(getMaxDepth));
}

/**
 * Get the minimum depth considering parent constraints
 */
function getMinDepth(item: FlattenedItem, flattenedItems: FlattenedItem[]): number {
  const itemIndex = flattenedItems.findIndex((i) => i.id === item.id);

  if (itemIndex === 0) {
    return 0;
  }

  const previousItem = flattenedItems[itemIndex - 1];

  // Can be at same level as previous
  let minDepth = previousItem.depth;

  // Or one level deeper if previous can have children
  if (canHaveChildren(previousItem.layer)) {
    minDepth = previousItem.depth + 1;
  }

  return minDepth;
}

/**
 * Project where an item will be dropped during drag
 */
export function getProjection(
  items: FlattenedItem[],
  activeId: string,
  overId: string,
  dragDepth: number
): {
  depth: number;
  maxDepth: number;
  minDepth: number;
  parentId: string | null;
} | null {
  const overItemIndex = items.findIndex((item) => item.id === overId);
  const activeItemIndex = items.findIndex((item) => item.id === activeId);

  if (overItemIndex === -1 || activeItemIndex === -1) {
    return null;
  }

  const activeItem = items[activeItemIndex];
  const overItem = items[overItemIndex];

  // Calculate depth constraints
  const maxDepth = getMaxDepth(activeItem.layer);
  const minDepth = 0; // Can always go to root

  // Calculate new depth based on drag offset
  let depth = overItem.depth + dragDepth;

  // Special case: if dragging right (dragDepth > 0) over a layer that can have children, drop INTO it
  if (dragDepth > 0 && canHaveChildren(overItem.layer)) {
    depth = overItem.depth + 1;
  }

  // Constrain depth
  depth = Math.max(minDepth, depth);

  // Find parent based on depth
  let parentId: string | null = null;

  if (depth > 0) {
    // If dragging into the overItem itself (it can have children)
    if (dragDepth > 0 && canHaveChildren(overItem.layer) && depth === overItem.depth + 1) {
      parentId = overItem.id;
    } else {
      // Look backwards to find parent at depth - 1
      for (let i = overItemIndex; i >= 0; i--) {
        if (items[i].depth === depth - 1) {
          // Only allow parents that can have children
          if (canHaveChildren(items[i].layer)) {
            parentId = items[i].id;
          }
          break;
        }
      }
    }
  }

  return {
    depth,
    maxDepth,
    minDepth,
    parentId,
  };
}

/**
 * Find the index where an item should be inserted
 */
export function findInsertionIndex(
  items: FlattenedItem[],
  activeId: string,
  overId: string,
  projection: { parentId: string | null; depth: number }
): number {
  const overIndex = items.findIndex((item) => item.id === overId);

  if (overIndex === -1) {
    return items.length;
  }

  const { parentId, depth } = projection;

  // Find the insertion point considering the depth
  let insertIndex = overIndex;

  // If dropping at a different depth, adjust insertion point
  if (depth !== items[overIndex].depth) {
    // Find next item at same or shallower depth
    for (let i = overIndex + 1; i < items.length; i++) {
      if (items[i].depth <= depth) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }
  }

  // Find relative index within parent
  const itemsWithSameParent = items.filter((item) => item.parentId === parentId);
  const relativeIndex = itemsWithSameParent.findIndex((item) => {
    const itemIndex = items.findIndex((i) => i.id === item.id);
    return itemIndex >= insertIndex;
  });

  return relativeIndex === -1 ? itemsWithSameParent.length : relativeIndex;
}

/**
 * Remove an item from the tree
 */
export function removeItem(items: Layer[], id: string): Layer[] {
  return items
    .filter((item) => item.id !== id)
    .map((item) => {
      if (!item.children) return item;

      return { ...item, children: removeItem(item.children, id) };
    });
}

/**
 * Insert an item at a specific position in the tree
 */
export function insertItem(
  items: Layer[],
  item: Layer,
  parentId: string | null,
  index: number
): Layer[] {
  if (parentId === null) {
    // Insert at root level
    const newItems = [...items];
    newItems.splice(index, 0, item);
    return newItems;
  }

  // Insert as child of parent
  return items.map((i) => {
    if (i.id === parentId) {
      const children = [...(i.children || [])];
      children.splice(index, 0, item);
      return { ...i, children };
    }

    if (i.children) {
      return { ...i, children: insertItem(i.children, item, parentId, index) };
    }

    return i;
  });
}

/**
 * Move an item from one position to another in the tree
 */
export function moveItem(
  items: Layer[],
  activeId: string,
  overId: string,
  projection: { parentId: string | null; depth: number },
  flattenedItems: FlattenedItem[]
): Layer[] {
  // Find the active item
  const activeItem = flattenedItems.find((item) => item.id === activeId);
  if (!activeItem) return items;

  // Calculate insertion index
  const insertionIndex = findInsertionIndex(
    flattenedItems,
    activeId,
    overId,
    projection
  );

  // Remove item from tree
  const withoutActive = removeItem(items, activeId);

  // Insert at new position
  return insertItem(
    withoutActive,
    activeItem.layer,
    projection.parentId,
    insertionIndex
  );
}

// ==========================================
// Generic Tree Utilities (for flat parent-reference trees)
// ==========================================

/**
 * Flatten a tree structure where items reference their parent via a parentKey
 * This works with flat arrays where items have a parent reference (e.g., asset_folder_id, page_folder_id)
 *
 * @param items - Flat array of items
 * @param getId - Function to get item ID
 * @param getParentId - Function to get parent ID (returns null for root items)
 * @param getOrder - Function to get sort order
 * @param parentId - Current parent ID to filter by (null for root)
 * @param collapsedIds - Set of collapsed item IDs
 * @returns Flattened array with depth and index information
 */
export function flattenTreeByParentRef<T extends { id?: string }>(
  items: T[],
  getId: (item: T) => string,
  getParentId: (item: T) => string | null,
  getOrder: (item: T) => number,
  parentId: string | null = null,
  collapsedIds: Set<string> = new Set(),
  startDepth: number = 0
): FlattenedTreeNode<T>[] {
  const buildTree = (currentParentId: string | null, depth: number = startDepth): FlattenedTreeNode<T>[] => {
    const children = items
      .filter(item => getParentId(item) === currentParentId)
      .sort((a, b) => getOrder(a) - getOrder(b));

    const result: FlattenedTreeNode<T>[] = [];

    children.forEach((item, index) => {
      const itemId = getId(item);

      result.push({
        id: itemId,
        data: item,
        depth,
        parentId: currentParentId,
        index,
      });

      // Add children if not collapsed
      if (!collapsedIds.has(itemId)) {
        result.push(...buildTree(itemId, depth + 1));
      }
    });

    return result;
  };

  return buildTree(parentId, startDepth);
}

/**
 * Check if an item has children in a parent-reference tree
 */
export function hasChildren<T>(
  itemId: string,
  items: T[],
  getParentId: (item: T) => string | null
): boolean {
  return items.some(item => getParentId(item) === itemId);
}

/**
 * Check if one item is a descendant of another in a parent-reference tree
 */
export function isDescendant<T>(
  itemId: string,
  potentialAncestorId: string,
  items: T[],
  getId: (item: T) => string,
  getParentId: (item: T) => string | null
): boolean {
  const item = items.find(i => getId(i) === itemId);
  if (!item) return false;

  const parentId = getParentId(item);
  if (!parentId) return false;
  if (parentId === potentialAncestorId) return true;

  return isDescendant(parentId, potentialAncestorId, items, getId, getParentId);
}

/**
 * Build a hierarchical path string for an item
 */
export function buildPath<T>(
  item: T,
  items: T[],
  getId: (item: T) => string,
  getParentId: (item: T) => string | null,
  getName: (item: T) => string,
  asArray: boolean = false
): string | string[] {
  const parentId = getParentId(item);
  const itemName = getName(item);

  if (!parentId) {
    return asArray ? [itemName] : itemName;
  }

  const parent = items.find(i => getId(i) === parentId);
  if (!parent) {
    return asArray ? [itemName] : itemName;
  }

  if (asArray) {
    const parentPath = buildPath(parent, items, getId, getParentId, getName, true) as string[];
    return [...parentPath, itemName];
  }

  return `${buildPath(parent, items, getId, getParentId, getName)} / ${itemName}`;
}
