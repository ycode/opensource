'use client';

/**
 * AnimationInitializer - Initializes GSAP animations based on layer interactions
 * Runs on the client to set up all animations for preview/published pages.
 *
 * Initial styles for 'on-load' mode are applied server-side via generateInitialAnimationCSS()
 * to prevent flickering. This component only handles animation triggers.
 */

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

import { buildGsapProps, addTweenToTimeline, createSplitTextAnimation } from '@/lib/animation-utils';
import { getCurrentBreakpoint } from '@/lib/breakpoint-utils';
import type { Layer, LayerInteraction, Breakpoint } from '@/types';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

interface AnimationInitializerProps {
  layers: Layer[];
}

interface CollectedInteraction {
  triggerLayerId: string;
  interaction: LayerInteraction;
}

/** Recursively collect all interactions from layers */
function collectInteractions(layers: Layer[]): CollectedInteraction[] {
  const interactions: CollectedInteraction[] = [];

  const traverse = (layerList: Layer[]) => {
    layerList.forEach((layer) => {
      if (layer.interactions?.length) {
        layer.interactions.forEach((interaction) => {
          interactions.push({ triggerLayerId: layer.id, interaction });
        });
      }
      if (layer.children) {
        traverse(layer.children);
      }
    });
  };

  traverse(layers);
  return interactions;
}

/** Check if interaction should run on specified breakpoint */
function shouldRunOnBreakpoint(interaction: LayerInteraction, breakpoint: Breakpoint): boolean {
  if (!interaction.timeline?.breakpoints) return true;
  return interaction.timeline.breakpoints.includes(breakpoint);
}

/** Get element by layer ID */
function getElement(layerId: string): HTMLElement | null {
  return document.querySelector(`[data-layer-id="${layerId}"]`);
}

/** Build a GSAP timeline from an interaction */
function buildTimeline(interaction: LayerInteraction): gsap.core.Timeline | null {
  const isYoyo = interaction.timeline?.yoyo ?? false;

  // Track elements with display transitions for handling show/hide
  const displayTransitions: Array<{
    element: HTMLElement;
    displayStart: string | null;
    displayEnd: string | null;
  }> = [];

  // Track SplitText instances for cleanup
  const splitTextInstances: SplitText[] = [];

  // Track split elements per layer to reuse across multiple tweens
  const splitElementsCache = new Map<string, HTMLElement[]>();

  const timeline = gsap.timeline({
    paused: true,
    repeat: interaction.timeline?.repeat ?? 0,
    yoyo: isYoyo,
    onComplete: () => {
      // Clean up split text after animation completes (optional)
      // splitTextInstances.forEach(split => split.revert());
    },
  });

  // First pass: prepare all elements, split text, and collect data
  interface PreparedTween {
    element: HTMLElement;
    splitElements?: HTMLElement[];
    from: gsap.TweenVars;
    to: gsap.TweenVars;
    displayStart: string | null;
    displayEnd: string | null;
    position: string | number;
    duration: number;
    ease: string;
    splitTextConfig?: typeof interaction.tweens[0]['splitText'];
  }
  const preparedTweens: PreparedTween[] = [];

  (interaction.tweens || []).forEach((tween, index) => {
    const element = getElement(tween.layer_id);
    if (!element) return;

    // Apply split text if configured using GSAP's SplitText
    let splitElements: HTMLElement[] | undefined;
    if (tween.splitText) {
      // Check if we've already split this element in this timeline
      const cacheKey = `${tween.layer_id}_${tween.splitText.type}`;

      if (splitElementsCache.has(cacheKey)) {
        // Reuse existing split elements
        splitElements = splitElementsCache.get(cacheKey);
      } else {
        // Create new split for this element
        const result = createSplitTextAnimation(
          element,
          tween.splitText,
          tween,
          gsap,
          SplitText
        );

        if (result) {
          splitTextInstances.push(result.splitInstance);
          splitElements = result.splitElements;
          // Cache the split elements for reuse
          splitElementsCache.set(cacheKey, result.splitElements);
        }
      }
    }

    const { from, to, displayStart, displayEnd } = buildGsapProps(tween);

    // Calculate position for timeline
    let position: string | number = 0;
    if (typeof tween.position === 'number') {
      position = tween.position;
    } else if (tween.position === '>' && index > 0) {
      position = '>';
    } else if (tween.position === '<' && index > 0) {
      position = '<';
    }

    // Track display transitions for this tween
    if (displayStart !== displayEnd) {
      displayTransitions.push({ element, displayStart, displayEnd });
    }

    preparedTweens.push({
      element,
      splitElements,
      from,
      to,
      displayStart,
      displayEnd,
      position,
      duration: tween.duration,
      ease: tween.ease,
      splitTextConfig: tween.splitText,
    });
  });

  // Second pass: Add all tweens to timeline
  // For each tween, apply its "from" state at the same position it starts
  preparedTweens.forEach(({ element, splitElements, from, to, displayStart, displayEnd, position, duration, ease, splitTextConfig }) => {
    // Apply the "from" state at the same position as the tween starts
    // This ensures sequenced animations have correct initial state when they begin
    if (Object.keys(from).length > 0) {
      const targets = splitElements && splitElements.length > 0 ? splitElements : element;
      timeline.set(targets, from, position);
    }

    // Add tween to timeline using shared utility
    addTweenToTimeline(timeline, {
      element,
      from,
      to,
      duration,
      ease,
      position,
      splitText: splitTextConfig,
      splitElements,
      onComplete: displayEnd === 'hidden'
        ? () => element.setAttribute('data-gsap-hidden', '')
        : undefined,
    });
  });

  // Handle display state changes based on timeline direction
  if (displayTransitions.length > 0) {
    // When timeline starts playing forward, set elements to their "end" display state
    timeline.eventCallback('onStart', () => {
      displayTransitions.forEach(({ element, displayEnd }) => {
        if (displayEnd === 'visible') {
          element.removeAttribute('data-gsap-hidden');
        }
      });
    });

    // When timeline reverses back to start, restore initial display states
    if (isYoyo) {
      timeline.eventCallback('onReverseComplete', () => {
        displayTransitions.forEach(({ element, displayStart }) => {
          if (displayStart === 'hidden') {
            element.setAttribute('data-gsap-hidden', '');
          } else {
            element.removeAttribute('data-gsap-hidden');
          }
        });
      });
    }
  }

  return timeline;
}

export default function AnimationInitializer({ layers }: AnimationInitializerProps) {
  const cleanupRef = useRef<(() => void)[]>([]);
  const timelinesRef = useRef<Map<string, gsap.core.Timeline>>(new Map());
  const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint>(() => getCurrentBreakpoint());

  // Listen for breakpoint changes on resize
  useEffect(() => {
    const handleResize = () => {
      const newBreakpoint = getCurrentBreakpoint();
      setCurrentBreakpoint((prev) => (prev !== newBreakpoint ? newBreakpoint : prev));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const collectedInteractions = collectInteractions(layers);

    // Clean up previous animations
    cleanupRef.current.forEach((cleanup) => cleanup());
    cleanupRef.current = [];
    timelinesRef.current.forEach((tl) => tl.kill());
    timelinesRef.current.clear();

    collectedInteractions.forEach(({ triggerLayerId, interaction }) => {
      const triggerElement = getElement(triggerLayerId);
      if (!triggerElement) return;

      const { trigger } = interaction;

      // Helper to get or create timeline (always lazy to avoid GSAP setting inline styles)
      // Initial styles are handled by CSS via generateInitialAnimationCSS()
      const getTimeline = (): gsap.core.Timeline | null => {
        let tl = timelinesRef.current.get(interaction.id) || null;
        if (!tl) {
          tl = buildTimeline(interaction);
          if (tl) timelinesRef.current.set(interaction.id, tl);
        }
        return tl;
      };

      switch (trigger) {
        case 'load': {
          // Skip if breakpoint restriction not met
          if (!shouldRunOnBreakpoint(interaction, currentBreakpoint)) break;

          const timeline = getTimeline();
          timeline?.play();
          break;
        }

        case 'click': {
          let isForward = true;
          const isLooped = (interaction.timeline?.repeat ?? 0) !== 0;

          const handleClick = () => {
            // Check breakpoint at trigger time for interactive triggers
            if (!shouldRunOnBreakpoint(interaction, getCurrentBreakpoint())) return;

            const timeline = getTimeline();
            if (!timeline) return;

            if (isLooped) {
              if (timeline.isActive()) {
                timeline.pause();
              } else {
                timeline.play();
              }
            } else if (interaction.timeline?.yoyo) {
              if (isForward) {
                timeline.play();
              } else {
                timeline.reverse();
              }
              isForward = !isForward;
            } else {
              timeline.restart();
            }
          };

          triggerElement.addEventListener('click', handleClick);
          cleanupRef.current.push(() => triggerElement.removeEventListener('click', handleClick));
          break;
        }

        case 'hover': {
          const handleMouseEnter = () => {
            // Check breakpoint at trigger time for interactive triggers
            if (!shouldRunOnBreakpoint(interaction, getCurrentBreakpoint())) return;
            getTimeline()?.play();
          };
          const handleMouseLeave = () => {
            // Check breakpoint at trigger time for interactive triggers
            if (!shouldRunOnBreakpoint(interaction, getCurrentBreakpoint())) return;
            if (interaction.timeline?.yoyo) {
              timelinesRef.current.get(interaction.id)?.reverse();
            }
          };

          triggerElement.addEventListener('mouseenter', handleMouseEnter);
          triggerElement.addEventListener('mouseleave', handleMouseLeave);
          cleanupRef.current.push(() => {
            triggerElement.removeEventListener('mouseenter', handleMouseEnter);
            triggerElement.removeEventListener('mouseleave', handleMouseLeave);
          });
          break;
        }

        case 'scroll-into-view': {
          // Skip if breakpoint restriction not met
          if (!shouldRunOnBreakpoint(interaction, currentBreakpoint)) break;

          const scrollStart = interaction.timeline?.scrollStart || 'top 80%';
          const toggleActions = interaction.timeline?.toggleActions || 'play none none none';

          // toggleActions requires timeline upfront
          const timeline = getTimeline();
          if (!timeline) break;

          const scrollTrigger = ScrollTrigger.create({
            trigger: triggerElement,
            start: scrollStart,
            toggleActions,
            animation: timeline as any,
          });

          cleanupRef.current.push(() => scrollTrigger.kill());
          break;
        }

        case 'while-scrolling': {
          // Skip if breakpoint restriction not met
          if (!shouldRunOnBreakpoint(interaction, currentBreakpoint)) break;

          // Scrub animations require timeline upfront
          const timeline = getTimeline();
          if (!timeline) break;

          const scrollStart = interaction.timeline?.scrollStart || 'top bottom';
          const scrollEnd = interaction.timeline?.scrollEnd || 'bottom top';
          const scrub = interaction.timeline?.scrub ?? 1;

          const scrollTrigger = ScrollTrigger.create({
            trigger: triggerElement,
            start: scrollStart,
            end: scrollEnd,
            scrub,
            animation: timeline,
          });

          cleanupRef.current.push(() => scrollTrigger.kill());
          break;
        }
      }
    });

    // Capture ref values for cleanup
    const cleanups = cleanupRef.current;
    const timelines = timelinesRef.current;

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      timelines.forEach((tl) => tl.kill());
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, [layers, currentBreakpoint]);

  return null;
}
