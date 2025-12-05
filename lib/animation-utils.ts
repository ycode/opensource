/**
 * Animation utility functions and constants for GSAP interactions
 */

import type { InteractionTween, TweenProperties, Layer } from '@/types';

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
      defaultTo: '30',
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
      defaultTo: '30',
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
      defaultFromAfterCurrent: 'visible',
      defaultTo: 'hidden',
      options: [
        { value: 'visible', label: 'Visible' },
        { value: 'hidden', label: 'Hidden' },
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
/**
 * Result of generating initial animation CSS
 */
export interface InitialAnimationResult {
  css: string;
  hiddenLayerIds: string[];
}

/**
 * Generate CSS for initial animation states (apply_styles: 'on-load')
 * This prevents flickering by applying styles server-side before JS loads.
 * Now checks per-property apply_styles on each tween.
 */
export function generateInitialAnimationCSS(layers: Layer[]): InitialAnimationResult {
  const cssRules: string[] = [];
  const hiddenLayerIds: string[] = [];

  // CSS rule for hidden elements via data attribute
  cssRules.push('[data-gsap-hidden] { display: none !important; }');

  const collectStyles = (layerList: Layer[]) => {
    layerList.forEach((layer) => {
      if (layer.interactions) {
        layer.interactions.forEach((interaction) => {
          (interaction.tweens || []).forEach((tween) => {
            const styles: string[] = [];
            const transforms: string[] = [];

            // Build CSS from 'from' properties that have apply_styles: 'on-load'
            PROPERTY_OPTIONS.forEach((opt) => {
              opt.properties.forEach((prop) => {
                // Only apply styles for properties with apply_styles: 'on-load'
                if (tween.apply_styles?.[prop.key] !== 'on-load') return;

                const value = tween.from[prop.key];
                if (value === null || value === undefined) return;

                // Convert to CSS property - collect transforms separately to combine them
                if (prop.key === 'x') {
                  transforms.push(`translateX(${value}${prop.unit})`);
                } else if (prop.key === 'y') {
                  transforms.push(`translateY(${value}${prop.unit})`);
                } else if (prop.key === 'rotation') {
                  transforms.push(`rotate(${value}${prop.unit})`);
                } else if (prop.key === 'scale') {
                  transforms.push(`scale(${value})`);
                } else if (prop.key === 'skewX') {
                  transforms.push(`skewX(${value}${prop.unit})`);
                } else if (prop.key === 'skewY') {
                  transforms.push(`skewY(${value}${prop.unit})`);
                } else if (prop.key === 'autoAlpha') {
                  const opacity = Number(value) / 100;
                  styles.push(`opacity: ${opacity}`);
                  if (opacity === 0) {
                    styles.push(`visibility: hidden`);
                  }
                } else if (prop.key === 'display') {
                  // Track elements that should start hidden
                  if (value === 'hidden') {
                    hiddenLayerIds.push(tween.layer_id);
                  }
                }
              });
            });

            // Combine all transforms into a single property
            if (transforms.length > 0) {
              styles.push(`transform: ${transforms.join(' ')}`);
            }

            if (styles.length > 0) {
              cssRules.push(`[data-layer-id="${tween.layer_id}"] { ${styles.join('; ')}; }`);
            }
          });
        });
      }

      if (layer.children) {
        collectStyles(layer.children);
      }
    });
  };

  collectStyles(layers);
  return { css: cssRules.join('\n'), hiddenLayerIds };
}

export function buildGsapProps(tween: InteractionTween): GsapAnimationProps {
  const fromProps: Record<string, string | number> = {};
  const toProps: Record<string, string | number> = {};
  let displayStart: string | null = null;
  let displayEnd: string | null = null;

  PROPERTY_OPTIONS.forEach((opt) => {
    opt.properties.forEach((prop) => {
      // Handle display separately via data-gsap-hidden attribute
      if (prop.key === 'display') {
        displayStart = tween.from.display || 'visible';
        displayEnd = tween.to.display || 'visible';
        return;
      }

      const fromVal = toGsapValue(tween.from[prop.key], prop);
      const toVal = toGsapValue(tween.to[prop.key], prop);

      if (fromVal !== undefined && fromVal !== null) {
        fromProps[prop.key] = fromVal;
      }
      if (toVal !== undefined && toVal !== null) {
        toProps[prop.key] = toVal;
      }
    });
  });

  return { from: fromProps, to: toProps, displayStart, displayEnd };
}

/** Minimum duration for GSAP tweens (0-duration causes issues) */
export function safeDuration(duration: number): number {
  return Math.max(duration, 0.001);
}

export interface SeparatedAnimationProps {
  fromTo: { from: Record<string, unknown>; to: Record<string, unknown> };
  fromOnly: Record<string, unknown>;
  toOnly: Record<string, unknown>;
  hasFromTo: boolean;
  hasFromOnly: boolean;
  hasToOnly: boolean;
}

/** Separates animation properties into fromTo, fromOnly, and toOnly groups */
export function separateAnimationProps(
  from: Record<string, unknown>,
  to: Record<string, unknown>
): SeparatedAnimationProps {
  const fromToFrom: Record<string, unknown> = {};
  const fromToTo: Record<string, unknown> = {};
  const fromOnly: Record<string, unknown> = {};
  const toOnly: Record<string, unknown> = {};

  const fromKeys = new Set(Object.keys(from));
  const toKeys = new Set(Object.keys(to));

  fromKeys.forEach((key) => {
    if (toKeys.has(key)) {
      fromToFrom[key] = from[key];
      fromToTo[key] = to[key];
    } else {
      fromOnly[key] = from[key];
    }
  });

  toKeys.forEach((key) => {
    if (!fromKeys.has(key)) {
      toOnly[key] = to[key];
    }
  });

  return {
    fromTo: { from: fromToFrom, to: fromToTo },
    fromOnly,
    toOnly,
    hasFromTo: Object.keys(fromToFrom).length > 0,
    hasFromOnly: Object.keys(fromOnly).length > 0,
    hasToOnly: Object.keys(toOnly).length > 0,
  };
}

export interface AddTweenOptions {
  element: HTMLElement;
  from: Record<string, unknown>;
  to: Record<string, unknown>;
  duration: number;
  ease: string;
  position: number | string;
  onComplete?: () => void;
}

/** Adds a tween to a GSAP timeline, handling mixed from/to/fromTo properties */
export function addTweenToTimeline(
  timeline: gsap.core.Timeline,
  options: AddTweenOptions
): void {
  const { element, from, to, duration, ease, position, onComplete } = options;
  const safeDur = safeDuration(duration);
  const { fromTo, fromOnly, toOnly, hasFromTo, hasFromOnly, hasToOnly } = separateAnimationProps(from, to);

  // Add tweens - use '<' to run simultaneously with the first one
  if (hasFromTo) {
    timeline.fromTo(
      element,
      fromTo.from,
      { ...fromTo.to, duration: safeDur, ease, onComplete: !hasFromOnly && !hasToOnly ? onComplete : undefined },
      position
    );
  }

  if (hasFromOnly) {
    timeline.from(
      element,
      { ...fromOnly, duration: safeDur, ease, onComplete: !hasToOnly ? onComplete : undefined },
      hasFromTo ? '<' : position
    );
  }

  if (hasToOnly) {
    timeline.to(
      element,
      { ...toOnly, duration: safeDur, ease, onComplete },
      hasFromTo || hasFromOnly ? '<' : position
    );
  }
}
