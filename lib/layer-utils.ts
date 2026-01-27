/**
 * Layer utilities for rendering and manipulation
 */

import { Layer, FieldVariable, CollectionVariable, CollectionItemWithValues, CollectionField, Component, Breakpoint } from '@/types';
import { cn, generateId } from '@/lib/utils';
import { iconExists, IconProps } from '@/components/ui/icon';
import { getBlockIcon, getBlockName } from '@/lib/templates/blocks';
import { resolveInlineVariables } from '@/lib/inline-variables';
import { getInheritedValue } from '@/lib/tailwind-class-mapper';
import { cloneDeep } from 'lodash';

/**
 * Strip UI-only properties from layers before comparison/hashing
 * These properties (like 'open') are used for UI state and shouldn't trigger version changes
 */
export function stripUIProperties(layers: Layer[]): Layer[] {
  return layers.map(layer => {
    const { open, ...layerWithoutUI } = layer;
    if (layer.children && layer.children.length > 0) {
      return {
        ...layerWithoutUI,
        children: stripUIProperties(layer.children)
      };
    }
    return layerWithoutUI;
  });
}

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
 * Check if a layer can be moved to a new parent based on ancestor restrictions and link nesting
 */
export function canMoveLayer(layers: Layer[], layerId: string, newParentId: string | null): boolean {
  const layer = findLayerById(layers, layerId);
  if (!layer) return false;

  // Check link nesting restrictions (can't have <a> inside <a>)
  if (newParentId !== null) {
    const newParent = findLayerById(layers, newParentId);
    if (newParent && !canAddChild(newParent, layer)) {
      return false;
    }

    // Also check if any ancestor of the new parent has link settings
    const hasLinkAncestor = findAncestor(layers, newParentId, (ancestor) => hasLinkSettings(ancestor));
    if (hasLinkAncestor && hasLinkInTree(layer)) {
      return false;
    }
  }

  // No ancestor restriction - can move anywhere (as long as link nesting is valid)
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
 */
export function getText(layer: Layer): string | undefined {
  const textVariable = layer.variables?.text;
  if (textVariable && textVariable.type === 'dynamic_text') {
    return textVariable.data.content;
  }
  return undefined;
}

/**
 * Check if a layer has link settings
 */
export function hasLinkSettings(layer: Layer): boolean {
  return !!(layer.variables?.link && layer.variables.link.type);
}

/**
 * Check if a layer or any of its descendants has link settings
 */
export function hasLinkInTree(layer: Layer): boolean {
  if (hasLinkSettings(layer)) {
    return true;
  }

  if (layer.children) {
    return layer.children.some(child => hasLinkInTree(child));
  }

  return false;
}

/**
 * Check if a layer can have a specific child layer
 * @param parent - The parent layer
 * @param child - The child layer to check
 * @returns true if the child can be added to the parent
 */
export function canAddChild(parent: Layer, child: Layer): boolean {
  // Links cannot be nested (can't have <a> inside <a>)
  if (hasLinkSettings(parent) && hasLinkInTree(child)) {
    return false;
  }

  if (hasLinkSettings(child) && hasLinkSettings(parent)) {
    return false;
  }

  return true;
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
    'text', 'span', 'label', 'hr',
    'input', 'textarea', 'select', 'checkbox', 'radio',
    'htmlEmbed',
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
 */
export function getTextWithBinding(
  layer: Layer,
  collectionItemData?: Record<string, string>
): string | undefined {
  // Check variables.text (DynamicTextVariable with inline variables)
  const textVariable = layer.variables?.text;
  if (textVariable && textVariable.type === 'dynamic_text') {
    const content = textVariable.data.content;
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
 * Layout type derived from layer's design properties
 */
export type LayoutType = 'columns' | 'rows' | 'grid' | 'hidden' | null;

/**
 * Get the layout type for a layer at a specific breakpoint
 * Takes into account CSS inheritance (desktop → tablet → mobile)
 *
 * @param layer - The layer to check
 * @param breakpoint - The breakpoint to check (default: 'desktop')
 * @returns The layout type ('columns', 'rows', 'grid', 'hidden') or null if not a layout layer
 */
export function getLayoutTypeForBreakpoint(
  layer: Layer,
  breakpoint: Breakpoint = 'desktop'
): LayoutType {
  const classes = Array.isArray(layer.classes)
    ? layer.classes
    : (layer.classes || '').split(' ').filter(Boolean);

  if (classes.length === 0) {
    // Fallback to design object if no classes
    const design = layer.design?.layout;
    if (!design?.isActive) return null;

    const display = design.display;
    const flexDirection = design.flexDirection;

    if (display === 'hidden') return 'hidden';
    if (display === 'grid' || display === 'Grid') return 'grid';
    if (display === 'flex' || display === 'Flex') {
      if (flexDirection === 'column' || flexDirection === 'column-reverse') {
        return 'rows';
      }
      return 'columns';
    }
    return null;
  }

  // Use inheritance to get the display value for the breakpoint
  const { value: displayClass } = getInheritedValue(classes, 'display', breakpoint);
  const { value: flexDirectionClass } = getInheritedValue(classes, 'flexDirection', breakpoint);

  // getInheritedValue returns full class names like 'flex-col', 'flex-row', 'grid', 'flex'
  const display = displayClass || '';
  const flexDirection = flexDirectionClass || '';

  if (display === 'hidden') return 'hidden';
  if (display === 'grid') return 'grid';
  if (display === 'flex' || display === 'inline-flex') {
    // Check for column direction
    // Tailwind classes: 'flex-col', 'flex-col-reverse'
    if (flexDirection === 'flex-col' || flexDirection === 'flex-col-reverse') {
      return 'rows';
    }
    // Default flex is row direction (flex-row, flex-row-reverse, or no direction class)
    return 'columns';
  }

  return null;
}

/**
 * Get the display name for a layout type
 */
export function getLayoutTypeName(layoutType: LayoutType): string | null {
  switch (layoutType) {
    case 'columns': return 'Columns';
    case 'rows': return 'Rows';
    case 'grid': return 'Grid';
    case 'hidden': return 'Hidden';
    default: return null;
  }
}

// Layout custom names that should use breakpoint-aware icons/names
const LAYOUT_CUSTOM_NAMES = ['Columns', 'Rows', 'Grid'];

/**
 * Get the icon name (for `components/ui/Icon.tsx`) for a layer
 *
 * @param layer - The layer to get the icon for
 * @param defaultIcon - Fallback icon (default: 'box')
 * @param breakpoint - Optional breakpoint for layout-aware icons
 */
export function getLayerIcon(
  layer: Layer,
  defaultIcon: IconProps['name'] = 'box',
  breakpoint?: Breakpoint
): IconProps['name'] {
  // Body layers
  if (layer.id === 'body') return 'layout';

  // Component layers
  if (layer.componentId) return 'component';

  // Collection layers
  if (getCollectionVariable(layer)) {
    return 'database';
  }

  // Text layers
  if (layer.name === 'text') {
    return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(layer.settings?.tag || '') ? 'heading' : 'text';
  }

  // Layout layers (Columns, Rows, Grid) - breakpoint-aware icons
  if (layer.customName && LAYOUT_CUSTOM_NAMES.includes(layer.customName)) {
    if (breakpoint) {
      const layoutType = getLayoutTypeForBreakpoint(layer, breakpoint);
      if (layoutType === 'columns') return 'columns';
      if (layoutType === 'rows') return 'rows';
      if (layoutType === 'grid') return 'grid';
      if (layoutType === 'hidden') return 'eye-off';
    }
    // Fallback to custom name when no breakpoint
    if (layer.customName === 'Columns') return 'columns';
    if (layer.customName === 'Rows') return 'rows';
    if (layer.customName === 'Grid') return 'grid';
  }

  // Other named layers
  if (layer.customName === 'Container') return 'container';

  // Fallback to block icon (based on name)
  return getBlockIcon(layer.name, defaultIcon);
}

/**
 * Get the label for a layer (for display in the UI)
 *
 * @param layer - The layer to get the name for
 * @param context - Optional context (component_name, collection_name)
 * @param breakpoint - Optional breakpoint for layout-aware names
 */
export function getLayerName(
  layer: Layer,
  context?: {
    component_name?: string | undefined | null,
    collection_name?: string | undefined | null,
  },
  breakpoint?: Breakpoint
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

  // Layout layers (Columns, Rows, Grid) - breakpoint-aware names
  if (breakpoint && layer.customName && LAYOUT_CUSTOM_NAMES.includes(layer.customName)) {
    const layoutType = getLayoutTypeForBreakpoint(layer, breakpoint);
    const layoutName = getLayoutTypeName(layoutType);
    if (layoutName) {
      return layoutName;
    }
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

/**
 * Build a map of layer IDs to their root component layer ID
 * This helps know which layers belong to which component instance
 */
function buildComponentMap(layers: Layer[], componentMap: Record<string, string> = {}, currentComponentRootId: string | null = null): Record<string, string> {
  layers.forEach(layer => {
    // If this is a component instance root, track it
    const rootId = layer.componentId ? layer.id : currentComponentRootId;

    // Map all descendants to this component root
    if (rootId) {
      componentMap[layer.id] = rootId;
    }

    // Recursively process children
    if (layer.children && layer.children.length > 0) {
      buildComponentMap(layer.children, componentMap, rootId);
    }
  });

  return componentMap;
}

/**
 * Resolve component instances in layer tree
 * Replaces layers with componentId with the actual component layers
 */
function resolveComponentsInLayers(layers: Layer[], components: Component[]): Layer[] {
  return layers.map(layer => {
    // If this layer is a component instance, populate its children from the component
    if (layer.componentId) {
      const component = components.find(c => c.id === layer.componentId);

      if (component && component.layers && component.layers.length > 0) {
        // The component's first layer is the actual content (Section, etc.)
        const componentContent = component.layers[0];

        // Recursively resolve any nested components within the component's content
        const resolvedChildren = componentContent.children
          ? resolveComponentsInLayers(componentContent.children, components)
          : [];

        // Return the wrapper with the component's content merged in
        // IMPORTANT: Keep componentId so LayerRenderer knows this is a component instance
        const resolved = {
          ...layer,
          ...componentContent, // Merge the component's properties (classes, design, etc.)
          id: layer.id, // Keep the instance's ID
          componentId: layer.componentId, // Keep the original componentId for selection
          children: resolvedChildren,
        };

        return resolved;
      }
    }

    // Recursively process children
    if (layer.children && layer.children.length > 0) {
      return {
        ...layer,
        children: resolveComponentsInLayers(layer.children, components),
      };
    }

    return layer;
  });
}

/**
 * Serialize layers by resolving component instances
 * Returns both the resolved layers and a map of layer IDs to their component root IDs
 */
export function serializeLayers(layers: Layer[], components: Component[] = []): { layers: Layer[]; componentMap: Record<string, string> } {
  // First build the component map (before resolving)
  const componentMap = buildComponentMap(layers);

  // Then resolve component instances
  const resolvedLayers = resolveComponentsInLayers(layers, components);

  // Deep clone to avoid mutations
  return {
    layers: JSON.parse(JSON.stringify(resolvedLayers)),
    componentMap,
  };
}

/**
 * Assign order classes to a newly added layer if siblings have responsive order classes.
 * This ensures new layers appear at the end when the parent has responsive ordering.
 *
 * IMPORTANT: This checks for order classes on ALL responsive breakpoints (tablet AND mobile),
 * not just the current breakpoint. This handles the case where a layer is added on Desktop
 * but siblings have tablet/mobile order overrides.
 *
 * @param layers - The full layer tree
 * @param parentId - The parent layer ID where the new layer was added
 * @param newLayerId - The ID of the newly added layer
 * @param _breakpoint - The current breakpoint (kept for API compatibility, but we check all breakpoints)
 * @returns Updated layer tree, or original if no changes needed
 */
export function assignOrderClassToNewLayer(
  layers: Layer[],
  parentId: string,
  newLayerId: string,
  _breakpoint: 'desktop' | 'tablet' | 'mobile'
): Layer[] {
  // Define all responsive breakpoints to check
  const breakpointConfigs = [
    { name: 'tablet', prefix: 'max-lg:' },
    { name: 'mobile', prefix: 'max-md:' },
  ];

  // Helper to normalize classes to string
  const normalizeClasses = (classes: string | string[] | undefined): string => {
    if (!classes) return '';
    return Array.isArray(classes) ? classes.join(' ') : classes;
  };

  // Helper to check if a class string has order classes for a specific prefix
  const hasOrderClassForPrefix = (classes: string | string[] | undefined, prefix: string): boolean => {
    const normalized = normalizeClasses(classes);
    const regex = new RegExp(`${prefix.replace(':', '\\:')}order-\\d+`);
    return regex.test(normalized);
  };

  // Helper to get the order value from classes for a specific prefix
  const getOrderValueForPrefix = (classes: string | string[] | undefined, prefix: string): number | null => {
    const normalized = normalizeClasses(classes);
    const regex = new RegExp(`${prefix.replace(':', '\\:')}order-(\\d+)`);
    const match = normalized.match(regex);
    return match ? parseInt(match[1], 10) : null;
  };

  // Recursively find the parent and process
  function processLayers(layerList: Layer[]): Layer[] {
    return layerList.map(layer => {
      if (layer.id === parentId && layer.children && layer.children.length > 0) {
        // Found the parent - check each breakpoint for order classes
        const siblings = layer.children.filter(c => c.id !== newLayerId);
        const newLayer = layer.children.find(c => c.id === newLayerId);

        if (!newLayer) {
          return layer;
        }

        // Collect order classes to add for each breakpoint
        const orderClassesToAdd: string[] = [];

        for (const config of breakpointConfigs) {
          const hasOrderedSiblings = siblings.some(c => hasOrderClassForPrefix(c.classes, config.prefix));

          if (hasOrderedSiblings) {
            // Find the highest order value among siblings for this breakpoint
            let maxOrder = -1;
            siblings.forEach(sibling => {
              const orderValue = getOrderValueForPrefix(sibling.classes, config.prefix);
              if (orderValue !== null && orderValue > maxOrder) {
                maxOrder = orderValue;
              }
            });

            // Assign the next order value
            const newOrderValue = maxOrder + 1;
            orderClassesToAdd.push(`${config.prefix}order-${newOrderValue}`);
          }
        }

        if (orderClassesToAdd.length === 0) {
          // No siblings have order classes for any breakpoint
          return layer;
        }

        // Update the new layer with order classes
        const updatedChildren = layer.children.map(child => {
          if (child.id === newLayerId) {
            const currentClasses = normalizeClasses(child.classes);
            const newClasses = orderClassesToAdd.join(' ');
            return {
              ...child,
              classes: currentClasses ? `${currentClasses} ${newClasses}` : newClasses,
            };
          }
          return child;
        });

        return {
          ...layer,
          children: updatedChildren,
        };
      }

      // Recursively process children
      if (layer.children) {
        return {
          ...layer,
          children: processLayers(layer.children),
        };
      }

      return layer;
    });
  }

  return processLayers(layers);
}

/**
 * Creates a component via API and returns the result
 */
export async function createComponentViaApi(
  componentName: string,
  layers: Layer[]
): Promise<Component | null> {
  try {
    const response = await fetch('/api/components', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: componentName,
        layers: layers.map(layer => cloneDeep(layer)),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }
      console.error('Failed to create component:', errorMessage);
      return null;
    }

    const result = await response.json();

    if (result.error || !result.data) {
      console.error('Failed to create component:', result.error);
      return null;
    }

    return result.data;
  } catch (error) {
    console.error('Failed to create component:', error);
    return null;
  }
}

/**
 * Replaces a layer with a component instance in a layer tree
 */
export function replaceLayerWithComponentInstance(
  layers: Layer[],
  layerId: string,
  componentId: string
): Layer[] {
  return layers.map((layer) => {
    if (layer.id === layerId) {
      return {
        ...layer,
        componentId,
        children: [],
      };
    }
    if (layer.children) {
      return {
        ...layer,
        children: replaceLayerWithComponentInstance(layer.children, layerId, componentId),
      };
    }
    return layer;
  });
}
