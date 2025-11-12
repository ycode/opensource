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

/**
 * Date Formatting Utilities
 */

/**
 * Format a date string or Date object using a custom format string
 * 
 * Supported tokens:
 * - YYYY: 4-digit year (2025)
 * - YY: 2-digit year (25)
 * - MMMM: Full month name (November)
 * - MMM: Short month name (Nov)
 * - MM: 2-digit month (11)
 * - M: Month (11)
 * - DD: 2-digit day (12)
 * - D: Day (12)
 * - dddd: Full day name (Wednesday)
 * - ddd: Short day name (Wed)
 * - HH: 2-digit hour 24h (09)
 * - H: Hour 24h (9)
 * - hh: 2-digit hour 12h (09)
 * - h: Hour 12h (9)
 * - mm: 2-digit minutes (38)
 * - m: Minutes (38)
 * - ss: 2-digit seconds (05)
 * - s: Seconds (5)
 * - A: AM/PM
 * - a: am/pm
 * 
 * @param date - Date string (ISO format) or Date object
 * @param format - Format string using tokens (default: 'MMM D YYYY, HH:mm')
 * @returns Formatted date string
 * 
 * @example
 * formatDate('2025-11-12T09:38:45.000Z', 'MMM D YYYY, HH:mm') // 'Nov 12 2025, 09:38'
 * formatDate(new Date(), 'YYYY-MM-DD') // '2025-11-12'
 * formatDate(date, 'dddd, MMMM D, YYYY') // 'Wednesday, November 12, 2025'
 * formatDate(date, 'MM/DD/YYYY hh:mm A') // '11/12/2025 09:38 AM'
 */
export function formatDate(date: string | Date | null | undefined, format: string = 'MMM D YYYY, HH:mm'): string {
  if (!date) return '-';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Check if date is valid
  if (isNaN(dateObj.getTime())) return '-';
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const daysFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  const day = dateObj.getDate();
  const hours = dateObj.getHours();
  const minutes = dateObj.getMinutes();
  const seconds = dateObj.getSeconds();
  const dayOfWeek = dateObj.getDay();
  
  // Helper to pad numbers
  const pad = (num: number) => String(num).padStart(2, '0');
  
  // Convert to 12-hour format
  const hours12 = hours % 12 || 12;
  const isPM = hours >= 12;
  
  // Token replacements
  const tokens: Record<string, string> = {
    'YYYY': String(year),
    'YY': String(year).slice(-2),
    'MMMM': monthsFull[month],
    'MMM': months[month],
    'MM': pad(month + 1),
    'M': String(month + 1),
    'DD': pad(day),
    'D': String(day),
    'dddd': daysFull[dayOfWeek],
    'ddd': days[dayOfWeek],
    'HH': pad(hours),
    'H': String(hours),
    'hh': pad(hours12),
    'h': String(hours12),
    'mm': pad(minutes),
    'm': String(minutes),
    'ss': pad(seconds),
    's': String(seconds),
    'A': isPM ? 'PM' : 'AM',
    'a': isPM ? 'pm' : 'am',
  };
  
  // Replace tokens in format string
  let result = format;
  
  // Sort by length (longest first) to avoid partial replacements
  const sortedTokens = Object.keys(tokens).sort((a, b) => b.length - a.length);
  
  for (const token of sortedTokens) {
    result = result.replace(new RegExp(token, 'g'), tokens[token]);
  }
  
  return result;
}

/**
 * Format a relative time string (e.g., "2 hours ago", "just now")
 * 
 * @param date - Date string (ISO format) or Date object
 * @returns Relative time string
 * 
 * @example
 * formatRelativeTime(new Date()) // 'just now'
 * formatRelativeTime('2025-11-11T09:38:45.000Z') // '2 hours ago'
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return '-';
  
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);
  
  if (diffSecs < 10) return 'just now';
  if (diffSecs < 60) return `${diffSecs} seconds ago`;
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 30) return `${diffDays} days ago`;
  if (diffMonths === 1) return '1 month ago';
  if (diffMonths < 12) return `${diffMonths} months ago`;
  if (diffYears === 1) return '1 year ago';
  return `${diffYears} years ago`;
}
