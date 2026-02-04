import { useCallback, useMemo } from 'react';

type DesignCategory = 'spacing' | 'layout' | 'borders' | 'typography' | 'sizing' | 'backgrounds' | 'effects' | 'positioning';

type ModeToggleConfig = {
  category: DesignCategory;
  unifiedProperty: string;
  individualProperties: string[];
  modeProperty?: string; // Property name to store the mode preference (e.g., 'marginMode', 'paddingMode')
  updateDesignProperty: (category: DesignCategory, property: string, value: string | null) => void;
  updateDesignProperties: (updates: { category: DesignCategory; property: string; value: string | null }[]) => void;
  getCurrentValue: (property: string) => string;
};

/**
 * Hook to manage unified/individual mode toggle for design properties
 * Handles value transfer between modes and prevents empty inputs
 * 
 * Mode is derived from:
 * 1. Stored mode preference (modeProperty) - highest priority
 * 2. Auto-detection based on current values - fallback
 */
export function useModeToggle(config: ModeToggleConfig) {
  const {
    category,
    unifiedProperty,
    individualProperties,
    modeProperty,
    updateDesignProperty,
    updateDesignProperties,
    getCurrentValue,
  } = config;

  // Derive mode during render (no state or effects needed)
  const mode = useMemo((): 'all' | 'individual' => {
    // Check for stored mode preference first (persisted in layer design)
    if (modeProperty) {
      const storedMode = getCurrentValue(modeProperty) as 'all' | 'individual' | '';
      if (storedMode === 'all' || storedMode === 'individual') {
        return storedMode;
      }
    }

    // Auto-detect based on current values
    const unifiedValue = getCurrentValue(unifiedProperty);
    const individualValues = individualProperties.map(prop => getCurrentValue(prop)).filter(Boolean);

    // If individual properties are set (and no unified), show individual mode
    if (individualValues.length > 0 && !unifiedValue) {
      return 'individual';
    }

    // Default to unified mode
    return 'all';
  }, [unifiedProperty, individualProperties, modeProperty, getCurrentValue]);

  // Helper function to find most common value
  const findMostCommonValue = useCallback((values: string[]): string | null => {
    if (values.length === 0) return null;
    const frequency: Record<string, number> = {};
    values.forEach(v => frequency[v] = (frequency[v] || 0) + 1);
    return Object.entries(frequency).sort((a, b) => b[1] - a[1])[0][0];
  }, []);

  // Handle mode toggle
  const handleToggle = useCallback(() => {
    const newMode = mode === 'all' ? 'individual' : 'all';
    
    // Update properties
    if (newMode === 'all') {
      // Individual → Unified: use most common value
      const individualValues = individualProperties
        .map(prop => getCurrentValue(prop))
        .filter(Boolean);
      
      const mostCommon = findMostCommonValue(individualValues);
      const updates = [];
      
      if (mostCommon) {
        // Set unified property
        updates.push({
          category,
          property: unifiedProperty,
          value: mostCommon,
        });
        // Clear individual properties
        updates.push(...individualProperties.map(prop => ({
          category,
          property: prop,
          value: null,
        })));
      }
      
      // Save mode preference if modeProperty is provided
      if (modeProperty) {
        updates.push({
          category,
          property: modeProperty,
          value: 'all',
        });
      }
      
      if (updates.length > 0) {
        updateDesignProperties(updates);
      }
    } else {
      // Unified → Individual: populate all with unified value (or allow empty start)
      const unifiedValue = getCurrentValue(unifiedProperty);
      const updates = [];
      
      if (unifiedValue) {
        // Set individual properties
        updates.push(...individualProperties.map(prop => ({
          category,
          property: prop,
          value: unifiedValue,
        })));
        // Clear unified property
        updates.push({
          category,
          property: unifiedProperty,
          value: null,
        });
      }
      
      // Save mode preference if modeProperty is provided
      if (modeProperty) {
        updates.push({
          category,
          property: modeProperty,
          value: 'individual',
        });
      }
      
      if (updates.length > 0) {
        updateDesignProperties(updates);
      } else if (modeProperty) {
        // No value updates but save the mode preference
        updateDesignProperty(category, modeProperty, 'individual');
      }
    }
  }, [
    mode,
    category,
    unifiedProperty,
    individualProperties,
    modeProperty,
    updateDesignProperty,
    updateDesignProperties,
    getCurrentValue,
    findMostCommonValue,
  ]);

  // Dummy setMode for backwards compatibility (mode is now derived)
  const setMode = useCallback((_newMode: 'all' | 'individual') => {
    // Mode is derived from values/preferences, direct setting not supported
    // Use handleToggle or update modeProperty via updateDesignProperty instead
  }, []);

  return {
    mode,
    setMode,
    handleToggle,
  };
}
