/**
 * Iframe Bridge - Type-safe postMessage communication between editor and canvas iframe
 */

import type { Layer, Component, CollectionItemWithValues, CollectionField } from '@/types';

// Message types sent FROM parent TO iframe
export type ParentToIframeMessage =
  | { type: 'UPDATE_LAYERS'; payload: { layers: Layer[]; selectedLayerId: string | null; componentMap: Record<string, string>; editingComponentId: string | null; collectionItems: Record<string, CollectionItemWithValues[]>; collectionFields: Record<string, CollectionField[]> } }
  | { type: 'UPDATE_SELECTION'; payload: { layerId: string | null } }
  | { type: 'UPDATE_BREAKPOINT'; payload: { breakpoint: 'mobile' | 'tablet' | 'desktop' } }
  | { type: 'UPDATE_UI_STATE'; payload: { uiState: 'neutral' | 'hover' | 'focus' | 'active' | 'disabled' | 'current' } }
  | { type: 'ENABLE_EDIT_MODE'; payload: { enabled: boolean } }
  | { type: 'HIGHLIGHT_DROP_ZONE'; payload: { layerId: string | null } }
  | { type: 'COLLECTION_LAYER_DATA'; payload: { layerId: string; items: CollectionItemWithValues[] } };

// Message types sent FROM iframe TO parent
export type IframeToParentMessage =
  | { type: 'READY'; payload: null }
  | { type: 'LAYER_CLICK'; payload: { layerId: string; metaKey: boolean; shiftKey: boolean } }
  | { type: 'LAYER_DOUBLE_CLICK'; payload: { layerId: string } }
  | { type: 'TEXT_CHANGE_START'; payload: { layerId: string } }
  | { type: 'TEXT_CHANGE_END'; payload: { layerId: string; text: string } }
  | { type: 'DRAG_START'; payload: { layerId: string } }
  | { type: 'DRAG_OVER'; payload: { layerId: string | null; position: 'before' | 'after' | 'inside' } }
  | { type: 'DROP'; payload: { targetLayerId: string; position: 'before' | 'after' | 'inside'; sourceLayerId?: string } }
  | { type: 'CONTEXT_MENU'; payload: { layerId: string; x: number; y: number } };

export type IframeMessage = ParentToIframeMessage | IframeToParentMessage;

/**
 * Send a message to the iframe
 */
export function sendToIframe(iframe: HTMLIFrameElement | null, message: ParentToIframeMessage): void {
  if (!iframe || !iframe.contentWindow) {
    console.warn('[iframe-bridge] Cannot send message - iframe not ready:', message.type);
    return;
  }

  try {
    iframe.contentWindow.postMessage(message, '*');
  } catch (error) {
    console.error('[iframe-bridge] Error sending message to iframe:', error);
  }
}

/**
 * Listen for messages from the iframe
 */
export function listenToIframe(
  callback: (message: IframeToParentMessage) => void
): () => void {
  const handleMessage = (event: MessageEvent) => {
    // Validate message origin if needed (for production, check event.origin)
    const message = event.data as IframeMessage;
    
    // Only process messages from iframe (those sent TO parent)
    if (isIframeToParentMessage(message)) {
      callback(message);
    }
  };

  window.addEventListener('message', handleMessage);

  // Return cleanup function
  return () => {
    window.removeEventListener('message', handleMessage);
  };
}

/**
 * Type guard to check if message is from iframe to parent
 */
function isIframeToParentMessage(message: any): message is IframeToParentMessage {
  if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
    return false;
  }

  const validTypes: IframeToParentMessage['type'][] = [
    'READY',
    'LAYER_CLICK',
    'LAYER_DOUBLE_CLICK',
    'TEXT_CHANGE_START',
    'TEXT_CHANGE_END',
    'DRAG_START',
    'DRAG_OVER',
    'DROP',
    'CONTEXT_MENU',
  ];

  return validTypes.includes(message.type);
}

/**
 * Build a map of layer IDs to their root component layer ID
 * This helps the iframe know which layers belong to which component
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
 * Serialize layer data for iframe (remove circular references, resolve components, etc.)
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
