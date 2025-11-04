import { useState, useCallback, useEffect, useRef } from 'react';

type DesignCategory = 'spacing' | 'layout' | 'borders' | 'typography' | 'sizing' | 'backgrounds' | 'effects' | 'positioning';

type ModeToggleConfig = {
  category: DesignCategory;
  unifiedProperty: string;
  individualProperties: string[];
  updateDesignProperty: (category: DesignCategory, property: string, value: string | null) => void;
  updateDesignProperties: (updates: { category: DesignCategory; property: string; value: string | null }[]) => void;
  getCurrentValue: (property: string) => string;
};

/**
 * Hook to manage unified/individual mode toggle for design properties
 * Handles value transfer between modes and prevents empty inputs
 */
export function useModeToggle(config: ModeToggleConfig) {
  const {
    category,
    unifiedProperty,
    individualProperties,
    updateDesignProperty,
    updateDesignProperties,
    getCurrentValue,
  } = config;

  const [mode, setMode] = useState<'all-borders' | 'individual-borders'>('all-borders');
  const pendingModeChangeRef = useRef<'all-borders' | 'individual-borders' | null>(null);

  // Auto-detect mode based on which properties are set
  useEffect(() => {
    const unifiedValue = getCurrentValue(unifiedProperty);
    const individualValues = individualProperties.map(prop => getCurrentValue(prop)).filter(Boolean);
    
    // If we have a pending mode change, check if the properties are ready for it
    if (pendingModeChangeRef.current) {
      const targetMode = pendingModeChangeRef.current;
      
      if (targetMode === 'individual-borders' && individualValues.length > 0) {
        // Properties are ready, switch to individual mode
        setMode('individual-borders');
        pendingModeChangeRef.current = null;
      } else if (targetMode === 'all-borders' && unifiedValue && individualValues.length === 0) {
        // Properties are ready, switch to unified mode
        setMode('all-borders');
        pendingModeChangeRef.current = null;
      }
      return;
    }
    
    // Normal auto-detection when no pending change
    // If any individual properties are set, switch to individual mode
    if (individualValues.length > 0 && !unifiedValue) {
      setMode('individual-borders');
    }
    // If only unified property is set, switch to unified mode
    else if (unifiedValue && individualValues.length === 0) {
      setMode('all-borders');
    }
  }, [unifiedProperty, individualProperties, getCurrentValue, mode]);

  // Helper function to find most common value
  const findMostCommonValue = useCallback((values: string[]): string | null => {
    if (values.length === 0) return null;
    const frequency: Record<string, number> = {};
    values.forEach(v => frequency[v] = (frequency[v] || 0) + 1);
    return Object.entries(frequency).sort((a, b) => b[1] - a[1])[0][0];
  }, []);

  // Handle mode toggle
  const handleToggle = useCallback(() => {
    const newMode = mode === 'all-borders' ? 'individual-borders' : 'all-borders';
    
    // Set pending mode change - useEffect will complete it when properties are ready
    pendingModeChangeRef.current = newMode;
    
    // Update properties - when they update, useEffect will detect and switch mode
    if (newMode === 'all-borders') {
      // Individual → Unified: use most common value
      const individualValues = individualProperties
        .map(prop => getCurrentValue(prop))
        .filter(Boolean);
      
      const mostCommon = findMostCommonValue(individualValues);
      if (mostCommon) {
        // Update all properties in ONE call: set unified + clear individual
        updateDesignProperties([
          // Set unified property
          {
            category,
            property: unifiedProperty,
            value: mostCommon,
          },
          // Clear individual properties
          ...individualProperties.map(prop => ({
            category,
            property: prop,
            value: null,
          }))
        ]);
      }
    } else {
      // Unified → Individual: populate all with unified value
      const unifiedValue = getCurrentValue(unifiedProperty);
      
      if (unifiedValue) {
        // Update all properties in ONE call: set individual + clear unified
        updateDesignProperties([
          // Set individual properties
          ...individualProperties.map(prop => ({
            category,
            property: prop,
            value: unifiedValue,
          })),
          // Clear unified property
          {
            category,
            property: unifiedProperty,
            value: null,
          }
        ]);
      }
    }
  }, [
    mode,
    category,
    unifiedProperty,
    individualProperties,
    updateDesignProperty,
    updateDesignProperties,
    getCurrentValue,
    findMostCommonValue,
  ]);

  return {
    mode,
    setMode,
    handleToggle,
  };
}

