/**
 * Layer utilities for rendering and manipulation
 */

import { Layer, FieldVariable, CollectionVariable, InlineVariableContent, CollectionItemWithValues, CollectionField } from '@/types';
import { cn } from '@/lib/utils';

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
  // Priority 1: Check variables.collection (new structure)
  if (layer.variables?.collection) {
    return layer.variables.collection;
  }
  
  // Priority 2: Fallback to legacy layer.collection
  if (layer.collection) {
    return layer.collection;
  }
  
  return null;
}

/**
 * Get inline variable content from layer
 */
export function getInlineVariableContent(layer: Layer): InlineVariableContent | null {
  return layer.variables?.text || null;
}

/**
 * Resolve inline variables in text by replacing ID-based placeholders
 * @param content - InlineVariableContent with data and variables map
 * @param collectionItemData - Collection item values (field_id -> value)
 * @returns Resolved text with placeholders replaced
 */
export function resolveInlineVariables(
  content: InlineVariableContent,
  collectionItemData?: Record<string, string>
): string {
  if (!collectionItemData) {
    // Return data with placeholders removed if no collection data
    return content.data.replace(/<ycode-inline-variable id="[^"]+"><\/ycode-inline-variable>/g, '');
  }

  let resolvedText = content.data;

  // Replace each <ycode-inline-variable id="uuid"></ycode-inline-variable> with actual value
  const regex = /<ycode-inline-variable id="([^"]+)"><\/ycode-inline-variable>/g;
  resolvedText = resolvedText.replace(regex, (match, variableId) => {
    const variable = content.variables[variableId];
    if (variable && variable.type === 'field' && variable.data?.field_id) {
      const fieldId = variable.data.field_id;
      const value = collectionItemData[fieldId];
      if (value !== undefined && value !== null) {
        return value;
      }
    }
    return ''; // Empty string for deleted/missing fields
  });

  return resolvedText;
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
    // Check if this layer is a collection layer
    const isCollectionLayer = current.type === 'collection' || current.name === 'collection';
    const hasCollectionVariable = !!getCollectionVariable(current);
    
    if (isCollectionLayer && hasCollectionVariable) {
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
  // Check if explicitly marked as formattable
  if (layer.formattable) return true;
  
  // Check layer type (legacy)
  if (layer.type === 'text' || layer.type === 'heading') return true;
  
  // Check HTML tag name (new templates use 'name' property)
  const tag = layer.name || layer.type || '';
  const editableTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'button', 'label', 'li'];
  
  return editableTags.includes(tag);
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

  // Priority 3: Fall back to type-based mapping (old system)
  if (layer.type === 'container') return 'div';
  if (layer.type === 'heading') return 'h1';
  if (layer.type === 'text') return 'p';
  if (layer.type === 'image') return 'img';

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
 * Elements that cannot have children (void elements + text-only elements)
 */
const ELEMENTS_WITHOUT_CHILDREN = [
  // Void/self-closing elements
  'img',
  'input', 
  'hr',
  'br',
  'icon',
  'video',
  'audio',
  'image',    // Old system
  
  // Text-only elements that should be leaf nodes
  'heading',  // Generic heading
  'h1',
  'h2', 
  'h3',
  'h4',
  'h5',
  'h6',
  'p',        // Paragraph
  'span',     // Inline text
  'label',    // Form label
  'button',   // Button (text content only in builder)
  'text',     // Old system text type
  
  // Form inputs (technically not void but shouldn't have children in builder)
  'textarea',
  'select',
  'checkbox',
  'radio',
];

/**
 * Check if a layer can have children based on its name/type
 */
export function canHaveChildren(layer: Layer): boolean {
  // Component instances cannot have children added to them
  // Children can only be edited in the master component
  if (layer.componentId) {
    return false;
  }
  
  const elementName = (layer.name || layer.type) ?? '';
  return !ELEMENTS_WITHOUT_CHILDREN.includes(elementName);
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
  // Priority 1: Check variables.text (new structure with inline variables)
  const inlineVariableContent = getInlineVariableContent(layer);
  if (inlineVariableContent) {
    return resolveInlineVariables(inlineVariableContent, collectionItemData);
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
