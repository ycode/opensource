/**
 * Custom hook for controlled inputs that need to sync with external state
 * while maintaining local state during editing to prevent flickering.
 * 
 * This solves the "input repopulation bug" where typing gets overwritten
 * by async state updates from the layer classes.
 * 
 * @example
 * ```typescript
 * const fontSize = getDesignProperty('typography', 'fontSize') || '';
 * const [fontSizeInput, setFontSizeInput] = useControlledInput(fontSize, extractValue);
 * 
 * <Input 
 *   value={fontSizeInput} 
 *   onChange={(e) => {
 *     setFontSizeInput(e.target.value);
 *     updateDesignProperty('typography', 'fontSize', e.target.value);
 *   }}
 * />
 * ```
 */

import { useState, useEffect } from 'react';

/**
 * Hook for controlled input state that syncs with external value
 * 
 * @param externalValue - The value from layer/design property
 * @param transform - Optional transform function to extract/format the value (e.g., extractValue)
 * @returns [localValue, setLocalValue] - Tuple of local state and setter
 */
export function useControlledInput(
  externalValue: string | undefined,
  transform?: (value: string) => string
): [string, (value: string) => void] {
  const [localValue, setLocalValue] = useState('');

  // Sync local state when external value changes (e.g., undo/redo, breakpoint switch)
  useEffect(() => {
    const valueToSet = externalValue || '';
    const transformedValue = transform ? transform(valueToSet) : valueToSet;
    setLocalValue(transformedValue);
  }, [externalValue, transform]);

  return [localValue, setLocalValue];
}

/**
 * Hook for multiple controlled inputs (batch version)
 * Useful when you have many related inputs
 * 
 * @param values - Object mapping keys to external values
 * @param transform - Optional transform function
 * @returns Object with same keys mapped to [value, setValue] tuples
 */
export function useControlledInputs<T extends Record<string, string | undefined>>(
  values: T,
  transform?: (value: string) => string
): Record<keyof T, [string, (value: string) => void]> {
  const result = {} as Record<keyof T, [string, (value: string) => void]>;

  for (const key in values) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    result[key] = useControlledInput(values[key], transform);
  }

  return result;
}

