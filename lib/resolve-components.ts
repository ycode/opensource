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
  console.log('[resolveComponents] Processing', layers.length, 'layers with', components.length, 'components');

  return layers.map(layer => {
    // If this layer is a component instance, populate its children from the component
    if (layer.componentId) {
      const component = components.find(c => c.id === layer.componentId);

      console.log('[resolveComponents] Found component instance:', {
        layerId: layer.id,
        componentId: layer.componentId,
        componentFound: !!component,
        componentLayersCount: component?.layers?.length || 0
      });

      if (component && component.layers && component.layers.length > 0) {
        // Keep the wrapper layer but populate children from the component
        // The component's first layer is the actual content (Section, etc.)
        const componentContent = component.layers[0];

        // Recursively resolve any nested components within the component's content
        const resolvedChildren = componentContent.children
          ? resolveComponents(componentContent.children, components)
          : [];

        // Return the wrapper with the component's content merged in
        const resolved = {
          ...layer,
          ...componentContent, // Merge the component's properties (classes, design, etc.)
          id: layer.id, // Keep the instance's ID
          // Remove componentId so it's treated as a normal resolved layer
          componentId: undefined,
          children: resolvedChildren,
        };

        // Clean up undefined properties
        delete resolved.componentId;

        return resolved;
      } else {
        console.warn('[resolveComponents] Component not found or has no layers:', layer.componentId);
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

