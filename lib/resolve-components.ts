/**
 * Server-side utility to resolve component instances in layer tree
 * Replaces layers with componentId with the actual component layers
 */

import type { Layer, Component } from '@/types';

/**
 * Recursively resolve component instances in a layer tree
 * @param layers - The layer tree to process
 * @param components - Array of available components
 * @returns Layer tree with components resolved
 */
export function resolveComponents(layers: Layer[], components: Component[]): Layer[] {
  return layers.map(layer => {
    // If this layer is a component instance, resolve it
    if (layer.componentId) {
      const component = components.find(c => c.id === layer.componentId);
      
      if (component && component.layers) {
        // Return the component's layers, preserving the wrapper layer's properties
        // but using the component's children
        return {
          ...layer,
          children: component.layers,
        };
      }
    }
    
    // Recursively process children
    if (layer.children && layer.children.length > 0) {
      return {
        ...layer,
        children: resolveComponents(layer.children, components),
      };
    }
    
    return layer;
  });
}

