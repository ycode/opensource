import { useState, useCallback, useEffect, useRef } from 'react';

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

  const [mode, setMode] = useState<'all' | 'individual'>(() => {
    // Initialize from stored mode preference if available
    if (modeProperty) {
      const storedMode = getCurrentValue(modeProperty) as 'all' | 'individual' | '';
      if (storedMode === 'all' || storedMode === 'individual') {
        return storedMode;
      }
    }
    
    // Fall back to auto-detection
    const unifiedValue = getCurrentValue(unifiedProperty);
    const individualValues = individualProperties.map(prop => getCurrentValue(prop)).filter(Boolean);
    
    if (individualValues.length > 0 && !unifiedValue) {
      return 'individual';
    }
    return 'all';
  });

  const pendingModeChangeRef = useRef<'all' | 'individual' | null>(null);

  // Auto-detect mode based on which properties are set (only if no stored preference)
  useEffect(() => {
    const unifiedValue = getCurrentValue(unifiedProperty);
    const individualValues = individualProperties.map(prop => getCurrentValue(prop)).filter(Boolean);
    
    // If we have a stored mode preference, respect it and don't auto-detect
    if (modeProperty) {
      const storedMode = getCurrentValue(modeProperty) as 'all' | 'individual' | '';
      if (storedMode === 'all' || storedMode === 'individual') {
        if (mode !== storedMode) {
          setMode(storedMode);
        }
        return;
      }
    }
    
    // If we have a pending mode change, check if the properties are ready for it
    if (pendingModeChangeRef.current) {
      const targetMode = pendingModeChangeRef.current;
      
      if (targetMode === 'individual') {
        // Switch to individual mode (with or without values)
        setMode('individual');
        pendingModeChangeRef.current = null;
      } else if (targetMode === 'all' && unifiedValue && individualValues.length === 0) {
        // Properties are ready, switch to unified mode
        setMode('all');
        pendingModeChangeRef.current = null;
      }
      return;
    }
    
    // Normal auto-detection when no pending change and no stored preference
    // If any individual properties are set, switch to individual mode
    if (individualValues.length > 0 && !unifiedValue) {
      setMode('individual');
    }
    // If only unified property is set, switch to unified mode
    else if (unifiedValue && individualValues.length === 0) {
      setMode('all');
    }
    // If no values at all and currently in unified mode, stay in unified mode
    // Don't auto-switch away from individual mode if user manually toggled to it
    else if (!unifiedValue && individualValues.length === 0 && mode === 'all') {
      setMode('all');
    }
  }, [unifiedProperty, individualProperties, modeProperty, getCurrentValue, mode]);

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
    
    // Set pending mode change - useEffect will complete it when properties are ready
    pendingModeChangeRef.current = newMode;
    
    // Update properties - when they update, useEffect will detect and switch mode
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
      } else {
        // If no updates, just switch mode
        setMode('all');
        pendingModeChangeRef.current = null;
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
      } else {
        // No unified value - just switch to individual mode with empty inputs
        setMode('individual');
        pendingModeChangeRef.current = null;
        
        // Still save the mode preference
        if (modeProperty) {
          updateDesignProperty(category, modeProperty, 'individual');
        }
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

  return {
    mode,
    setMode,
    handleToggle,
  };
}
