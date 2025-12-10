import type { Breakpoint } from '@/types';

export interface BreakpointConfig {
  value: Breakpoint;
  label: string;
}

/** All available breakpoints with labels */
export const BREAKPOINTS: BreakpointConfig[] = [
  { value: 'mobile', label: 'Mobile' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'desktop', label: 'Desktop' },
];

/** All available breakpoint values in order (for backward compatibility) */
export const BREAKPOINT_VALUES: Breakpoint[] = BREAKPOINTS.map(bp => bp.value);
