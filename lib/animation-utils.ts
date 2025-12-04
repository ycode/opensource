/**
 * Animation utility functions and constants for GSAP interactions
 */

import type { InteractionTween, TweenProperties } from '@/types';

// Types
export type TriggerType = 'click' | 'hover' | 'scroll-into-view' | 'while-scrolling' | 'load';
export type PropertyType = 'position-x' | 'position-y' | 'scale' | 'rotation' | 'skew-x' | 'skew-y' | 'opacity' | 'display';

export interface PropertyConfig {
  key: keyof TweenProperties;
  unit: string;
  defaultFrom: string | null;
  defaultFromAfterCurrent: string;
  defaultTo: string | null;
  options?: Array<{ value: string; label: string }>;
  /** If true, only show the "to" value in UI (no "from" input) */
  toOnly?: boolean;
}

export interface PropertyOption {
  type: PropertyType;
  label: string;
  properties: PropertyConfig[];
}

// Constants
export const PROPERTY_OPTIONS: PropertyOption[] = [
  {
    type: 'position-x',
    label: 'Position X',
    properties: [{
      key: 'x',
      unit: 'px',
      defaultFrom: '0',
      defaultFromAfterCurrent: '0',
      defaultTo: '100',
    }],
  },
  {
    type: 'position-y',
    label: 'Position Y',
    properties: [{
      key: 'y',
      unit: 'px',
      defaultFrom: '0',
      defaultFromAfterCurrent: '0',
      defaultTo: '100',
    }],
  },
  {
    type: 'scale',
    label: 'Scale',
    properties: [{
      key: 'scale',
      unit: '',
      defaultFrom: '1',
      defaultFromAfterCurrent: '1',
      defaultTo: '1.3',
    }],
  },
  {
    type: 'rotation',
    label: 'Rotation',
    properties: [{
      key: 'rotation',
      unit: 'deg',
      defaultFrom: '0',
      defaultFromAfterCurrent: '0',
      defaultTo: '45',
    }],
  },
  {
    type: 'skew-x',
    label: 'Skew X',
    properties: [{
      key: 'skewX',
      unit: 'deg',
      defaultFrom: '0',
      defaultFromAfterCurrent: '0',
      defaultTo: '45',
    }],
  },
  {
    type: 'skew-y',
    label: 'Skew Y',
    properties: [{
      key: 'skewY',
      unit: 'deg',
      defaultFrom: '0',
      defaultFromAfterCurrent: '0',
      defaultTo: '45',
    }],
  },
  {
    type: 'opacity',
    label: 'Opacity',
    properties: [{
      key: 'autoAlpha',
      unit: '%',
      defaultFrom: '100',
      defaultFromAfterCurrent: '100',
      defaultTo: '0',
    }],
  },
  {
    type: 'display',
    label: 'Display',
    properties: [{
      key: 'display',
      unit: '',
      defaultFrom: null,
      defaultFromAfterCurrent: 'auto',
      defaultTo: 'none',
      toOnly: true,
      options: [
        { value: 'auto', label: 'Visible - Applies at the START' },
        { value: 'none', label: 'Hidden - Applies at the END' },
      ],
    }],
  },
];

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  'click': 'Click',
  'hover': 'Hover',
  'scroll-into-view': 'Scroll into view',
  'while-scrolling': 'While scrolling',
  'load': 'Page load',
};

export const START_POSITION_OPTIONS: Record<string, { short: string; long: string }> = {
  '>': { short: 'After previous', long: 'After previous animation ends' },
  '<': { short: 'With previous', long: 'With the previous animation' },
  'at': { short: 'At', long: 'At a specific time' },
};

export const EASE_OPTIONS = [
  { value: 'none', label: 'Linear', icon: 'ease-linear' },
  { value: 'power1.in', label: 'Ease in', icon: 'ease-in' },
  { value: 'power1.inOut', label: 'Ease in out', icon: 'ease-in-out' },
  { value: 'power1.out', label: 'Ease out', icon: 'ease-out' },
  { value: 'back.in', label: 'Back in', icon: 'ease-back-in' },
  { value: 'back.inOut', label: 'Back in out', icon: 'ease-back-in-out' },
  { value: 'back.out', label: 'Back out', icon: 'ease-back-out' },
] as const;

// Utility functions

/** Calculate the actual start time in seconds for a tween */
export function calculateTweenStartTime(tweens: InteractionTween[], index: number): number {
  const tween = tweens[index];
  if (typeof tween.position === 'number') {
    return tween.position;
  }
  if (index === 0) {
    return 0;
  }
  const prevStart = calculateTweenStartTime(tweens, index - 1);
  const prevDuration = tweens[index - 1].duration;
  if (tween.position === '>') {
    return prevStart + prevDuration;
  }
  if (tween.position === '<') {
    return prevStart;
  }
  return 0;
}

/** Convert a property value to GSAP-compatible format */
export function toGsapValue(value: string | null | undefined, prop: PropertyConfig): string | number | undefined {
  if (value === null || value === undefined) return undefined;
  // autoAlpha is stored as percentage (0-100), convert to decimal (0-1) for GSAP
  if (prop.key === 'autoAlpha') {
    return Number(value) / 100;
  }
  // For other properties with units, append the unit
  return prop.unit ? `${value}${prop.unit}` : value;
}

/** Get all property options that are set in a tween (check both from and to) */
export function getTweenProperties(tween: InteractionTween): PropertyOption[] {
  return PROPERTY_OPTIONS.filter((opt) =>
    opt.properties.some((p) => {
      const hasFrom = tween.from[p.key] !== undefined && tween.from[p.key] !== null;
      const hasTo = tween.to[p.key] !== undefined && tween.to[p.key] !== null;
      return hasFrom || hasTo;
    })
  );
}

/** Check if a property type is already added to a tween */
export function isPropertyInTween(tween: InteractionTween, propertyType: PropertyType): boolean {
  const propertyOption = PROPERTY_OPTIONS.find((p) => p.type === propertyType);
  if (!propertyOption) return false;
  return propertyOption.properties.some((p) => {
    const hasFrom = tween.from[p.key] !== undefined && tween.from[p.key] !== null;
    const hasTo = tween.to[p.key] !== undefined && tween.to[p.key] !== null;
    return hasFrom || hasTo;
  });
}

export interface GsapAnimationProps {
  from: Record<string, string | number>;
  to: Record<string, string | number>;
  displayStart: string | null; /** Display value to set at the START of animation (when showing) */
  displayEnd: string | null; /** Display value to set at the END of animation (when hiding) */
}

/**
 * Build GSAP-compatible from/to props from a tween.
 * Display is handled separately - it should be applied:
 * - At START when showing (going TO visible/auto) - so element is visible during animation
 * - At END when hiding (going TO none) - so element stays visible during animation
 */
export function buildGsapProps(tween: InteractionTween): GsapAnimationProps {
  const fromProps: Record<string, string | number> = {};
  const toProps: Record<string, string | number> = {};
  let displayStart: string | null = null;
  let displayEnd: string | null = null;

  PROPERTY_OPTIONS.forEach((opt) => {
    opt.properties.forEach((prop) => {
      // Handle display separately - it's discrete, not animated
      if (prop.key === 'display') {
        const toDisplay = tween.to.display;
        if (toDisplay === 'none') {
          // Hiding: apply display:none at END (element stays visible during animation)
          displayEnd = 'none';
        } else if (toDisplay) {
          // Showing: apply display value at START (element becomes visible for animation)
          displayStart = toDisplay;
        }
        return;
      }

      const fromVal = toGsapValue(tween.from[prop.key], prop);
      const toVal = toGsapValue(tween.to[prop.key], prop);
      if (fromVal !== undefined) {
        fromProps[prop.key] = fromVal;
      }
      if (toVal !== undefined) {
        toProps[prop.key] = toVal;
      }
    });
  });

  return { from: fromProps, to: toProps, displayStart, displayEnd };
}
