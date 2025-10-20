import type { Layer } from '../types';

export interface FlattenedItem {
  id: string;
  layer: Layer;
  depth: number;
  parentId: string | null;
  index: number;
  collapsed?: boolean;
}

/**
 * Flatten a tree structure into a linear array with depth information
 */
export function flattenTree(
  items: Layer[],
  parentId: string | null = null,
  depth: number = 0,
  collapsedIds: Set<string> = new Set()
): FlattenedItem[] {
  const flattened: FlattenedItem[] = [];

  items.forEach((item, index) => {
    const isCollapsed = collapsedIds.has(item.id);
    
    flattened.push({
      id: item.id,
      layer: item,
      depth,
      parentId,
      index,
      collapsed: isCollapsed,
    });

    // Only flatten children if not collapsed
    if (item.children && item.children.length > 0 && !isCollapsed) {
      flattened.push(
        ...flattenTree(item.children, item.id, depth + 1, collapsedIds)
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
  // Non-containers cannot have children
  if (layer.type !== 'container') {
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
  
  // Or one level deeper if previous is a container
  if (previousItem.layer.type === 'container') {
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
  
  // Special case: if dragging right (dragDepth > 0) over a container, drop INTO it
  if (dragDepth > 0 && overItem.layer.type === 'container') {
    depth = overItem.depth + 1;
  }
  
  // Constrain depth
  depth = Math.max(minDepth, depth);
  
  // Find parent based on depth
  let parentId: string | null = null;
  
  if (depth > 0) {
    // If dragging into the overItem itself (it's a container)
    if (dragDepth > 0 && overItem.layer.type === 'container' && depth === overItem.depth + 1) {
      parentId = overItem.id;
    } else {
      // Look backwards to find parent at depth - 1
      for (let i = overItemIndex; i >= 0; i--) {
        if (items[i].depth === depth - 1) {
          // Only allow container parents
          if (items[i].layer.type === 'container') {
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
    .map((item) => ({
      ...item,
      children: item.children ? removeItem(item.children, id) : undefined,
    }));
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
      const children = i.children ? [...i.children] : [];
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

