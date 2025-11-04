/**
 * Design Sync Hook
 * 
 * Manages bidirectional sync between layer.design object and Tailwind classes
 * Supports breakpoint-aware class application for responsive design
 */

import { useCallback, useMemo } from 'react';
import type { Layer } from '@/types';
import {
  propertyToClass,
  replaceConflictingClasses,
  designToClasses,
  setBreakpointClass,
  getInheritedValue,
  getConflictingClassPattern,
  type Breakpoint,
} from '@/lib/tailwind-class-mapper';

interface UseDesignSyncProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  activeBreakpoint?: Breakpoint; // Optional for backward compatibility
}

export function useDesignSync({ layer, onLayerUpdate, activeBreakpoint = 'desktop' }: UseDesignSyncProps) {
  /**
   * Update a single design property and sync to classes
   * Applies breakpoint-aware class prefixes based on active viewport
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
      
      // 4. Apply breakpoint-aware class replacement
      // Uses setBreakpointClass which applies correct prefix (desktop → '', tablet → 'max-lg:', mobile → 'max-md:')
      const updatedClasses = setBreakpointClass(
        existingClasses,
        property,
        newClass,
        activeBreakpoint
      );
      
      // 5. Update layer with both design object and classes
      console.log('🎨 [use-design-sync] updateDesignProperty:', {
        layerId: layer.id,
        category,
        property,
        value,
        newClass,
        activeBreakpoint,
        existingClasses,
        updatedClasses,
        updatedClassesString: updatedClasses.join(' '),
      });
      
      onLayerUpdate(layer.id, {
        design: updatedDesign,
        classes: updatedClasses.join(' '),
      });
    },
    [layer, onLayerUpdate, activeBreakpoint]
  );
  
  /**
   * Update multiple design properties at once
   * Applies breakpoint-aware class prefixes based on active viewport
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
        
        // Update classes with breakpoint awareness
        const newClass = value ? propertyToClass(category, property, value) : null;
        currentClasses = setBreakpointClass(
          currentClasses,
          property,
          newClass,
          activeBreakpoint
        );
      });
      
      // Apply all updates at once
      onLayerUpdate(layer.id, {
        design: updatedDesign,
        classes: currentClasses.join(' '),
      });
    },
    [layer, onLayerUpdate, activeBreakpoint]
  );
  
  /**
   * Get current value for a design property
   * @param category - Design category (e.g., 'typography', 'sizing')
   * @param property - Property name (e.g., 'fontSize', 'width')
   * @returns The value that will actually apply (follows CSS cascade/inheritance)
   */
  const getDesignProperty = useCallback(
    (
      category: keyof NonNullable<Layer['design']>, 
      property: string
    ): string | undefined => {
      if (!layer) return undefined;
      
      // Get classes as array
      const classes = Array.isArray(layer.classes)
        ? layer.classes
        : (layer.classes || '').split(' ').filter(Boolean);
      
      if (classes.length === 0) {
        // Fallback to design object if no classes
        if (!layer.design?.[category]) return undefined;
        const categoryData = layer.design[category] as Record<string, any>;
        return categoryData[property];
      }
      
      // Use inheritance to get the value that will actually apply (desktop → tablet → mobile)
      const { value: inheritedClass } = getInheritedValue(classes, property, activeBreakpoint);
      
      if (!inheritedClass) {
        // Final fallback to design object
        if (!layer.design?.[category]) return undefined;
        const categoryData = layer.design[category] as Record<string, any>;
        return categoryData[property];
      }
      
      // Parse the inherited class to extract the actual value
      const arbitraryMatch = inheritedClass.match(/\[([^\]]+)\]/);
      if (arbitraryMatch) {
        return arbitraryMatch[1];
      }
      
      return mapClassToDesignValue(inheritedClass, property);
    },
    [layer, activeBreakpoint]
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

/**
 * Helper function to map Tailwind class back to design value
 * e.g., "text-3xl" → "3xl", "font-bold" → "700", "bg-blue-500" → "#3b82f6"
 */
function mapClassToDesignValue(className: string, property: string): string | undefined {
  // Remove any breakpoint prefix
  const cleanClass = className.replace(/^(max-lg:|max-md:|lg:|md:)/, '');
  
  // Extract the value part after the property prefix
  // e.g., "text-3xl" → "3xl", "font-bold" → "bold", "w-full" → "full"
  const parts = cleanClass.split('-');
  if (parts.length < 2) return undefined;
  
  // Join everything after the first part (e.g., "text-center" → "center", "bg-blue-500" → "blue-500")
  const value = parts.slice(1).join('-');
  
  // Special mappings for named values
  const namedMappings: Record<string, Record<string, string>> = {
    fontWeight: {
      'thin': '100',
      'extralight': '200',
      'light': '300',
      'normal': '400',
      'medium': '500',
      'semibold': '600',
      'bold': '700',
      'extrabold': '800',
      'black': '900',
    },
    fontSize: {
      'xs': '0.75rem',
      'sm': '0.875rem',
      'base': '1rem',
      'lg': '1.125rem',
      'xl': '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
      '6xl': '3.75rem',
      '7xl': '4.5rem',
      '8xl': '6rem',
      '9xl': '8rem',
    },
  };
  
  // Check if we have a named mapping for this property
  if (namedMappings[property]?.[value]) {
    return namedMappings[property][value];
  }
  
  return value;
}

