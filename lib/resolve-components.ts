/**
 * Server-side utility to resolve component instances in layer tree
 * Replaces layers with componentId with the actual component layers
 * Applies component variable overrides during resolution
 */

import type { Layer, Component } from '@/types';

/**
 * Apply component variable overrides to layers
 * Recursively finds layers with variables.text.id and applies override values
 */
function applyComponentOverrides(
  layers: Layer[],
  overrides?: Layer['componentOverrides']
): Layer[] {
  if (!overrides?.text) return layers;

  return layers.map(layer => {
    let updatedLayer = { ...layer };

    // Check if this layer has a text variable that needs to be overridden
    const linkedVariableId = layer.variables?.text?.id;
    if (linkedVariableId && overrides.text?.[linkedVariableId]) {
      // Apply the override value to this layer's text variable
      updatedLayer = {
        ...updatedLayer,
        variables: {
          ...updatedLayer.variables,
          text: overrides.text[linkedVariableId],
        },
      };
    }

    // Recursively process children
    if (updatedLayer.children) {
      updatedLayer.children = applyComponentOverrides(updatedLayer.children, overrides);
    }

    return updatedLayer;
  });
}

/**
 * Tag layers with their master component ID for translation lookups
 */
function tagLayersWithComponentId(layers: Layer[], componentId: string): Layer[] {
  return layers.map(layer => ({
    ...layer,
    _masterComponentId: componentId,
    children: layer.children
      ? tagLayersWithComponentId(layer.children, componentId)
      : undefined,
  }));
}

/**
 * Recursively resolve component instances in a layer tree
 * @param layers - The layer tree to process
 * @param components - Array of available components
 * @returns Layer tree with components resolved
 */
export function resolveComponents(layers: Layer[], components: Component[]): Layer[] {
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

      if (component?.layers?.length) {
        // The component's first layer is the actual content (Section, etc.)
        const componentContent = component.layers[0];

        // Recursively resolve nested components
        const nestedResolved = componentContent.children
          ? resolveComponents(componentContent.children, components)
          : [];

        // Apply component variable overrides before tagging
        const overriddenChildren = applyComponentOverrides(
          nestedResolved,
          layer.componentOverrides
        );

        // Tag with master component ID for translation lookups
        const resolvedChildren = overriddenChildren.length
          ? tagLayersWithComponentId(overriddenChildren, component.id)
          : [];

        // Merge component content with instance layer, keeping instance ID
        // IMPORTANT: Keep componentId so LayerRenderer knows this is a component instance
        return {
          ...layer,
          ...componentContent,
          id: layer.id,
          componentId: layer.componentId, // Keep the original componentId
          _masterComponentId: component.id,
          children: resolvedChildren,
        };
      }

      console.warn('[resolveComponents] Component not found or has no layers:', layer.componentId);
    }

    // Recursively process children for non-component layers
    if (layer.children?.length) {
      return {
        ...layer,
        children: resolveComponents(layer.children, components),
      };
    }

    return layer;
  });
}
