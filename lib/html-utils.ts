/**
 * HTML Utilities
 *
 * Utilities for working with HTML elements and attributes
 */

/**
 * Sanitize a string to create a valid HTML ID
 * - Replaces spaces with hyphens
 * - Replaces invalid characters with hyphens (only allows letters, numbers, hyphens, underscores, colons, periods)
 * - Preserves uppercase and lowercase letters
 * - Allows leading numbers and hyphens
 * - Allows trailing hyphens
 *
 * Valid HTML ID characters: letters (a-z, A-Z), digits (0-9), hyphens (-), underscores (_), colons (:), periods (.)
 *
 * @param value - The input value to sanitize
 * @returns Valid HTML ID string
 *
 * @example
 * sanitizeHtmlId('My Button') // 'My-Button'
 * sanitizeHtmlId('Hero Section 1') // 'Hero-Section-1'
 * sanitizeHtmlId('123 Test') // '123-Test'
 * sanitizeHtmlId('Header@Main!') // 'Header-Main-'
 * sanitizeHtmlId('Section:1.2') // 'Section:1.2'
 * sanitizeHtmlId('-123-') // '-123-'
 */
export function sanitizeHtmlId(value: string): string {
  if (!value) return '';

  return value
    // Replace spaces with hyphens
    .replace(/\s+/g, '-')
    // Replace invalid characters with hyphens (keep only letters, numbers, hyphens, underscores, colons, periods)
    .replace(/[^a-zA-Z0-9\-_:.]/g, '-')
    // Replace multiple consecutive hyphens with single hyphen
    .replace(/-+/g, '-');
}
