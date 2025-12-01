/**
 * Layer utilities for rendering and manipulation
 */

import { Collection, Component, Layer, FieldVariable, CollectionVariable, CollectionItemWithValues, CollectionField } from '@/types';
import { cn } from '@/lib/utils';
import { iconExists, IconProps } from '@/components/ui/icon';
import { getBlockIcon, getBlockName } from '@/lib/templates/blocks';
import { resolveInlineVariables } from '@/lib/inline-variables';

/**
 * Check if a value is a FieldVariable
 */
export function isFieldVariable(value: any): value is FieldVariable {
  return value && typeof value === 'object' && value.type === 'field' && value.data?.field_id;
}

/**
 * Get collection variable from layer (checks variables first, then fallback)
 */
export function getCollectionVariable(layer: Layer): CollectionVariable | null {
  if (layer.variables?.collection) {
    return layer.variables.collection;
  }

  if (layer.collection?.id) {
    return {
      id: layer.collection.id,
    };
  }

  return null;
}

/**
 * Find a layer by ID in a tree structure
 * Recursively searches through layer tree
 */
export function findLayerById(layers: Layer[], id: string): Layer | null {
  for (const layer of layers) {
    if (layer.id === id) return layer;
    if (layer.children) {
      const found = findLayerById(layer.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Find parent collection layer by traversing up the tree
 * @param layers - Root layers array
 * @param layerId - ID of the layer to start from
 * @returns The nearest parent layer that is a collection layer, or null
 */
export function findParentCollectionLayer(layers: Layer[], layerId: string): Layer | null {
  // Helper to find a layer and its parent chain
  const findLayerWithParents = (layers: Layer[], targetId: string, parent: Layer | null = null): { layer: Layer; parent: Layer | null } | null => {
    for (const layer of layers) {
      if (layer.id === targetId) {
        return { layer, parent };
      }
      if (layer.children) {
        const found = findLayerWithParents(layer.children, targetId, layer);
        if (found) return found;
      }
    }
    return null;
  };

  // Find the target layer and its parent
  const result = findLayerWithParents(layers, layerId);
  if (!result) return null;

  // Traverse up the parent chain looking for a collection layer
  let current = result.parent;
  while (current) {
    // Check if this layer has a collection binding
    const hasCollectionVariable = !!getCollectionVariable(current);

    if (hasCollectionVariable) {
      return current;
    }

    // Move up to the next parent
    const parentResult = findLayerWithParents(layers, current.id);
    current = parentResult ? parentResult.parent : null;
  }

  return null;
}

/**
 * Check if a layer can have editable text content
 * @param layer - Layer to check
 * @returns True if the layer is text-editable
 */
export function isTextEditable(layer: Layer): boolean {
  return layer.formattable ?? false;
}

/**
 * Get the HTML tag name for a layer
 */
export function getHtmlTag(layer: Layer): string {
  // Priority 1: Check settings.tag override
  if (layer.settings?.tag) {
    return layer.settings.tag;
  }

  // Priority 2: Use name property (new system)
  if (layer.name) {
    return layer.name;
  }

  // Default
  return 'div';
}

/**
 * Get classes as string (support both string and array formats)
 * Uses cn() to ensure proper class merging and conflict resolution
 */
export function getClassesString(layer: Layer): string {
  if (Array.isArray(layer.classes)) {
    return cn(...layer.classes);
  }
  return cn(layer.classes || '');
}

/**
 * Get text content (support both text and content properties)
 */
export function getText(layer: Layer): string | undefined {
  const text = layer.text || layer.content;
  // Return only if it's a string (not a FieldVariable)
  return typeof text === 'string' ? text : undefined;
}

/**
 * Get image URL (support both url and src properties)
 */
export function getImageUrl(layer: Layer): string | undefined {
  const url = layer.url || layer.src;
  // Return only if it's a string (not a FieldVariable)
  return typeof url === 'string' ? url : undefined;
}

/**
 * Check if a layer can have children based on its name/type
 */
export function canHaveChildren(layer: Layer): boolean {
  // Component instances cannot have children added to them
  // Children can only be edited in the master component
  if (layer.componentId) {
    return false;
  }

  const blocksWithoutChildren = [
    'icon', 'image', 'audio', 'video', 'youtube', 'iframe',
    'heading', 'p', 'span', 'label', 'button', 'hr',
    'input', 'textarea', 'select', 'checkbox', 'radio',
  ];

  return !blocksWithoutChildren.includes(layer.name ?? '');
}

/**
 * Remove a layer by ID from a tree structure
 * Returns a new array with the layer removed
 */
export function removeLayerById(layers: Layer[], id: string): Layer[] {
  return layers
    .filter(layer => layer.id !== id)
    .map(layer => {
      if (layer.children) {
        return {
          ...layer,
          children: removeLayerById(layer.children, id)
        };
      }
      return layer;
    });
}

/**
 * Resolve field value from collection item data
 * @param fieldVariable - The FieldVariable containing field_id to resolve
 * @param collectionItemData - The collection item with values (field_id -> value)
 * @returns The resolved value or undefined if not found
 */
export function resolveFieldValue(
  fieldVariable: FieldVariable,
  collectionItemData?: Record<string, string>
): string | undefined {
  if (!collectionItemData) {
    return undefined;
  }

  const fieldId = fieldVariable.data.field_id;
  return collectionItemData[fieldId];
}

/**
 * Get text content with field binding resolution
 * If layer.text is a FieldVariable, resolve from collectionItemData
 * Otherwise return static text
 */
export function getTextWithBinding(
  layer: Layer,
  collectionItemData?: Record<string, string>
): string | undefined {
  // Priority 1: Check variables.text (embedded JSON inline variables)
  const textWithVariables = layer.variables?.text;
  if (textWithVariables && typeof textWithVariables === 'string') {
    if (textWithVariables.includes('<ycode-inline-variable>')) {
      if (collectionItemData) {
        const mockItem: any = {
          id: 'temp',
          collection_id: 'temp',
          created_at: '',
          updated_at: '',
          deleted_at: null,
          manual_order: 0,
          is_published: true,
          values: collectionItemData,
        };
        return resolveInlineVariables(textWithVariables, mockItem);
      }
      // No collection data - remove variables
      return textWithVariables.replace(/<ycode-inline-variable>[\s\S]*?<\/ycode-inline-variable>/g, '');
    }
    return textWithVariables;
  }

  // Priority 2: Check if text is a FieldVariable (existing structure)
  const text = layer.text || layer.content;
  if (isFieldVariable(text)) {
    const resolved = resolveFieldValue(text, collectionItemData);
    if (resolved !== undefined) {
      return resolved;
    }
  }

  // Priority 3: Fall back to static text
  return typeof text === 'string' ? text : undefined;
}

/**
 * Get image URL with field binding resolution
 * If layer.url is a FieldVariable, resolve from collectionItemData
 * Otherwise return static URL
 */
export function getImageUrlWithBinding(
  layer: Layer,
  collectionItemData?: Record<string, string>
): string | undefined {
  const url = layer.url || layer.src;

  // Check if url is a FieldVariable
  if (isFieldVariable(url)) {
    const resolved = resolveFieldValue(url, collectionItemData);
    if (resolved !== undefined) {
      return resolved;
    }
  }

  // Fall back to static URL
  return typeof url === 'string' ? url : undefined;
}

/**
 * Sort collection items based on layer sorting settings
 * @param items - Array of collection items to sort
 * @param collectionVariable - Collection variable containing sorting preferences
 * @param fields - Array of collection fields for field-based sorting
 * @returns Sorted array of collection items
 */
export function sortCollectionItems(
  items: CollectionItemWithValues[],
  collectionVariable: CollectionVariable | null,
  fields: CollectionField[]
): CollectionItemWithValues[] {
  // If no collection variable or no items, return as-is
  if (!collectionVariable || items.length === 0) {
    return items;
  }

  const sortBy = collectionVariable.sort_by;
  const sortOrder = collectionVariable.sort_order || 'asc';

  // Create a copy to avoid mutating the original array
  const sortedItems = [...items];

  // No sorting - return database order (as-is)
  if (!sortBy || sortBy === 'none') {
    return sortedItems;
  }

  // Manual sorting - sort by manual_order field
  if (sortBy === 'manual') {
    return sortedItems.sort((a, b) => a.manual_order - b.manual_order);
  }

  // Random sorting - shuffle the array
  if (sortBy === 'random') {
    for (let i = sortedItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sortedItems[i], sortedItems[j]] = [sortedItems[j], sortedItems[i]];
    }
    return sortedItems;
  }

  // Field-based sorting - sortBy is a field ID
  return sortedItems.sort((a, b) => {
    const aValue = a.values[sortBy] || '';
    const bValue = b.values[sortBy] || '';

    // Try to parse as numbers if possible
    const aNum = parseFloat(String(aValue));
    const bNum = parseFloat(String(bValue));

    if (!isNaN(aNum) && !isNaN(bNum)) {
      // Numeric comparison
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    }

    // String comparison
    const comparison = String(aValue).localeCompare(String(bValue));
    return sortOrder === 'asc' ? comparison : -comparison;
  });
}

/**
 * Get the icon name (for `components/ui/Icon.tsx`) for a layer
 */
export function getLayerIcon(
  layer: Layer,
  defaultIcon: IconProps['name'] = 'box'
): IconProps['name'] {
  // Body layers
  if (layer.id === 'body') return 'layout';

  // Component layers
  if (layer.componentId) return 'component';

  // Collection layers
  if (getCollectionVariable(layer)) {
    return 'database';
  }

  // Tag icons ('h1', 'h2', ...)
  if (layer.settings?.tag && iconExists(layer.settings?.tag)) {
    return layer.settings?.tag as IconProps['name'];
  }

  // Based on custom name
  if (layer.customName === 'Container') return 'container';
  if (layer.customName === 'Columns') return 'columns';
  if (layer.customName === 'Rows') return 'rows';
  if (layer.customName === 'Grid') return 'grid';

  // Fallback to block icon (based on name)
  return getBlockIcon(layer.name, defaultIcon);
}

/**
 * Get the label for a layer (for display in the UI)
 */
export function getLayerName(
  layer: Layer,
  context?: {
    component_name?: string | undefined | null,
    collection_name?: string | undefined | null,
  }
): string {
  // Special case for Body layer
  if (layer.id === 'body') {
    return 'Body';
  }

  // Use component name if this is a component instance
  if (layer.componentId) {
    return context?.component_name || 'Component';
  }

  // Use collection name with formatting
  if (getCollectionVariable(layer)) {
    return `Collection${context?.collection_name ? ` (${context.collection_name})` : ''}`;
  }

  // Use custom name if available
  if (layer.customName) {
    return layer.customName;
  }

  return getBlockName(layer.name) || 'Layer';
}

/**
 * Get the HTML tag name for a layer
 */
export function getLayerHtmlTag(layer: Layer): string {
  if (layer.settings?.tag) {
    return layer.settings.tag;
  }

  return layer.name || 'div';
}

/**
 * Apply limit and offset to collection items (after sorting)
 * @param items - Array of collection items
 * @param limit - Maximum number of items to show
 * @param offset - Number of items to skip
 * @returns Filtered array of collection items
 */
export function applyLimitOffset(
  items: CollectionItemWithValues[],
  limit?: number,
  offset?: number
): CollectionItemWithValues[] {
  let result = [...items];

  // Apply offset first (skip items)
  if (offset && offset > 0) {
    result = result.slice(offset);
  }

  // Apply limit (take first N items)
  if (limit && limit > 0) {
    result = result.slice(0, limit);
  }

  return result;
}
