/**
 * Design Sync Hook
 *
 * Manages bidirectional sync between layer.design object and Tailwind classes
 * Supports breakpoint-aware class application for responsive design
 */

import { useCallback, useMemo, useRef, useEffect } from 'react';
import debounce from 'lodash.debounce';
import type { Layer, UIState, Breakpoint } from '@/types';
import {
  propertyToClass,
  replaceConflictingClasses,
  designToClasses,
  setBreakpointClass,
  getInheritedValue,
  getConflictingClassPattern,
} from '@/lib/tailwind-class-mapper';
import { updateStyledLayer } from '@/lib/layer-style-utils';

interface UseDesignSyncProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  activeBreakpoint?: Breakpoint; // Optional for backward compatibility
  activeUIState?: UIState; // Optional UI state for state-specific styling
}

export function useDesignSync({
  layer,
  onLayerUpdate,
  activeBreakpoint = 'desktop',
  activeUIState = 'neutral'
}: UseDesignSyncProps) {
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

      // 4. Apply breakpoint-aware class replacement with UI state support
      // Uses setBreakpointClass which applies correct prefix (desktop → '', tablet → 'max-lg:', mobile → 'max-md:')
      // and state prefix (neutral → '', hover → 'hover:', etc.)
      const updatedClasses = setBreakpointClass(
        existingClasses,
        property,
        newClass,
        activeBreakpoint,
        activeUIState
      );

      // 5. Update layer with both design object and classes
      // If layer has a style applied, track changes as overrides
      // Note: Use join instead of cn() because setBreakpointClass already handles
      // property-aware conflict resolution
      const finalUpdate = updateStyledLayer(layer, {
        design: updatedDesign,
        classes: updatedClasses.join(' '),
      });

      onLayerUpdate(layer.id, finalUpdate);
    },
    [layer, onLayerUpdate, activeBreakpoint, activeUIState]
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

        // Update classes with breakpoint and UI state awareness
        const newClass = value ? propertyToClass(category, property, value) : null;
        currentClasses = setBreakpointClass(
          currentClasses,
          property,
          newClass,
          activeBreakpoint,
          activeUIState
        );
      });

      // Apply all updates at once
      // Note: Use join instead of cn() because setBreakpointClass already handles
      // property-aware conflict resolution
      onLayerUpdate(layer.id, {
        design: updatedDesign,
        classes: currentClasses.join(' '),
      });
    },
    [layer, onLayerUpdate, activeBreakpoint, activeUIState]
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
        // Fallback to design object if no classes at all
        if (!layer.design?.[category]) return undefined;
        const categoryData = layer.design[category] as Record<string, any>;
        return categoryData[property];
      }

      // Use inheritance to get the value that will actually apply (desktop → tablet → mobile)
      // with UI state support (checks state-specific classes first, then falls back to neutral)
      const { value: inheritedClass } = getInheritedValue(classes, property, activeBreakpoint, activeUIState);

      if (!inheritedClass) {
        // CRITICAL: Do NOT fall back to design object here
        // If getInheritedValue returns null, it means:
        // 1. No neutral/base class exists for this property
        // 2. AND we're in neutral state (where state-specific classes are ignored)
        // This is correct behavior - the input should be empty
        //
        // The design object might have corrupted values from before the classesToDesign fix,
        // so we should only trust the classes as the source of truth
        return undefined;
      }

      // Parse the inherited class to extract the actual value
      const arbitraryMatch = inheritedClass.match(/\[([^\]]+)\]/);
      if (arbitraryMatch) {
        return arbitraryMatch[1];
      }

      return mapClassToDesignValue(inheritedClass, property);
    },
    [layer, activeBreakpoint, activeUIState]
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

      // Note: Use join instead of cn() because replaceConflictingClasses already handles
      // property-aware conflict resolution
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

  /**
   * Debounced version of updateDesignProperty for text inputs
   * Use this for inputs where users type values (e.g., spacing, sizing)
   * to avoid flooding the canvas with updates on every keystroke
   * 
   * IMPORTANT: This implementation avoids stale closure issues by:
   * 1. Using a ref to always access the latest updateDesignProperty
   * 2. Cancelling pending calls when the layer changes
   * 3. Cleaning up on unmount
   */
  
  // Store the latest updateDesignProperty in a ref to avoid stale closures
  const updateDesignPropertyRef = useRef(updateDesignProperty);
  updateDesignPropertyRef.current = updateDesignProperty;
  
  // Track the current layer ID to detect layer changes
  const currentLayerIdRef = useRef(layer?.id);
  
  // Create a stable debounced function that always calls the latest updateDesignProperty
  const debouncedFnRef = useRef(
    debounce(
      (
        category: keyof NonNullable<Layer['design']>,
        property: string,
        value: string | null
      ) => {
        updateDesignPropertyRef.current(category, property, value);
      },
      150
    )
  );
  
  // Cancel pending debounced calls when layer changes to prevent stale updates
  useEffect(() => {
    if (currentLayerIdRef.current !== layer?.id) {
      // Layer changed - cancel any pending debounced calls
      debouncedFnRef.current.cancel();
      currentLayerIdRef.current = layer?.id;
    }
  }, [layer?.id]);
  
  // Cleanup on unmount
  useEffect(() => {
    const debouncedFn = debouncedFnRef.current;
    return () => {
      debouncedFn.cancel();
    };
  }, []);
  
  // Return a stable wrapper function
  const debouncedUpdateDesignProperty = useCallback(
    (
      category: keyof NonNullable<Layer['design']>,
      property: string,
      value: string | null
    ) => {
      debouncedFnRef.current(category, property, value);
    },
    []
  );

  return {
    updateDesignProperty,
    updateDesignProperties,
    debouncedUpdateDesignProperty,
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
  // Remove any breakpoint and state prefixes
  const cleanClass = className.replace(/^(max-lg:|max-md:|lg:|md:)?(hover:|focus:|active:|disabled:|visited:)?/, '');

  // Special cases for properties where classes don't have dashes or are complete values
  const noSplitProperties = [
    'position',        // static, absolute, relative, fixed, sticky
    'display',         // block, inline, flex, grid, hidden (some have dashes like inline-block)
    'textTransform',   // uppercase, lowercase, capitalize, normal-case
    'textDecoration',  // underline, overline, line-through, no-underline
  ];

  if (noSplitProperties.includes(property)) {
    return cleanClass;
  }

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
    flexDirection: {
      'row': 'row',
      'col': 'column',
      'row-reverse': 'row-reverse',
      'col-reverse': 'column-reverse',
    },
    flexWrap: {
      'wrap': 'wrap',
      'wrap-reverse': 'wrap-reverse',
      'nowrap': 'nowrap',
    },
  };

  // Check if we have a named mapping for this property
  if (namedMappings[property]?.[value]) {
    return namedMappings[property][value];
  }

  return value;
}
