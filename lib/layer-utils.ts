/**
 * Layer utilities for rendering and manipulation
 */

import { Layer, FieldVariable, CollectionVariable, CollectionItemWithValues, CollectionField } from '@/types';
import { cn, generateId } from '@/lib/utils';
import { iconExists, IconProps } from '@/components/ui/icon';
import { getBlockIcon, getBlockName } from '@/lib/templates/blocks';
import { resolveInlineVariables } from '@/lib/inline-variables';
import { isTiptapContent, tiptapToPlainText, renderTiptapToHtml } from '@/lib/tiptap-utils';

/**
 * Check if a value is a FieldVariable
 */
export function isFieldVariable(value: any): value is FieldVariable {
  return value && typeof value === 'object' && value.type === 'field' && value.data?.field_id;
}

/**
 * Check if a layer can be copied based on its restrictions
 */
export function canCopyLayer(layer: Layer): boolean {
  return layer.restrictions?.copy !== false;
}

/**
 * Check if a layer can be deleted based on its restrictions
 */
export function canDeleteLayer(layer: Layer): boolean {
  return layer.restrictions?.delete !== false;
}

/**
 * Get the ancestor layer matching a callback condition
 * Traverses up the tree from the given layer until a matching ancestor is found
 * Uses a flat map for efficient O(1) parent lookups
 */
export function findAncestor(
  layers: Layer[],
  layerId: string,
  predicate: (layer: Layer) => boolean
): Layer | null {
  // Build flat maps for efficient lookups
  const layerMap = new Map<string, Layer>();
  const parentMap = new Map<string, string>();

  const buildMaps = (nodes: Layer[], parentId: string | null = null) => {
    for (const node of nodes) {
      layerMap.set(node.id, node);
      if (parentId) {
        parentMap.set(node.id, parentId);
      }
      if (node.children) {
        buildMaps(node.children, node.id);
      }
    }
  };

  buildMaps(layers);

  // Check if the layer exists
  const currentLayer = layerMap.get(layerId);
  if (!currentLayer) return null;

  // Traverse up the tree using the parent map
  let parentId = parentMap.get(layerId);
  while (parentId) {
    const parent = layerMap.get(parentId);
    if (parent && predicate(parent)) {
      return parent;
    }
    parentId = parentMap.get(parentId);
  }

  return null;
}

/**
 * Find the ancestor layer with a specific name
 */
export function findAncestorByName(layers: Layer[], layerId: string, ancestorName: string): Layer | null {
  return findAncestor(layers, layerId, (layer) => layer.name === ancestorName);
}

/**
 * Check if a layer can be moved to a new parent based on ancestor restrictions
 */
export function canMoveLayer(layers: Layer[], layerId: string, newParentId: string | null): boolean {
  const layer = findLayerById(layers, layerId);
  if (!layer) return false;

  // No ancestor restriction - can move anywhere
  if (!layer.restrictions?.ancestor) return true;

  const requiredAncestor = layer.restrictions.ancestor;

  // Find current ancestor with the required name
  const currentAncestor = findAncestorByName(layers, layerId, requiredAncestor);

  // If moving to root (newParentId is null), check if we need an ancestor
  if (newParentId === null) {
    // Can only move to root if no ancestor is required
    return !currentAncestor;
  }

  // Find the ancestor in the new location
  const newParent = findLayerById(layers, newParentId);
  if (!newParent) return false;

  // Check if new parent is the required ancestor
  if (newParent.name === requiredAncestor) {
    return true;
  }

  // Check if new parent is a descendant of the required ancestor
  const newParentAncestor = findAncestorByName(layers, newParentId, requiredAncestor);

  // Can move if both current and new location share the same ancestor
  return currentAncestor?.id === newParentAncestor?.id;
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
 * Helper to find a layer and its parent
 * @param layers - Root layers array
 * @param targetId - ID of the layer to find
 * @param parent - Current parent (for recursion)
 * @returns Object with layer and its parent, or null if not found
 */
export function findLayerWithParent(layers: Layer[], targetId: string, parent: Layer | null = null): { layer: Layer; parent: Layer | null } | null {
  for (const layer of layers) {
    if (layer.id === targetId) {
      return { layer, parent };
    }
    if (layer.children) {
      const found = findLayerWithParent(layer.children, targetId, layer);
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
  return layer.restrictions?.editText ?? false;
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
 * Get text content from layer (from variables.text)
 * Converts Tiptap JSON to plain text if needed
 */
export function getText(layer: Layer): string | undefined {
  const textVariable = layer.variables?.text;
  if (textVariable && textVariable.type === 'dynamic_text') {
    const content = textVariable.data.content;
    // Handle Tiptap JSON content
    if (isTiptapContent(content)) {
      return tiptapToPlainText(content);
    }
    // Handle string content
    if (typeof content === 'string') {
      return content;
    }
  }
  return undefined;
}

/**
 * Check if a layer can have children based on its name/type
 */
export function canHaveChildren(layer: Layer, childLayerType?: string): boolean {
  // Component instances cannot have children added to them
  // Children can only be edited in the master component
  if (layer.componentId) {
    return false;
  }

  const blocksWithoutChildren = [
    'icon', 'image', 'audio', 'video', 'iframe',
    'heading', 'p', 'span', 'label', 'hr',
    'input', 'textarea', 'select', 'checkbox', 'radio',
  ];

  // Sections cannot contain other sections
  if (layer.name === 'section' && childLayerType === 'section') {
    return false;
  }

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
  if (!fieldId) {
    return undefined;
  }
  return collectionItemData[fieldId];
}

/**
 * Get text content with field binding resolution
 * Uses variables.text (DynamicTextVariable) with inline variables
 * Handles both Tiptap JSON and legacy string formats
 */
export function getTextWithBinding(
  layer: Layer,
  collectionItemData?: Record<string, string>
): string | undefined {
  const textVariable = layer.variables?.text;
  if (textVariable && textVariable.type === 'dynamic_text') {
    const content = textVariable.data.content;

    // Handle Tiptap JSON content - render to HTML with resolved variables and textStyles
    if (isTiptapContent(content)) {
      return renderTiptapToHtml(content, collectionItemData, layer.textStyles);
    }

    // Handle legacy string format
    if (typeof content === 'string') {
      if (content.includes('<ycode-inline-variable>')) {
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
          return resolveInlineVariables(content, mockItem);
        }
        // No collection data - remove variables
        return content.replace(/<ycode-inline-variable>[\s\S]*?<\/ycode-inline-variable>/g, '');
      }
      return content;
    }
  }

  return undefined;
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
  // Body layer should render as div (actual <body> is managed by Next.js)
  if (layer.id === 'body' || layer.name === 'body') {
    return 'div';
  }

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

/**
 * Check if layer has only a single inline variable (and optional whitespace)
 * Used to determine if double-click should open collection item editor
 * @param layer - Layer to check
 * @returns True if layer has exactly one inline variable and no other text
 */
export function hasSingleInlineVariable(layer: Layer): boolean {
  const textVariable = layer.variables?.text;

  if (!textVariable || textVariable.type !== 'dynamic_text') {
    return false;
  }

  const content = textVariable.data.content;

  // Handle Tiptap JSON content
  if (isTiptapContent(content)) {
    // Check if content has exactly one dynamicVariable node and no other text
    let variableCount = 0;
    let hasOtherContent = false;

    function checkNode(node: any) {
      if (node.type === 'dynamicVariable') {
        variableCount++;
      } else if (node.type === 'text' && node.text?.trim()) {
        hasOtherContent = true;
      }
      if (node.content) {
        node.content.forEach(checkNode);
      }
    }

    if (content.content) {
      content.content.forEach(checkNode);
    }

    return variableCount === 1 && !hasOtherContent;
  }

  // Handle legacy string format
  if (typeof content !== 'string') {
    return false;
  }

  // Match all inline variable tags
  const regex = /<ycode-inline-variable>[\s\S]*?<\/ycode-inline-variable>/g;
  const matches = content.match(regex);

  if (!matches || matches.length !== 1) {
    return false; // Not exactly one variable
  }

  // Remove the variable tag and check if only whitespace remains
  const withoutVariable = content.replace(regex, '').trim();
  return withoutVariable === '';
}

/**
 * Regenerate interaction and tween IDs, and optionally remap layer_id references
 * @param interactions - Array of interactions to process
 * @param layerIdMap - Optional map of old layer IDs to new layer IDs for remapping
 * @returns New array of interactions with regenerated IDs
 */
export function regenerateInteractionIds(
  interactions: Layer['interactions'],
  layerIdMap?: Map<string, string>
): Layer['interactions'] {
  if (!interactions || interactions.length === 0) return interactions;

  return interactions.map(interaction => ({
    ...interaction,
    id: generateId('int'), // Regenerate interaction ID
    tweens: interaction.tweens.map(tween => ({
      ...tween,
      id: generateId('twn'), // Regenerate tween ID
      layer_id: layerIdMap?.has(tween.layer_id)
        ? layerIdMap.get(tween.layer_id)!
        : tween.layer_id, // Keep external layer references unchanged
    })),
  }));
}

/**
 * Regenerate layer IDs, interaction IDs, tween IDs, and remap self-targeted interactions
 * When duplicating/pasting layers, all IDs must be regenerated to avoid conflicts
 */
export function regenerateIdsWithInteractionRemapping(layer: Layer): Layer {
  // Track old layer ID -> new layer ID mapping
  const idMap = new Map<string, string>();

  // First pass: generate new layer IDs and build mapping
  const generateNewIds = (l: Layer): Layer => {
    const newId = generateId('lyr');
    idMap.set(l.id, newId);

    return {
      ...l,
      id: newId,
      children: l.children?.map(generateNewIds),
    };
  };

  const layerWithNewIds = generateNewIds(layer);

  // Second pass: regenerate interaction/tween IDs and remap layer_id references
  const remapInteractions = (l: Layer): Layer => {
    let updatedLayer = l;

    // If layer has interactions, regenerate IDs and remap tween layer_ids
    if (l.interactions && l.interactions.length > 0) {
      updatedLayer = {
        ...updatedLayer,
        interactions: regenerateInteractionIds(l.interactions, idMap),
      };
    }

    // Recursively process children
    if (updatedLayer.children) {
      updatedLayer = {
        ...updatedLayer,
        children: updatedLayer.children.map(remapInteractions),
      };
    }

    return updatedLayer;
  };

  return remapInteractions(layerWithNewIds);
}

/**
 * Collection layer info for conditional visibility
 */
export interface CollectionLayerInfo {
  layerId: string;
  layerName: string;
  collectionId: string;
}

/**
 * Find all collection layers in a layer tree
 * Used for page collections dropdown in conditional visibility
 * Only finds top-level collection layers (direct layers bound to CMS collections),
 * not nested ones or reference field collections.
 * @param layers - Root layers array
 * @param topLevelOnly - If true, only returns the first collection layer found in each branch
 * @returns Array of collection layer info
 */
export function findAllCollectionLayers(layers: Layer[], topLevelOnly: boolean = true): CollectionLayerInfo[] {
  const result: CollectionLayerInfo[] = [];

  const traverse = (layerList: Layer[], foundCollectionInBranch: boolean = false) => {
    for (const layer of layerList) {
      const collectionVariable = getCollectionVariable(layer);

      // If this layer is a collection layer
      if (collectionVariable) {
        // Only add if we haven't found a collection parent in this branch (for topLevelOnly mode)
        if (!topLevelOnly || !foundCollectionInBranch) {
          // Use customName if set, otherwise fallback to 'Collection'
          // Don't use layer.name as it's just the element type (e.g., 'div', 'section')
          result.push({
            layerId: layer.id,
            layerName: layer.customName || 'Collection',
            collectionId: collectionVariable.id,
          });
        }
        // Continue traversing children, but mark that we've found a collection in this branch
        if (layer.children) {
          traverse(layer.children, true);
        }
      } else {
        // Not a collection layer, continue traversing
        if (layer.children) {
          traverse(layer.children, foundCollectionInBranch);
        }
      }
    }
  };

  traverse(layers);
  return result;
}

/**
 * Context for evaluating visibility conditions
 */
export interface VisibilityContext {
  /** Field values from parent collection item (field_id -> value) */
  collectionItemData?: Record<string, string>;
  /** Item counts for each collection layer on the page (layerId -> count) */
  pageCollectionCounts?: Record<string, number>;
  /** Field definitions for type-aware comparison */
  collectionFields?: CollectionField[];
}

/**
 * Evaluate a single visibility condition
 * @param condition - The condition to evaluate
 * @param context - The context containing field values and collection counts
 * @returns True if condition is met, false otherwise
 */
function evaluateCondition(
  condition: import('@/types').VisibilityCondition,
  context: VisibilityContext
): boolean {
  const { collectionItemData, pageCollectionCounts, collectionFields } = context;

  if (condition.source === 'page_collection') {
    // Page collection conditions
    const count = pageCollectionCounts?.[condition.collectionLayerId || ''] ?? 0;

    switch (condition.operator) {
      case 'has_items':
        return count > 0;
      case 'has_no_items':
        return count === 0;
      case 'item_count': {
        const compareValue = condition.compareValue ?? 0;
        const compareOp = condition.compareOperator ?? 'eq';
        switch (compareOp) {
          case 'eq': return count === compareValue;
          case 'lt': return count < compareValue;
          case 'lte': return count <= compareValue;
          case 'gt': return count > compareValue;
          case 'gte': return count >= compareValue;
          default: return count === compareValue;
        }
      }
      default:
        return true;
    }
  }

  // Collection field conditions
  if (condition.source === 'collection_field') {
    const fieldId = condition.fieldId;
    if (!fieldId) return true;

    const rawValue = collectionItemData?.[fieldId];
    const value = rawValue ?? '';
    const compareValue = condition.value ?? '';
    const fieldType = condition.fieldType || 'text';

    // Check if value is present (non-empty)
    const isPresent = rawValue !== undefined && rawValue !== null && rawValue !== '';

    switch (condition.operator) {
      // Text operators
      case 'is':
        if (fieldType === 'boolean') {
          return value.toLowerCase() === compareValue.toLowerCase();
        }
        if (fieldType === 'number') {
          return parseFloat(value) === parseFloat(compareValue);
        }
        return value === compareValue;

      case 'is_not':
        if (fieldType === 'number') {
          return parseFloat(value) !== parseFloat(compareValue);
        }
        return value !== compareValue;

      case 'contains':
        return value.toLowerCase().includes(compareValue.toLowerCase());

      case 'does_not_contain':
        return !value.toLowerCase().includes(compareValue.toLowerCase());

      case 'is_present':
        return isPresent;

      case 'is_empty':
        return !isPresent;

      // Number operators
      case 'lt':
        return parseFloat(value) < parseFloat(compareValue);

      case 'lte':
        return parseFloat(value) <= parseFloat(compareValue);

      case 'gt':
        return parseFloat(value) > parseFloat(compareValue);

      case 'gte':
        return parseFloat(value) >= parseFloat(compareValue);

      // Date operators
      case 'is_before': {
        const dateValue = new Date(value);
        const compareDateValue = new Date(compareValue);
        return dateValue < compareDateValue;
      }

      case 'is_after': {
        const dateValue = new Date(value);
        const compareDateValue = new Date(compareValue);
        return dateValue > compareDateValue;
      }

      case 'is_between': {
        const dateValue = new Date(value);
        const startDate = new Date(compareValue);
        const endDate = new Date(condition.value2 ?? '');
        return dateValue >= startDate && dateValue <= endDate;
      }

      case 'is_not_empty':
        return isPresent;

      // Reference operators
      case 'is_one_of': {
        try {
          const allowedIds = JSON.parse(compareValue || '[]');
          if (!Array.isArray(allowedIds)) return false;
          // For multi-reference, value might be a JSON array
          try {
            const valueIds = JSON.parse(value);
            if (Array.isArray(valueIds)) {
              // Check if any of the value IDs are in the allowed list
              return valueIds.some((id: string) => allowedIds.includes(id));
            }
          } catch {
            // Not a JSON array, treat as single ID
          }
          return allowedIds.includes(value);
        } catch {
          return false;
        }
      }

      case 'is_not_one_of': {
        try {
          const excludedIds = JSON.parse(compareValue || '[]');
          if (!Array.isArray(excludedIds)) return true;
          // For multi-reference, value might be a JSON array
          try {
            const valueIds = JSON.parse(value);
            if (Array.isArray(valueIds)) {
              // Check if none of the value IDs are in the excluded list
              return !valueIds.some((id: string) => excludedIds.includes(id));
            }
          } catch {
            // Not a JSON array, treat as single ID
          }
          return !excludedIds.includes(value);
        } catch {
          return true;
        }
      }

      case 'exists':
        return isPresent;

      case 'does_not_exist':
        return !isPresent;

      // Multi-reference operators
      case 'contains_all_of': {
        try {
          const requiredIds = JSON.parse(compareValue || '[]');
          if (!Array.isArray(requiredIds)) return false;
          // Parse the multi-reference value
          let valueIds: string[] = [];
          try {
            const parsed = JSON.parse(value);
            valueIds = Array.isArray(parsed) ? parsed : [];
          } catch {
            valueIds = value ? [value] : [];
          }
          return requiredIds.every((id: string) => valueIds.includes(id));
        } catch {
          return false;
        }
      }

      case 'contains_exactly': {
        try {
          const requiredIds = JSON.parse(compareValue || '[]');
          if (!Array.isArray(requiredIds)) return false;
          // Parse the multi-reference value
          let valueIds: string[] = [];
          try {
            const parsed = JSON.parse(value);
            valueIds = Array.isArray(parsed) ? parsed : [];
          } catch {
            valueIds = value ? [value] : [];
          }
          // Check exact match (same items, regardless of order)
          return requiredIds.length === valueIds.length &&
                 requiredIds.every((id: string) => valueIds.includes(id));
        } catch {
          return false;
        }
      }

      // For multi-reference has_items / has_no_items - check if array has items
      // Note: 'has_items' and 'has_no_items' for page_collection are handled elsewhere
      // Here we handle them for multi-reference fields
      case 'has_items': {
        // For page_collection source, this is handled by PageCollectionOperator logic
        // For collection_field source with multi_reference, check array length
        if (condition.source === 'collection_field') {
          try {
            const arr = JSON.parse(value || '[]');
            return Array.isArray(arr) && arr.length > 0;
          } catch {
            return isPresent;
          }
        }
        // For page_collection, handled by pageCollectionCounts
        return true;
      }

      case 'has_no_items': {
        if (condition.source === 'collection_field') {
          try {
            const arr = JSON.parse(value || '[]');
            return !Array.isArray(arr) || arr.length === 0;
          } catch {
            return !isPresent;
          }
        }
        return true;
      }

      // Multi-reference item_count - compare the count of references
      case 'item_count': {
        if (condition.source === 'collection_field' && condition.fieldType === 'multi_reference') {
          let count = 0;
          try {
            const arr = JSON.parse(value || '[]');
            count = Array.isArray(arr) ? arr.length : 0;
          } catch {
            count = 0;
          }
          const compareVal = condition.compareValue ?? 0;
          const compareOp = condition.compareOperator ?? 'eq';
          switch (compareOp) {
            case 'eq': return count === compareVal;
            case 'lt': return count < compareVal;
            case 'lte': return count <= compareVal;
            case 'gt': return count > compareVal;
            case 'gte': return count >= compareVal;
            default: return count === compareVal;
          }
        }
        // For page_collection, this is handled earlier in the function
        return true;
      }

      default:
        return true;
    }
  }

  return true;
}

/**
 * Evaluate conditional visibility for a layer
 * Groups are AND'd together; conditions within a group are OR'd
 *
 * @param conditionalVisibility - The visibility rules from layer.variables
 * @param context - The context containing field values and collection counts
 * @returns True if layer should be visible, false if it should be hidden
 */
export function evaluateVisibility(
  conditionalVisibility: import('@/types').ConditionalVisibility | undefined,
  context: VisibilityContext
): boolean {
  // No conditional visibility set - layer is visible
  if (!conditionalVisibility || !conditionalVisibility.groups || conditionalVisibility.groups.length === 0) {
    return true;
  }

  // Evaluate each group (AND logic between groups)
  for (const group of conditionalVisibility.groups) {
    if (!group.conditions || group.conditions.length === 0) {
      continue; // Empty group is truthy (skipped)
    }

    // Evaluate conditions within group (OR logic)
    let groupResult = false;
    for (const condition of group.conditions) {
      if (evaluateCondition(condition, context)) {
        groupResult = true;
        break; // Short-circuit: one true condition makes the group true
      }
    }

    // If any group is false, the whole visibility is false (AND logic)
    if (!groupResult) {
      return false;
    }
  }

  // All groups passed
  return true;
}
