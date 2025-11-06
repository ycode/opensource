/**
 * Component Utilities
 * 
 * Core logic for applying, detaching, and managing components
 */

import type { Layer, Component } from '@/types';

/**
 * Apply a component to a layer
 * Replaces the layer with a component instance (sets componentId)
 * Note: The actual layer tree is replaced during rendering, not here
 */
export function applyComponentToLayer(layer: Layer, component: Component): Layer {
  return {
    ...layer,
    componentId: component.id,
    componentOverrides: undefined, // Clear any previous overrides (reserved for future)
    // Keep the layer's own properties like id, customName, etc.
    // but when rendering, we'll use the component's layers
  };
}

/**
 * Detach component from a layer
 * Removes the component link but keeps the layer's own properties
 */
export function detachComponentFromLayer(layer: Layer): Layer {
  const { componentId, componentOverrides, ...rest } = layer;
  
  return {
    ...rest,
  } as Layer;
}

/**
 * Check if layer is a component instance
 */
export function isComponentInstance(layer: Layer): boolean {
  return !!layer.componentId;
}

/**
 * Update all layers using a specific component
 * Recursively traverses layer tree and updates component instances
 * This is used when the master component is updated to sync all instances
 */
export function updateLayersWithComponent(
  layers: Layer[],
  componentId: string,
  newComponentLayers: Layer[]
): Layer[] {
  return layers.map(layer => {
    // If this layer is an instance of the component, update it
    // Note: The actual rendering logic will use newComponentLayers
    // This just ensures the componentId is maintained
    if (layer.componentId === componentId) {
      return {
        ...layer,
        // componentId stays the same, but rendering will use updated component
      };
    }
    
    // Recursively update children
    if (layer.children && layer.children.length > 0) {
      return {
        ...layer,
        children: updateLayersWithComponent(layer.children, componentId, newComponentLayers),
      };
    }
    
    return layer;
  });
}

/**
 * Detach a component from all layers
 * Used when a component is deleted
 * Removes the component link from all instances
 */
export function detachComponentFromLayers(layers: Layer[], componentId: string): Layer[] {
  return layers.map(layer => {
    // Detach if this layer uses the component
    if (layer.componentId === componentId) {
      const { componentId: _, componentOverrides: __, ...rest } = layer;
      return rest as Layer;
    }
    
    // Recursively detach from children
    if (layer.children && layer.children.length > 0) {
      return {
        ...layer,
        children: detachComponentFromLayers(layer.children, componentId),
      };
    }
    
    return layer;
  });
}

/**
 * Count how many layers use a specific component
 * Useful for showing usage count in UI and delete confirmations
 */
export function countLayersUsingComponent(layers: Layer[], componentId: string): number {
  let count = 0;
  
  for (const layer of layers) {
    if (layer.componentId === componentId) {
      count++;
    }
    
    if (layer.children && layer.children.length > 0) {
      count += countLayersUsingComponent(layer.children, componentId);
    }
  }
  
  return count;
}

/**
 * Get all layer IDs using a specific component
 * Useful for UI highlights and bulk operations
 */
export function getLayerIdsUsingComponent(layers: Layer[], componentId: string): string[] {
  const ids: string[] = [];
  
  for (const layer of layers) {
    if (layer.componentId === componentId) {
      ids.push(layer.id);
    }
    
    if (layer.children && layer.children.length > 0) {
      ids.push(...getLayerIdsUsingComponent(layer.children, componentId));
    }
  }
  
  return ids;
}

