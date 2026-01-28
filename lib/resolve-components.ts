/**
 * Server-side utility to resolve component instances in layer tree
 * Replaces layers with componentId with the actual component layers
 * Applies component variable overrides during resolution
 */

import type { Layer, Component, ComponentVariable } from '@/types';

/**
 * Apply component variable overrides (or defaults) to layers
 * Recursively finds layers with variables.text.id or variables.image.src.id and applies override or default values
 */
function applyComponentOverrides(
  layers: Layer[],
  overrides?: Layer['componentOverrides'],
  componentVariables?: ComponentVariable[]
): Layer[] {
  return layers.map(layer => {
    let updatedLayer = { ...layer };

    // Check if this layer has a text variable linked
    const linkedTextVariableId = layer.variables?.text?.id;
    if (linkedTextVariableId) {
      // Check for override first, then fall back to variable's default value
      const overrideValue = overrides?.text?.[linkedTextVariableId];
      const variableDef = componentVariables?.find(v => v.id === linkedTextVariableId);
      const valueToApply = overrideValue ?? variableDef?.default_value;
      
      // Only apply if it's a text variable (has 'type' property, not ImageSettingsValue)
      if (valueToApply && 'type' in valueToApply) {
        // Apply the value to this layer's text variable
        updatedLayer = {
          ...updatedLayer,
          variables: {
            ...updatedLayer.variables,
            text: valueToApply as any,
          },
        };
      }
    }

    // Check if this layer has an image variable linked
    const linkedImageVariableId = (layer.variables?.image?.src as any)?.id;
    if (linkedImageVariableId) {
      // Check for override first, then fall back to variable's default value
      const overrideValue = overrides?.image?.[linkedImageVariableId];
      const variableDef = componentVariables?.find(v => v.id === linkedImageVariableId);
      const imageValue = (overrideValue ?? variableDef?.default_value) as any;
      
      if (imageValue) {
        // Apply the value to this layer's image variable
        updatedLayer = {
          ...updatedLayer,
          variables: {
            ...updatedLayer.variables,
            image: {
              ...updatedLayer.variables?.image,
              // Apply src from value, keeping the variable ID for reference
              src: imageValue.src ? { ...imageValue.src, id: linkedImageVariableId } : updatedLayer.variables?.image?.src,
              // Apply alt from value if present
              alt: imageValue.alt ?? updatedLayer.variables?.image?.alt,
            },
          },
          // Apply width/height attributes from value if present
          attributes: {
            ...updatedLayer.attributes,
            ...(imageValue.width && { width: imageValue.width }),
            ...(imageValue.height && { height: imageValue.height }),
            ...(imageValue.loading && { loading: imageValue.loading }),
          },
        };
      }
    }

    // Recursively process children
    if (updatedLayer.children) {
      updatedLayer.children = applyComponentOverrides(updatedLayer.children, overrides, componentVariables);
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

        // Apply component variable overrides (or defaults) before tagging
        const overriddenChildren = applyComponentOverrides(
          nestedResolved,
          layer.componentOverrides,
          component.variables
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
