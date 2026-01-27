/**
 * Shared Drop Utilities
 * 
 * Reusable drop position calculation and validation logic used by:
 * - LayersTree (drag-and-drop reordering)
 * - CenterCanvas (drag from ElementLibrary to canvas)
 * 
 * This ensures consistent behavior across both drag-and-drop systems.
 */

import type { Layer } from '@/types';
import { canHaveChildren, canMoveLayer, findLayerById, findLayerWithParent } from './layer-utils';

export type DropPosition = 'above' | 'below' | 'inside';

export interface DropCalculationResult {
  position: DropPosition;
  targetParentId: string | null;
  isValid: boolean;
  invalidReason?: string;
}

/**
 * Calculate drop position based on cursor Y position relative to element.
 * Uses the same thresholds as LayersTree for consistency.
 * 
 * Thresholds:
 * - Container with visible children: 15% top/bottom, 70% inside
 * - Empty/collapsed container: 10% top/bottom, 80% inside  
 * - Leaf nodes (cannot have children): 50/50 split
 * 
 * @param relativeY - Cursor Y position as ratio (0-1) within element bounds
 * @param targetCanHaveChildren - Whether the target layer can accept children
 * @param targetHasVisibleChildren - Whether target has visible (not collapsed) children
 * @param isDraggingSection - Whether the dragged element is a section
 * @param isTargetBody - Whether hovering over the Body layer
 */
export function calculateDropPosition(
  relativeY: number,
  targetCanHaveChildren: boolean,
  targetHasVisibleChildren: boolean,
  isDraggingSection: boolean,
  isTargetBody: boolean
): DropPosition {
  // Section-specific: sections can only drop inside Body
  const shouldDisableInsideDrop = isDraggingSection && !isTargetBody;

  if (targetCanHaveChildren && !shouldDisableInsideDrop) {
    if (targetHasVisibleChildren) {
      // With visible children: 15% top/bottom, 70% inside
      if (relativeY < 0.15) return 'above';
      if (relativeY > 0.85) return 'below';
      return 'inside';
    } else {
      // Empty/collapsed containers: 10% top/bottom, 80% inside
      if (relativeY < 0.10) return 'above';
      if (relativeY > 0.90) return 'below';
      return 'inside';
    }
  }
  
  // Leaf nodes: simple 50/50 split
  return relativeY < 0.5 ? 'above' : 'below';
}

/**
 * Find the parent ID of a layer in the tree.
 * 
 * @param layers - Root layer array
 * @param childId - ID of the layer to find parent for
 * @returns Parent layer ID or null if at root level
 */
export function findParentId(layers: Layer[], childId: string): string | null {
  const result = findLayerWithParent(layers, childId);
  return result?.parent?.id ?? null;
}

/**
 * Validate if a drop is allowed and calculate the target parent.
 * Reuses same validation logic as LayersTree for consistency.
 * 
 * @param layers - Current layer tree
 * @param targetLayerId - ID of the layer being hovered
 * @param position - Calculated drop position
 * @param draggedElementType - Type of element being dragged (e.g., 'section', 'div')
 * @param draggedLayerId - Optional: ID of layer being moved (for reordering validation)
 */
export function validateDrop(
  layers: Layer[],
  targetLayerId: string,
  position: DropPosition,
  draggedElementType: string,
  draggedLayerId?: string
): DropCalculationResult {
  const targetLayer = findLayerById(layers, targetLayerId);
  
  if (!targetLayer) {
    return { 
      position, 
      targetParentId: null, 
      isValid: false, 
      invalidReason: 'Target layer not found' 
    };
  }

  // Calculate target parent based on position
  // 'inside' means target becomes the parent
  // 'above'/'below' means target's parent becomes the parent (sibling insertion)
  const targetParentId = position === 'inside' 
    ? targetLayerId 
    : findParentId(layers, targetLayerId);

  // Prevent dropping at root level (outside Body)
  if (targetParentId === null && position !== 'inside') {
    return { 
      position, 
      targetParentId, 
      isValid: false, 
      invalidReason: 'Cannot place outside Body' 
    };
  }

  // Section can only be at Body level
  if (draggedElementType === 'section') {
    const parentLayer = targetParentId ? findLayerById(layers, targetParentId) : null;
    const isParentBody = targetParentId === 'body' || parentLayer?.name === 'body';
    
    if (!isParentBody) {
      return { 
        position, 
        targetParentId, 
        isValid: false, 
        invalidReason: 'Section must be at Body level' 
      };
    }
  }

  // Check canHaveChildren for 'inside' drops
  if (position === 'inside' && !canHaveChildren(targetLayer, draggedElementType)) {
    return { 
      position, 
      targetParentId, 
      isValid: false, 
      invalidReason: 'Target cannot have children' 
    };
  }

  // For reordering existing layers: prevent dropping into descendants
  if (draggedLayerId) {
    if (!canMoveLayer(layers, draggedLayerId, targetParentId)) {
      return { 
        position, 
        targetParentId, 
        isValid: false, 
        invalidReason: 'Cannot move into descendant' 
      };
    }
  }

  return { 
    position, 
    targetParentId, 
    isValid: true 
  };
}

/**
 * Check if a layer is a container type (uses generous inside drop zone)
 */
export function isContainerLayer(layer: Layer): boolean {
  const containerNames = ['section', 'container', 'div', 'form', 'body'];
  return containerNames.includes(layer.name) || layer.name === 'div';
}

/**
 * Get display name for a layer (for "Add in [Name]" label)
 */
export function getDropTargetDisplayName(layer: Layer): string {
  // Use customName if available, otherwise format the layer name
  if (layer.customName) {
    return layer.customName;
  }
  
  // Capitalize first letter
  return layer.name.charAt(0).toUpperCase() + layer.name.slice(1);
}
