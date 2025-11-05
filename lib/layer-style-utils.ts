/**
 * Layer Style Utilities
 * 
 * Core logic for applying, detaching, and managing layer styles
 */

import type { Layer, LayerStyle } from '@/types';

/**
 * Apply a style to a layer
 * Replaces layer's classes and design with style's values
 * Clears any previous style overrides
 */
export function applyStyleToLayer(layer: Layer, style: LayerStyle): Layer {
  return {
    ...layer,
    classes: style.classes,
    design: style.design,
    styleId: style.id,
    styleOverrides: undefined, // Clear any previous overrides
  };
}

/**
 * Detach style from a layer
 * Copies the current effective styling (style + overrides) to the layer's own classes/design
 * Then removes the style link and overrides
 */
export function detachStyleFromLayer(layer: Layer, style?: LayerStyle): Layer {
  // When updateStyledLayer is called, it updates both layer.classes/design AND styleOverrides
  // So we can just use what's already on the layer
  
  // Remove style references but keep current classes/design
  const { styleId, styleOverrides, ...rest } = layer;
  
  return {
    ...rest,
    // Keep the layer's current classes and design
    // (which already includes style + overrides if they were applied)
    classes: layer.classes || '',
    design: layer.design,
  } as Layer;
}

/**
 * Check if layer has a style applied
 */
export function hasStyle(layer: Layer): boolean {
  return !!layer.styleId;
}

/**
 * Check if layer has style overrides
 * Returns true if layer has a valid style AND has local modifications that differ from the style
 */
export function hasStyleOverrides(layer: Layer, style?: LayerStyle): boolean {
  const hasValidStyleId = layer.styleId && layer.styleId.trim() !== '';
  
  if (!hasValidStyleId || !layer.styleOverrides) {
    return false;
  }
  
  // If no style provided, we can only check if styleOverrides exists
  // This is a simple check used when we don't have the style loaded
  if (!style) {
    return true;
  }
  
  // Compare current values with style values to see if they actually differ
  const classesMatch = layer.classes === style.classes;
  const designMatch = JSON.stringify(layer.design || {}) === JSON.stringify(style.design || {});
  
  // Has overrides if either classes or design differ from the style
  return !classesMatch || !designMatch;
}

/**
 * Reset layer to original style
 * Removes overrides and reapplies style's current values
 */
export function resetLayerToStyle(layer: Layer, style: LayerStyle): Layer {
  if (!layer.styleId || layer.styleId !== style.id) {
    return layer;
  }
  
  return {
    ...layer,
    classes: style.classes,
    design: style.design,
    styleOverrides: undefined,
  };
}

/**
 * Update a styled layer
 * Tracks changes as overrides when a style is applied
 * If no style is applied, updates normally
 */
export function updateStyledLayer(
  layer: Layer,
  updates: { classes?: string; design?: Layer['design'] }
): Layer {
  // Check if layer has a valid style ID (not just empty string or undefined)
  const hasValidStyleId = layer.styleId && layer.styleId.trim() !== '';
  
  if (!hasValidStyleId) {
    // No style applied, just update normally
    return { ...layer, ...updates };
  }
  
  // Style is applied - track as overrides
  return {
    ...layer,
    ...updates,
    styleOverrides: {
      classes: updates.classes !== undefined ? updates.classes : layer.styleOverrides?.classes,
      design: updates.design !== undefined ? updates.design : layer.styleOverrides?.design,
    },
  };
}

/**
 * Update all layers using a specific style
 * Recursively traverses layer tree and updates layers that have the style applied
 * Only updates layers WITHOUT overrides (overridden layers keep their custom values)
 */
export function updateLayersWithStyle(
  layers: Layer[],
  styleId: string,
  newClasses: string,
  newDesign?: Layer['design']
): Layer[] {
  return layers.map(layer => {
    // Update this layer if it uses the style and has no overrides
    if (layer.styleId === styleId && !layer.styleOverrides) {
      return {
        ...layer,
        classes: newClasses,
        design: newDesign,
      };
    }
    
    // Recursively update children
    if (layer.children && layer.children.length > 0) {
      return {
        ...layer,
        children: updateLayersWithStyle(layer.children, styleId, newClasses, newDesign),
      };
    }
    
    return layer;
  });
}

/**
 * Detach a style from all layers
 * Used when a style is deleted
 * Keeps current classes/design values but removes the style link
 */
export function detachStyleFromLayers(layers: Layer[], styleId: string): Layer[] {
  return layers.map(layer => {
    // Detach if this layer uses the style
    if (layer.styleId === styleId) {
      const { styleId: _, styleOverrides: __, ...rest } = layer;
      return rest as Layer;
    }
    
    // Recursively detach from children
    if (layer.children && layer.children.length > 0) {
      return {
        ...layer,
        children: detachStyleFromLayers(layer.children, styleId),
      };
    }
    
    return layer;
  });
}

/**
 * Count how many layers use a specific style
 * Useful for showing usage count in UI and delete confirmations
 */
export function countLayersUsingStyle(layers: Layer[], styleId: string): number {
  let count = 0;
  
  for (const layer of layers) {
    if (layer.styleId === styleId) {
      count++;
    }
    
    if (layer.children && layer.children.length > 0) {
      count += countLayersUsingStyle(layer.children, styleId);
    }
  }
  
  return count;
}

/**
 * Get all layer IDs using a specific style
 * Useful for UI highlights and bulk operations
 */
export function getLayerIdsUsingStyle(layers: Layer[], styleId: string): string[] {
  const ids: string[] = [];
  
  for (const layer of layers) {
    if (layer.styleId === styleId) {
      ids.push(layer.id);
    }
    
    if (layer.children && layer.children.length > 0) {
      ids.push(...getLayerIdsUsingStyle(layer.children, styleId));
    }
  }
  
  return ids;
}

