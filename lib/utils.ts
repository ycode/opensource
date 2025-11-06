import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility for merging Tailwind CSS classes intelligently
 * Combines clsx (conditional classes) with tailwind-merge (conflict resolution)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Input Sanitization Utilities
 * Centralized helpers for cleaning user input values
 */

export type SanitizeOptions = {
  /** Remove all whitespace characters (default: true) */
  removeSpaces?: boolean;
  /** Remove leading/trailing whitespace only (default: false) */
  trim?: boolean;
  /** Convert to lowercase (default: false) */
  lowercase?: boolean;
  /** Remove specific characters via regex (default: null) */
  removePattern?: RegExp;
}

/**
 * Sanitize input value for design properties
 * Default: Removes all spaces to prevent invalid Tailwind classes
 * 
 * @param value - The input value to sanitize
 * @param options - Optional sanitization configuration
 * @returns Sanitized value
 * 
 * @example
 * sanitizeInput('10 rem') // '10rem'
 * sanitizeInput('  100px  ', { trim: true, removeSpaces: false }) // '100px'
 * sanitizeInput('#FF 00 00') // '#FF0000'
 */
export function sanitizeInput(value: string, options: SanitizeOptions = {}): string {
  const {
    removeSpaces = true,
    trim = false,
    lowercase = false,
    removePattern = null
  } = options;

  let sanitized = value;

  // Remove spaces (default behavior for Tailwind classes)
  if (removeSpaces) {
    sanitized = sanitized.replace(/\s+/g, '');
  }

  // Trim only (alternative to removing all spaces)
  if (trim && !removeSpaces) {
    sanitized = sanitized.trim();
  }

  // Convert to lowercase
  if (lowercase) {
    sanitized = sanitized.toLowerCase();
  }

  // Remove custom pattern
  if (removePattern) {
    sanitized = sanitized.replace(removePattern, '');
  }

  return sanitized;
}

/**
 * Quick helper: Remove all spaces from value
 * Common use case for Tailwind class values
 * 
 * @param value - The input value
 * @returns Value without any spaces
 */
export function removeSpaces(value: string): string {
  return sanitizeInput(value, { removeSpaces: true });
}
