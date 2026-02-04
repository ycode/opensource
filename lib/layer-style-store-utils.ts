import { useComponentsStore } from '@/stores/useComponentsStore';
import { usePagesStore } from '@/stores/usePagesStore';
import type { Layer } from '@/types';

/**
 * Update all layers using a style across pages and components.
 */
export function updateStyleAcrossStores(
  styleId: string,
  newClasses: string,
  newDesign?: Layer['design']
): void {
  const { updateStyleOnLayers } = usePagesStore.getState();
  const { updateStyleOnLayers: updateStyleOnComponentLayers } = useComponentsStore.getState();

  updateStyleOnLayers(styleId, newClasses, newDesign);
  updateStyleOnComponentLayers(styleId, newClasses, newDesign);
}

/**
 * Detach a style from all layers across pages and components.
 */
export function detachStyleAcrossStores(styleId: string): void {
  const { detachStyleFromAllLayers } = usePagesStore.getState();
  const { detachStyleFromAllLayers: detachStyleFromAllComponentLayers } = useComponentsStore.getState();

  detachStyleFromAllLayers(styleId);
  detachStyleFromAllComponentLayers(styleId);
}
