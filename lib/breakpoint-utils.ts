import type { Breakpoint } from '@/types';

export interface BreakpointConfig {
  value: Breakpoint;
  label: string;
  prefix: string;
  maxWidth: number | null;
}

/**
 * All available breakpoints with labels and Tailwind config (Desktop-First)
 * Desktop is base (no prefix), tablet and mobile use max-width overrides
 */
export const BREAKPOINTS: BreakpointConfig[] = [
  { value: 'mobile', label: 'Mobile', prefix: 'max-md:', maxWidth: 767 },
  { value: 'tablet', label: 'Tablet', prefix: 'max-lg:', maxWidth: 1023 },
  { value: 'desktop', label: 'Desktop', prefix: '', maxWidth: null },
];

/** All available breakpoint values in order (for backward compatibility) */
export const BREAKPOINT_VALUES: Breakpoint[] = BREAKPOINTS.map(bp => bp.value);

/**
 * Convert breakpoint to Tailwind prefix (Desktop-First)
 * desktop → '' (base), tablet → 'max-lg:', mobile → 'max-md:'
 */
export function getBreakpointPrefix(breakpoint: Breakpoint): string {
  const config = BREAKPOINTS.find(bp => bp.value === breakpoint);
  return config?.prefix ?? '';
}

/**
 * Get current breakpoint based on window width
 */
export function getCurrentBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}
