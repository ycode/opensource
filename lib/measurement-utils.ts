/**
 * Measurement Utilities
 * 
 * Helpers for handling CSS measurement values (px, rem, em, %, etc.)
 */

/**
 * Extract value from design property for display in inputs
 * Strips 'px' unit only (since it's the default), keeps all other units
 * 
 * @param value - The stored value (e.g., "100px", "10rem", "50%")
 * @returns Value for display in input (e.g., "100", "10rem", "50%")
 * 
 * @example
 * extractMeasurementValue("100px") // "100"
 * extractMeasurementValue("10rem") // "10rem"
 * extractMeasurementValue("50%") // "50%"
 * extractMeasurementValue("auto") // "auto"
 */
export function extractMeasurementValue(value: string): string {
  if (!value) return '';
  
  // Special values that don't need processing
  const specialValues = ['auto', 'full', 'screen', 'fit', 'min', 'max'];
  if (specialValues.includes(value)) return value;
  
  // Strip 'px' unit only (for easy editing)
  // Keep all other units like rem, em, %, vw, vh, etc.
  if (value.endsWith('px')) {
    return value.slice(0, -2);
  }
  
  return value;
}

/**
 * Format a measurement value (no-op, kept for compatibility)
 * The value is stored exactly as typed, tailwind-class-mapper handles px defaults
 * 
 * @param value - The value from the input
 * @returns The value to store (exactly as typed)
 * 
 * @example
 * formatMeasurementValue("100") // "100"
 * formatMeasurementValue("100px") // "100px"
 * formatMeasurementValue("10rem") // "10rem"
 */
export function formatMeasurementValue(value: string): string | null {
  if (!value) return null;
  return value;
}

