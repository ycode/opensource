/**
 * Design Sync Hook
 * 
 * Manages bidirectional sync between layer.design object and Tailwind classes
 */

import { useCallback, useMemo } from 'react';
import type { Layer } from '@/types';
import {
  propertyToClass,
  replaceConflictingClasses,
  designToClasses,
} from '@/lib/tailwind-class-mapper';

interface UseDesignSyncProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export function useDesignSync({ layer, onLayerUpdate }: UseDesignSyncProps) {
  /**
   * Update a single design property and sync to classes
   */
  const updateDesignProperty = useCallback(
    (
      category: keyof NonNullable<Layer['design']>,
      property: string,
      value: string | null
    ) => {
      if (!layer) return;
      
      // 1. Update design object
      const currentDesign = layer.design || {};
      const categoryData = currentDesign[category] || {};
      
      const updatedDesign = {
        ...currentDesign,
        [category]: {
          ...categoryData,
          [property]: value,
          isActive: true, // Mark category as active
        },
      };
      
      // Remove property if value is null/empty
      if (!value) {
        delete updatedDesign[category]![property as keyof typeof categoryData];
      }
      
      // 2. Convert to Tailwind class
      const newClass = value ? propertyToClass(category, property, value) : null;
      
      // 3. Get existing classes as array
      const existingClasses = Array.isArray(layer.classes)
        ? layer.classes
        : (layer.classes || '').split(' ').filter(Boolean);
      
      // 4. Replace conflicting classes
      const updatedClasses = replaceConflictingClasses(
        existingClasses,
        property,
        newClass
      );
      
      // 5. Update layer with both design object and classes
      console.log('🎨 [use-design-sync] updateDesignProperty:', {
        layerId: layer.id,
        category,
        property,
        value,
        newClass,
        existingClasses,
        updatedClasses,
        updatedClassesString: updatedClasses.join(' '),
      });
      
      onLayerUpdate(layer.id, {
        design: updatedDesign,
        classes: updatedClasses.join(' '),
      });
    },
    [layer, onLayerUpdate]
  );
  
  /**
   * Update multiple design properties at once
   */
  const updateDesignProperties = useCallback(
    (updates: {
      category: keyof NonNullable<Layer['design']>;
      property: string;
      value: string | null;
    }[]) => {
      if (!layer) return;
      
      let currentClasses = Array.isArray(layer.classes)
        ? [...layer.classes]
        : (layer.classes || '').split(' ').filter(Boolean);
      
      const currentDesign = layer.design || {};
      const updatedDesign = { ...currentDesign };
      
      // Process all updates
      updates.forEach(({ category, property, value }) => {
        // Update design object
        const categoryData = updatedDesign[category] || {};
        updatedDesign[category] = {
          ...categoryData,
          [property]: value,
          isActive: true,
        };
        
        if (!value) {
          delete updatedDesign[category]![property as keyof typeof categoryData];
        }
        
        // Update classes
        const newClass = value ? propertyToClass(category, property, value) : null;
        currentClasses = replaceConflictingClasses(
          currentClasses,
          property,
          newClass
        );
      });
      
      // Apply all updates at once
      onLayerUpdate(layer.id, {
        design: updatedDesign,
        classes: currentClasses.join(' '),
      });
    },
    [layer, onLayerUpdate]
  );
  
  /**
   * Get current value for a design property
   */
  const getDesignProperty = useCallback(
    (category: keyof NonNullable<Layer['design']>, property: string): string | undefined => {
      if (!layer?.design?.[category]) return undefined;
      const categoryData = layer.design[category] as Record<string, any>;
      return categoryData[property];
    },
    [layer]
  );
  
  /**
   * Reset a design category (remove all properties and related classes)
   */
  const resetDesignCategory = useCallback(
    (category: keyof NonNullable<Layer['design']>) => {
      if (!layer) return;
      
      const currentDesign = layer.design || {};
      const categoryData = currentDesign[category];
      
      if (!categoryData) return;
      
      // Get all properties in this category (except isActive)
      const properties = Object.keys(categoryData).filter(key => key !== 'isActive');
      
      // Remove all conflicting classes
      let currentClasses = Array.isArray(layer.classes)
        ? [...layer.classes]
        : (layer.classes || '').split(' ').filter(Boolean);
      
      properties.forEach(property => {
        currentClasses = replaceConflictingClasses(currentClasses, property, null);
      });
      
      // Remove category from design object
      const updatedDesign = { ...currentDesign };
      delete updatedDesign[category];
      
      onLayerUpdate(layer.id, {
        design: updatedDesign,
        classes: currentClasses.join(' '),
      });
    },
    [layer, onLayerUpdate]
  );
  
  /**
   * Sync classes back to design object
   * Useful when classes are manually edited
   */
  const syncClassesToDesign = useCallback(
    (classes: string) => {
      if (!layer) return;
      
      // For now, we keep the existing design object
      // and only update classes
      // Full bidirectional sync can be added later if needed
      
      onLayerUpdate(layer.id, {
        classes,
      });
    },
    [layer, onLayerUpdate]
  );
  
  return {
    updateDesignProperty,
    updateDesignProperties,
    getDesignProperty,
    resetDesignCategory,
    syncClassesToDesign,
  };
}

