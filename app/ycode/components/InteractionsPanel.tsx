'use client';

/**
 * InteractionsPanel - Manages layer interactions and animations
 *
 * Handles triggers (click, hover, etc.) and their associated transitions
 */

// 1. React/Next.js
import React, { useState, useCallback, useMemo, useEffect } from 'react';

// 2. External libraries
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { restrictToParentElement } from '@dnd-kit/modifiers';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import gsap from 'gsap';

// 3. ShadCN UI
import Icon, { IconProps } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Empty, EmptyDescription } from '@/components/ui/empty';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// 3. Utils
import { cn, generateId } from '@/lib/utils';
import { getLayerName, getLayerIcon, findLayerById } from '@/lib/layer-utils';
import {
  PROPERTY_OPTIONS,
  TRIGGER_LABELS,
  START_POSITION_OPTIONS,
  EASE_OPTIONS,
  calculateTweenStartTime,
  toGsapValue,
  getTweenProperties,
  isPropertyInTween,
  buildGsapProps,
  addTweenToTimeline,
} from '@/lib/animation-utils';
import type { TriggerType, PropertyType } from '@/lib/animation-utils';

// 4. Types
import type { Layer, LayerInteraction, InteractionTimeline, InteractionTween, TweenProperties, Breakpoint } from '@/types';
import { Badge } from '@/components/ui/badge';

interface InteractionsPanelProps {
  triggerLayer: Layer;
  allLayers: Layer[]; // All layers available for target selection
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  selectedLayerId?: string | null; // Currently selected layer in editor
  resetKey?: number; // When this changes, reset all selections
  activeBreakpoint?: Breakpoint;
  onStateChange?: (state: {
    selectedTriggerId?: string | null;
    shouldRefresh?: boolean;
  }) => void;
  onSelectLayer?: (layerId: string) => void; // Callback to select a layer in the editor
}

// Sortable animation item component
interface SortableAnimationItemProps {
  tween: InteractionTween;
  index: number;
  tweens: InteractionTween[];
  isSelected: boolean;
  targetLayer: Layer | null;
  onSelect: () => void;
  onRemove: () => void;
  onSelectLayer?: (layerId: string) => void;
}

function SortableAnimationItem({
  tween,
  index,
  tweens,
  isSelected,
  targetLayer,
  onSelect,
  onRemove,
  onSelectLayer,
}: SortableAnimationItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tween.id });

  const style: React.CSSProperties = {
    transform: transform ? `translateY(${transform.y}px)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        onSelect();
        onSelectLayer?.(tween.layer_id);
      }}
      className={cn(
        'px-2 py-1.25 flex items-center gap-1.75 rounded-lg transition-colors',
        isSelected
          ? 'bg-teal-500/50 text-primary-foreground'
          : 'bg-secondary/50 hover:bg-secondary/100'
      )}
    >
      <div
        className={cn(
          'size-5 flex items-center justify-center rounded-[6px]',
          isSelected ? 'bg-primary-foreground/20' : 'bg-secondary'
        )}
      >
        <Icon
          name={targetLayer ? getLayerIcon(targetLayer) : 'layers'}
          className="size-2.5"
        />
      </div>

      <Label className="flex-1 truncate !cursor-[inherit]">
        {targetLayer ? getLayerName(targetLayer) : `Animation #${index + 1}`}
      </Label>

      <Badge variant="secondary" className="text-[11px]">
        {(() => {
          const startTime = calculateTweenStartTime(tweens, index);
          const endTime = startTime + tween.duration;
          return (
            <>
              {startTime}s
              <Icon name="chevronRight" className="opacity-70 shrink-0" />
              {endTime}s
            </>
          );
        })()}
      </Badge>

      <Button
        size="xs"
        variant="ghost"
        className="-mr-0.5 !cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <Icon name="x" />
      </Button>
    </div>
  );
}

export default function InteractionsPanel({
  triggerLayer,
  allLayers,
  onLayerUpdate,
  selectedLayerId,
  resetKey,
  activeBreakpoint = 'desktop',
  onStateChange,
  onSelectLayer,
}: InteractionsPanelProps) {
  const [selectedInteractionId, setSelectedInteractionId] = useState<string | null>(null);
  const [selectedTweenId, setSelectedTweenId] = useState<string | null>(null);
  const previewedElementRef = React.useRef<{ layerId: string; element: HTMLElement; originalStyle: string; wasHidden: boolean } | null>(null);
  const previewTweenRef = React.useRef<gsap.core.Tween | null>(null);
  const previewTimelineRef = React.useRef<gsap.core.Timeline | null>(null);
  const previewedElementsRef = React.useRef<Map<string, { element: HTMLElement; originalStyle: string; wasHidden: boolean }>>(new Map());
  const isChangingPropertyRef = React.useRef(false);

  /** Get element from iframe by layer ID */
  const getIframeElement = useCallback((layerId: string): HTMLElement | null => {
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    const iframeDoc = iframe?.contentDocument || iframe?.contentWindow?.document;
    if (!iframeDoc) return null;
    return iframeDoc.querySelector(`[data-layer-id="${layerId}"]`) as HTMLElement;
  }, []);

  /** Clear preview styles and restore original */
  const clearPreviewStyles = useCallback((force = false) => {
    // Skip if a property change is in progress (prevents blur during re-render)
    if (!force && isChangingPropertyRef.current) return;

    // Kill any running preview animation
    if (previewTweenRef.current) {
      previewTweenRef.current.kill();
      previewTweenRef.current = null;
    }

    if (previewedElementRef.current) {
      const { element, originalStyle, wasHidden } = previewedElementRef.current;
      // Use GSAP to clear transforms
      gsap.set(element, { clearProps: 'all' });
      element.setAttribute('style', originalStyle);
      // Restore original hidden state
      if (wasHidden) {
        element.setAttribute('data-gsap-hidden', '');
      } else {
        element.removeAttribute('data-gsap-hidden');
      }
      previewedElementRef.current = null;
    }
  }, []);

  /** Apply preview styles to a layer element using GSAP */
  const applyPreviewStyles = useCallback((layerId: string, properties: gsap.TweenVars) => {
    const element = getIframeElement(layerId);
    if (!element) return;

    // Only store original style if this is a new preview or different layer
    if (!previewedElementRef.current || previewedElementRef.current.layerId !== layerId) {
      // Clear any existing preview for different element
      clearPreviewStyles();

      // Store original style and hidden state for the new element
      previewedElementRef.current = {
        layerId,
        element,
        originalStyle: element.getAttribute('style') || '',
        wasHidden: element.hasAttribute('data-gsap-hidden'),
      };
    }

    // Use GSAP to set the preview state instantly
    gsap.set(element, properties);
  }, [clearPreviewStyles, getIframeElement]);

  /** Clear all preview styles from timeline playback */
  const clearAllPreviewStyles = useCallback(() => {
    // Kill any running timeline
    if (previewTimelineRef.current) {
      previewTimelineRef.current.kill();
      previewTimelineRef.current = null;
    }

    // Restore all previewed elements
    previewedElementsRef.current.forEach(({ element, originalStyle, wasHidden }) => {
      gsap.set(element, { clearProps: 'all' });
      element.setAttribute('style', originalStyle);
      // Restore original hidden state
      if (wasHidden) {
        element.setAttribute('data-gsap-hidden', '');
      } else {
        element.removeAttribute('data-gsap-hidden');
      }
    });
    previewedElementsRef.current.clear();

    // Also clear single element preview
    clearPreviewStyles(true);
  }, [clearPreviewStyles]);

  /** Play a tween animation preview */
  const playTweenPreview = useCallback((
    layerId: string,
    from: gsap.TweenVars,
    to: gsap.TweenVars,
    duration: number,
    ease: string,
    displayStart: string | null,
    displayEnd: string | null
  ) => {
    // Clear any existing preview first (force clear)
    clearAllPreviewStyles();

    const element = getIframeElement(layerId);
    if (!element) return;

    // Store original style and hidden state
    previewedElementRef.current = {
      layerId,
      element,
      originalStyle: element.getAttribute('style') || '',
      wasHidden: element.hasAttribute('data-gsap-hidden'),
    };

    // Handle display via data-gsap-hidden attribute (same as AnimationInitializer)
    // 'visible' = remove attribute, 'hidden' = add attribute
    if (displayStart === 'visible') {
      element.removeAttribute('data-gsap-hidden');
    }

    // Play the animation using GSAP with shared utility
    const tl = gsap.timeline({
      onComplete: () => {
        if (displayEnd === 'hidden') {
          element.setAttribute('data-gsap-hidden', '');
        }
      },
    });

    addTweenToTimeline(tl, {
      element,
      from,
      to,
      duration,
      ease,
      position: 0,
    });

    previewTweenRef.current = tl as unknown as gsap.core.Tween;
  }, [clearAllPreviewStyles, getIframeElement]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Reset selections and clear GSAP previews when trigger layer changes or reset is triggered
  useEffect(() => {
    setSelectedInteractionId(null);
    setSelectedTweenId(null);
    clearAllPreviewStyles();
  }, [triggerLayer.id, resetKey, clearAllPreviewStyles]);

  // Cleanup GSAP animations on unmount (when exiting interaction tab)
  useEffect(() => {
    // Capture refs for cleanup
    const tweenRef = previewTweenRef;
    const timelineRef = previewTimelineRef;
    const elementRef = previewedElementRef;
    const elementsRef = previewedElementsRef;

    return () => {
      // Kill any running preview animation
      if (tweenRef.current) {
        tweenRef.current.kill();
        tweenRef.current = null;
      }
      // Kill any running timeline
      if (timelineRef.current) {
        timelineRef.current.kill();
        timelineRef.current = null;
      }
      // Restore original styles (single element)
      if (elementRef.current) {
        const { element, originalStyle } = elementRef.current;
        gsap.set(element, { clearProps: 'all' });
        element.setAttribute('style', originalStyle);
        elementRef.current = null;
      }
      // Restore all previewed elements (from timeline)
      elementsRef.current.forEach(({ element, originalStyle }) => {
        gsap.set(element, { clearProps: 'all' });
        element.setAttribute('style', originalStyle);
      });
      elementsRef.current.clear();
    };
  }, []);

  // Memoize interactions to prevent unnecessary re-renders
  const interactions = useMemo(() => triggerLayer.interactions || [], [triggerLayer.interactions]);
  const selectedInteraction = interactions.find((i) => i.id === selectedInteractionId);
  const usedTriggers = useMemo(() => new Set(interactions.map(i => i.trigger)), [interactions]);

  // Find selected tween
  const selectedTween =
    selectedInteraction && selectedTweenId
      ? (selectedInteraction.tweens || []).find((t) => t.id === selectedTweenId) || null
      : null;

  /** Play all animations in the selected interaction as a timeline */
  const playAllAnimations = useCallback(() => {
    if (!selectedInteraction) return;

    const tweens = selectedInteraction.tweens || [];
    if (tweens.length === 0) return;

    // Clear any existing previews first
    clearAllPreviewStyles();

    // Create a new timeline
    const timeline = gsap.timeline({
      // onComplete: () => {
      //   clearAllPreviewStyles();
      // },
    });

    // Store original styles and add tweens to timeline
    tweens.forEach((tween, index) => {
      const element = getIframeElement(tween.layer_id);
      if (!element) return;

      // Store original style and hidden state if not already stored
      if (!previewedElementsRef.current.has(tween.layer_id)) {
        previewedElementsRef.current.set(tween.layer_id, {
          element,
          originalStyle: element.getAttribute('style') || '',
          wasHidden: element.hasAttribute('data-gsap-hidden'),
        });
      }

      // Build from/to props
      const { from: fromProps, to: toProps, displayStart, displayEnd } = buildGsapProps(tween);

      // Calculate position for timeline
      let position: string | number = 0;
      if (typeof tween.position === 'number') {
        position = tween.position;
      } else if (tween.position === '>' && index > 0) {
        position = '>'; // After previous
      } else if (tween.position === '<' && index > 0) {
        position = '<'; // With previous
      }

      // Handle display via data-gsap-hidden attribute (same as AnimationInitializer)
      if (displayStart === 'visible') {
        timeline.call(() => element.removeAttribute('data-gsap-hidden'), undefined, position);
      }

      // Add tween to timeline using shared utility
      addTweenToTimeline(timeline, {
        element,
        from: fromProps,
        to: toProps,
        duration: tween.duration,
        ease: tween.ease,
        position,
        onComplete: displayEnd === 'hidden'
          ? () => element.setAttribute('data-gsap-hidden', '')
          : undefined,
      });
    });

    previewTimelineRef.current = timeline;
  }, [selectedInteraction, getIframeElement, clearAllPreviewStyles]);

  // Find layers that animate the current trigger layer (where this layer is a target in tweens)
  const animatedByLayers = useMemo(() => {
    const result: Array<{ layer: Layer; triggerType: TriggerType }> = [];

    const findAnimators = (layers: Layer[]) => {
      layers.forEach((layer) => {
        // Skip self
        if (layer.id === triggerLayer.id) {
          if (layer.children) findAnimators(layer.children);
          return;
        }

        const layerInteractions = layer.interactions || [];
        // Find the first interaction that has a tween targeting this layer
        const matchingInteraction = layerInteractions.find((interaction) =>
          (interaction.tweens || []).some((tween) => tween.layer_id === triggerLayer.id)
        );

        if (matchingInteraction) {
          result.push({ layer, triggerType: matchingInteraction.trigger });
        }

        if (layer.children) {
          findAnimators(layer.children);
        }
      });
    };

    findAnimators(allLayers);
    return result;
  }, [allLayers, triggerLayer.id]);

  // Auto-select first tween's target layer when a trigger event is selected (only on ID change)
  useEffect(() => {
    if (selectedInteractionId) {
      const interaction = interactions.find((i) => i.id === selectedInteractionId);
      const firstTween = (interaction?.tweens || [])[0];
      if (firstTween && onSelectLayer) {
        const targetLayer = findLayerById(allLayers, firstTween.layer_id);
        if (targetLayer) {
          onSelectLayer(targetLayer.id);
        }
      }
    }
    // Only run when selectedInteractionId changes, not when interaction content changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInteractionId]);

  // Notify parent about state changes
  useEffect(() => {
    onStateChange?.({
      selectedTriggerId: selectedInteractionId,
    });
  }, [selectedInteractionId, onStateChange]);

  // Add new interaction
  const handleAddInteraction = useCallback(
    (trigger: TriggerType) => {
      const newInteraction: LayerInteraction = {
        id: generateId('int'),
        trigger,
        timeline: {
          breakpoints: [activeBreakpoint],
          repeat: 0,
          yoyo: false,
        },
        tweens: [], // Start with no tweens - user will add them
      };

      const updatedInteractions = [...interactions, newInteraction];
      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
      setSelectedInteractionId(newInteraction.id);
    },
    [interactions, triggerLayer.id, onLayerUpdate, activeBreakpoint]
  );

  // Remove interaction
  const handleRemoveInteraction = useCallback(
    (interactionId: string) => {
      const updatedInteractions = interactions.filter((i) => i.id !== interactionId);
      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });

      if (selectedInteractionId === interactionId) {
        setSelectedInteractionId(null);
      }

      // Select trigger layer when last interaction is removed
      if (updatedInteractions.length === 0 && onSelectLayer) {
        onSelectLayer(triggerLayer.id);
      }
    },
    [interactions, triggerLayer.id, onLayerUpdate, selectedInteractionId, onSelectLayer]
  );

  // Update Interaction settings (now at interaction level)
  const handleUpdateTimeline = useCallback(
    (updates: Partial<InteractionTimeline>) => {
      if (!selectedInteraction) return;

      const updatedInteractions = interactions.map((interaction) => {
        if (interaction.id !== selectedInteractionId) return interaction;
        return {
          ...interaction,
          timeline: { ...interaction.timeline, ...updates },
        };
      });

      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
    },
    [selectedInteraction, interactions, selectedInteractionId, triggerLayer.id, onLayerUpdate]
  );

  // Add new tween for the currently selected layer
  const handleAddTween = useCallback(() => {
    if (!selectedInteraction || !selectedLayerId) return;

    const newTween: InteractionTween = {
      id: generateId('anm'),
      layer_id: selectedLayerId,
      position: '>',
      duration: 0.3,
      ease: 'power1.out',
      from: {},
      to: {},
      apply_styles: {
        x: 'on-trigger',
        y: 'on-trigger',
        rotation: 'on-trigger',
        scale: 'on-trigger',
        skewX: 'on-trigger',
        skewY: 'on-trigger',
        autoAlpha: 'on-trigger',
        display: 'on-trigger',
      },
    };

    const updatedInteractions = interactions.map((interaction) => {
      if (interaction.id !== selectedInteractionId) return interaction;
      return {
        ...interaction,
        tweens: [...interaction.tweens, newTween],
      };
    });

    onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
    setSelectedTweenId(newTween.id);
  }, [selectedInteraction, selectedLayerId, interactions, selectedInteractionId, triggerLayer.id, onLayerUpdate]);

  // Remove tween
  const handleRemoveTween = useCallback(
    (tweenId: string) => {
      if (!selectedInteraction) return;

      const updatedInteractions = interactions.map((interaction) => {
        if (interaction.id !== selectedInteractionId) return interaction;
        return {
          ...interaction,
          tweens: interaction.tweens.filter((t) => t.id !== tweenId),
        };
      });

      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
      if (selectedTweenId === tweenId) {
        setSelectedTweenId(null);
      }
    },
    [selectedInteraction, interactions, selectedInteractionId, triggerLayer.id, onLayerUpdate, selectedTweenId]
  );

  // Reorder tweens via drag and drop
  const handleReorderTweens = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !selectedInteraction) return;

      const tweens = selectedInteraction.tweens || [];
      const oldIndex = tweens.findIndex((t) => t.id === active.id);
      const newIndex = tweens.findIndex((t) => t.id === over.id);

      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedTweens = arrayMove(tweens, oldIndex, newIndex);

      const updatedInteractions = interactions.map((interaction) => {
        if (interaction.id !== selectedInteractionId) return interaction;
        return { ...interaction, tweens: reorderedTweens };
      });

      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
    },
    [selectedInteraction, interactions, selectedInteractionId, triggerLayer.id, onLayerUpdate]
  );

  // Update tween
  const handleUpdateTween = useCallback(
    (tweenId: string, updates: Partial<InteractionTween>) => {
      if (!selectedInteraction) return;

      const updatedInteractions = interactions.map((interaction) => {
        if (interaction.id !== selectedInteractionId) return interaction;
        return {
          ...interaction,
          tweens: interaction.tweens.map((t) =>
            t.id === tweenId ? { ...t, ...updates } : t
          ),
        };
      });

      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
    },
    [selectedInteraction, interactions, selectedInteractionId, triggerLayer.id, onLayerUpdate]
  );

  // Add property to tween
  const handleAddPropertyToTween = useCallback(
    (tweenId: string, propertyType: PropertyType) => {
      if (!selectedInteraction) return;

      const propertyOption = PROPERTY_OPTIONS.find((p) => p.type === propertyType);
      if (!propertyOption) return;

      const updatedInteractions = interactions.map((interaction) => {
        if (interaction.id !== selectedInteractionId) return interaction;
        return {
          ...interaction,
          tweens: interaction.tweens.map((tween) => {
            if (tween.id !== tweenId) return tween;

            const newFrom: TweenProperties = { ...tween.from };
            const newTo: TweenProperties = { ...tween.to };
            propertyOption.properties.forEach((prop) => {
              (newFrom[prop.key] as string | null) = prop.defaultFrom;
              (newTo[prop.key] as string | null) = prop.defaultTo;
            });

            return { ...tween, from: newFrom, to: newTo };
          }),
        };
      });

      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
    },
    [selectedInteraction, interactions, selectedInteractionId, triggerLayer.id, onLayerUpdate]
  );

  // Remove property from tween
  const handleRemovePropertyFromTween = useCallback(
    (tweenId: string, propertyType: PropertyType) => {
      if (!selectedInteraction) return;

      const propertyOption = PROPERTY_OPTIONS.find((p) => p.type === propertyType);
      if (!propertyOption) return;

      const updatedInteractions = interactions.map((interaction) => {
        if (interaction.id !== selectedInteractionId) return interaction;
        return {
          ...interaction,
          tweens: interaction.tweens.map((tween) => {
            if (tween.id !== tweenId) return tween;

            const newFrom = { ...tween.from };
            const newTo = { ...tween.to };
            propertyOption.properties.forEach((prop) => {
              delete newFrom[prop.key];
              delete newTo[prop.key];
            });

            return { ...tween, from: newFrom, to: newTo };
          }),
        };
      });

      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
    },
    [selectedInteraction, interactions, selectedInteractionId, triggerLayer.id, onLayerUpdate]
  );

  // Toggle breakpoint in timeline
  const handleToggleBreakpoint = useCallback(
    (breakpoint: Breakpoint) => {
      if (!selectedInteraction) return;

      const currentBreakpoints = selectedInteraction.timeline?.breakpoints || [];
      const newBreakpoints = currentBreakpoints.includes(breakpoint)
        ? currentBreakpoints.filter((b) => b !== breakpoint)
        : [...currentBreakpoints, breakpoint];

      // Ensure at least one breakpoint is selected
      if (newBreakpoints.length === 0) return;

      handleUpdateTimeline({ breakpoints: newBreakpoints });
    },
    [selectedInteraction, handleUpdateTimeline]
  );

  // Check if there's an active trigger (different layer selected or target selected)
  const hasActiveTrigger = selectedInteractionId !== null;

  return (
    <div className="flex flex-col">
      {/* Trigger Layer */}
      <div className="flex items-center gap-2 my-2">
        {onStateChange && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                disabled={!hasActiveTrigger}
                onClick={() => onStateChange({ shouldRefresh: true })}
              >
                <Icon name="undo" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Switch to a different trigger element</TooltipContent>
          </Tooltip>
        )}

        <div
          onClick={() => onSelectLayer?.(triggerLayer.id)}
          className={cn('flex-1 flex items-center gap-2 px-2 py-1.75 rounded-lg transition-colors cursor-pointer bg-secondary/50 hover:bg-secondary/100')}
        >
          <div className={cn('size-5 flex items-center justify-center rounded-[6px] bg-secondary/50 hover:bg-secondary/100')}>
            <Icon name={getLayerIcon(triggerLayer)} className="size-2.5" />
          </div>
          <Label variant="muted" className="cursor-pointer">
            {getLayerName(triggerLayer)}
          </Label>
        </div>
      </div>

      {/* Trigger Events Header */}
      <header className="py-5 flex justify-between -mt-2">
        <span className="font-medium">Trigger events</span>
        <div className="-my-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="xs" variant="secondary">
                <Icon name="plus" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="mr-4">
              <DropdownMenuItem onClick={() => handleAddInteraction('click')} disabled={usedTriggers.has('click')}>Click</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddInteraction('hover')} disabled={usedTriggers.has('hover')}>Hover</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddInteraction('scroll-into-view')} disabled={usedTriggers.has('scroll-into-view')}>Scroll into view</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddInteraction('while-scrolling')} disabled={usedTriggers.has('while-scrolling')}>While scrolling</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleAddInteraction('load')} disabled={usedTriggers.has('load')}>Page load</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Interaction List */}
      {interactions.length === 0 ? (
        <Empty>
          <EmptyDescription>
            Add a trigger event to start an interaction.
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {interactions.map((interaction) => (
            <div
              key={interaction.id}
              onClick={() => {
                setSelectedInteractionId(interaction.id);
              }}
              className={cn(
                'flex items-center gap-2 px-2 py-1.75 rounded-lg transition-colors text-left w-full cursor-pointer',
                selectedInteractionId === interaction.id
                  ? 'bg-teal-500/50 text-primary-foreground'
                  : 'bg-secondary/50 hover:bg-secondary/100'
              )}
            >
              <div
                className={cn(
                  'size-5 flex items-center justify-center rounded-[6px]',
                  selectedInteractionId === interaction.id
                    ? 'bg-primary-foreground/20'
                    : 'bg-secondary'
                )}
              >
                <Icon name="zap" className="size-2.5" />
              </div>

              <Label
                variant={selectedInteractionId === interaction.id ? 'default' : 'muted'}
                className="cursor-pointer"
              >
                {TRIGGER_LABELS[interaction.trigger]}
              </Label>

              <div className="ml-auto -my-1 -mr-0.5">
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveInteraction(interaction.id);
                  }}
                >
                  <Icon name="x" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Animated By Section - Show when no trigger is selected and this layer is animated by others */}
      {!hasActiveTrigger && animatedByLayers.length > 0 && (
        <div className="mt-4 border-t">
          <header className="py-5">
            <span className="font-medium">This layer is animated by</span>
          </header>

          <div className="flex flex-col gap-2">
            {animatedByLayers.map(({ layer, triggerType }) => (
              <div
                key={layer.id}
                onClick={() => onSelectLayer?.(layer.id)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors cursor-pointer bg-secondary/50 hover:bg-secondary/100"
              >
                <div className="size-5 flex items-center justify-center rounded-[6px] bg-secondary">
                  <Icon name={getLayerIcon(layer)} className="size-2.5" />
                </div>

                <Label variant="muted" className="cursor-pointer">
                  {getLayerName(layer)}
                </Label>

                <Badge variant="secondary" className="ml-auto">
                  {TRIGGER_LABELS[triggerType]}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interaction settings - Show when interaction is selected */}
      {selectedInteraction && (
        <div className="border-t">
          <header className="py-5 flex justify-between">
            <span className="font-medium">Interaction settings</span>
          </header>

          <div className="flex flex-col gap-2 pb-4">
            {/* Breakpoints */}
            <div className="grid grid-cols-3 items-center">
              <Label variant="muted">Run on</Label>
              <div className="col-span-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full justify-between"
                    >
                      <span className="capitalize">
                        {(selectedInteraction.timeline?.breakpoints?.length ?? 0) === 3
                          ? 'All breakpoints'
                          : selectedInteraction.timeline?.breakpoints?.join(', ') || 'No breakpoints'}
                      </span>
                      <Icon name="chevronCombo" className="size-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {(['mobile', 'tablet', 'desktop'] as Breakpoint[]).map((bp) => (
                      <DropdownMenuCheckboxItem
                        key={bp}
                        checked={selectedInteraction.timeline?.breakpoints?.includes(bp) ?? false}
                        onCheckedChange={() => handleToggleBreakpoint(bp)}
                        className="capitalize"
                      >
                        {bp}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Loop */}
            <div className="grid grid-cols-3 items-center">
              <Label variant="muted">Effect</Label>
              <div className="col-span-2">
                <Select
                  value={
                    (selectedInteraction.timeline?.repeat ?? 0) === 0
                      ? selectedInteraction.timeline?.yoyo ? 'reverse' : 'reset'
                      : selectedInteraction.timeline?.yoyo ? 'loop-reverse' : 'loop'
                  }
                  onValueChange={(value: 'reset' | 'reverse' | 'loop' | 'loop-reverse') => {
                    if (value === 'reset') {
                      handleUpdateTimeline({ repeat: 0, yoyo: false });
                    } else if (value === 'reverse') {
                      handleUpdateTimeline({ repeat: 0, yoyo: true });
                    } else if (value === 'loop') {
                      handleUpdateTimeline({ repeat: -1, yoyo: false });
                    } else if (value === 'loop-reverse') {
                      handleUpdateTimeline({ repeat: -1, yoyo: true });
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reset">Reset and run once</SelectItem>
                    <SelectItem value="reverse">Toggle and run once</SelectItem>
                    <SelectItem value="loop">Loop - Reset and restart</SelectItem>
                    <SelectItem value="loop-reverse">Loop - Toggle and restart</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Tweens Section - Show when interaction is selected */}
      {selectedInteraction && (
        <div className="border-t">
          <header className="py-5 flex justify-between">
            <span className="font-medium">Animations</span>
            <div className="-my-1 flex gap-1">
              {(() => {
                const hasAnimationsWithProperties = (selectedInteraction.tweens || []).some(
                  (tween) => getTweenProperties(tween).length > 0
                );
                return (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="xs"
                          variant="secondary"
                          className="size-6 p-0"
                          onClick={playAllAnimations}
                          disabled={!hasAnimationsWithProperties}
                        >
                          <Icon name="play" className="size-2.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Play all animations</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="xs"
                          variant="secondary"
                          className="size-6 p-0"
                          onClick={clearAllPreviewStyles}
                          disabled={!hasAnimationsWithProperties}
                        >
                          <Icon name="stop" className="size-2.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Reset all animations</TooltipContent>
                    </Tooltip>
                  </>
                );
              })()}
              <Button
                size="xs"
                variant="secondary"
                onClick={handleAddTween}
                disabled={!selectedLayerId}
              >
                <Icon name="plus" />
              </Button>
            </div>
          </header>

          {(selectedInteraction.tweens || []).length === 0 ? (
            <Empty>
              <EmptyDescription>
                Select a layer and add an animation.
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="pb-4">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                modifiers={[restrictToParentElement]}
                onDragEnd={handleReorderTweens}
              >
                <SortableContext
                  items={(selectedInteraction.tweens || []).map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-2">
                    {(selectedInteraction.tweens || []).map((tween, index, tweens) => (
                      <SortableAnimationItem
                        key={tween.id}
                        tween={tween}
                        index={index}
                        tweens={tweens}
                        isSelected={selectedTweenId === tween.id}
                        targetLayer={findLayerById(allLayers, tween.layer_id)}
                        onSelect={() => setSelectedTweenId(tween.id)}
                        onRemove={() => handleRemoveTween(tween.id)}
                        onSelectLayer={onSelectLayer}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      )}

      {/* Tween Settings - Only show when tween is selected */}
      {selectedInteraction && selectedTween && (
        <div className="border-t">
          <header className="py-5 flex justify-between">
            <span className="font-medium">Animation settings</span>
            {(() => {
              const hasProperties = getTweenProperties(selectedTween).length > 0;
              return (
                <div className="-my-1 flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="xs"
                        variant="secondary"
                        className="size-6 p-0"
                        disabled={!hasProperties}
                        onClick={() => {
                          const { from, to, displayStart, displayEnd } = buildGsapProps(selectedTween);
                          playTweenPreview(
                            selectedTween.layer_id,
                            from,
                            to,
                            selectedTween.duration,
                            selectedTween.ease,
                            displayStart,
                            displayEnd
                          );
                        }}
                      >
                        <Icon name="play" className="size-2.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Play animation</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="xs"
                        variant="secondary"
                        className="size-6 p-0"
                        disabled={!hasProperties}
                        onClick={clearAllPreviewStyles}
                      >
                        <Icon name="stop" className="size-2.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset animation</TooltipContent>
                  </Tooltip>
                </div>
              );
            })()}
          </header>

          <div className="flex flex-col gap-2 pb-4">
            {(() => {
              const isAtMode = typeof selectedTween.position === 'number';
              const selectValue = isAtMode ? 'at' : String(selectedTween.position);

              return (
                <div className="grid grid-cols-3 items-center">
                  <Label variant="muted">Start</Label>

                  <div className="col-span-2 flex gap-1.5">
                    <Select
                      value={selectValue}
                      onValueChange={(value) => {
                        if (value === 'at') {
                          handleUpdateTween(selectedTween.id, { position: 0.0 });
                        } else {
                          handleUpdateTween(selectedTween.id, { position: value });
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        {START_POSITION_OPTIONS[selectValue]?.short}
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(START_POSITION_OPTIONS).map(([value, labels]) => (
                          <SelectItem key={value} value={value}>
                            {labels.long}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {isAtMode && (
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        className="w-full"
                        value={typeof selectedTween.position === 'number'
                          ? selectedTween.position.toFixed(1)
                          : selectedTween.position}
                        onChange={(e) =>
                          handleUpdateTween(selectedTween.id, {
                            position: Number(e.target.value),
                          })
                        }
                      />
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-3">
              <Label variant="muted">Duration</Label>
              <div className="col-span-2 *:w-full">
                <InputGroup>
                  <InputGroupInput
                    type="number"
                    step="0.1"
                    value={selectedTween.duration}
                    onChange={(e) =>
                      handleUpdateTween(selectedTween.id, {
                        duration: Number(e.target.value),
                      })
                    }
                    placeholder="0"
                  />
                  <InputGroupAddon align="inline-end" className="text-xs text-muted-foreground">
                    sec
                  </InputGroupAddon>
                </InputGroup>
              </div>
            </div>

            <div className="grid grid-cols-3">
              <Label variant="muted">Ease</Label>
              <div className="col-span-2">
                <Select
                  value={selectedTween.ease}
                  onValueChange={(value) =>
                    handleUpdateTween(selectedTween.id, {
                      ease: value,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EASE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <Icon name={opt.icon} />
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Properties Section - Only show when tween is selected */}
      {selectedInteraction && selectedTween && (
        <div className="border-t pb-6">
          <header className="py-5 flex justify-between">
            <span className="font-medium">Animated properties</span>
            <div className="-my-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="xs" variant="secondary">
                    <Icon name="plus" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="mr-4">
                  {PROPERTY_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.type}
                      onClick={() => handleAddPropertyToTween(selectedTween.id, opt.type)}
                      disabled={isPropertyInTween(selectedTween, opt.type)}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {(() => {
            const tweenProperties = getTweenProperties(selectedTween);
            return tweenProperties.length === 0 ? (
              <Empty>
                <EmptyDescription>
                  Add a property to animate.
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="flex flex-col gap-2.5">
                {tweenProperties.map((propertyOption) => (
                  <div key={propertyOption.type} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {propertyOption.label}
                      </span>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="size-5 p-0"
                        onClick={() => handleRemovePropertyFromTween(selectedTween.id, propertyOption.type)}
                      >
                        <Icon name="x" className="size-2.5" />
                      </Button>
                    </div>

                    {propertyOption.properties.map((prop) => {
                      const fromValue = selectedTween.from[prop.key];
                      const toValue = selectedTween.to[prop.key];
                      const isFromCurrent = fromValue === null || fromValue === undefined;
                      const isToCurrent = toValue === null || toValue === undefined;

                      const setFromValue = (value: string | null) => {
                        handleUpdateTween(selectedTween.id, {
                          from: { ...selectedTween.from, [prop.key]: value },
                        });
                      };

                      const getDefaultFromAfterCurrent = () => prop.defaultFromAfterCurrent;
                      const getDefaultToAfterCurrent = () => prop.defaultTo ?? '0';

                      // Determine animation mode based on from/to values
                      type AnimationMode = 'current-to-custom' | 'custom-to-current' | 'custom-to-custom';
                      const animationMode: AnimationMode = isFromCurrent
                        ? 'current-to-custom'
                        : isToCurrent
                          ? 'custom-to-current'
                          : 'custom-to-custom';

                      const handleModeChange = (mode: AnimationMode) => {
                        // Update both from and to in a single call to avoid state race conditions
                        const newFrom = mode === 'current-to-custom'
                          ? null
                          : (isFromCurrent ? getDefaultFromAfterCurrent() : fromValue);
                        const newTo = mode === 'custom-to-current'
                          ? null
                          : (isToCurrent ? getDefaultToAfterCurrent() : toValue);

                        // When from is current/null, apply_styles must be on-trigger
                        const newApplyStyles = mode === 'current-to-custom'
                          ? 'on-trigger'
                          : selectedTween.apply_styles?.[prop.key] || 'on-trigger';

                        handleUpdateTween(selectedTween.id, {
                          from: { ...selectedTween.from, [prop.key]: newFrom },
                          to: { ...selectedTween.to, [prop.key]: newTo },
                          apply_styles: { ...selectedTween.apply_styles, [prop.key]: newApplyStyles },
                        });
                      };

                      const applyFromPreview = (value: string | null) => {
                        // Skip display
                        if (prop.key === 'display') return;

                        if (value === null || value === undefined) return;
                        const gsapValue = toGsapValue(value, prop);
                        if (gsapValue !== undefined) {
                          applyPreviewStyles(selectedTween.layer_id, { [prop.key]: gsapValue });
                        }
                      };

                      const applyToPreview = (value: string | null) => {
                        // Skip display
                        if (prop.key === 'display') return;

                        if (value === null || value === undefined) return;
                        const gsapValue = toGsapValue(value, prop);
                        if (gsapValue !== undefined) {
                          applyPreviewStyles(selectedTween.layer_id, { [prop.key]: gsapValue });
                        }
                      };

                      const handlePreviewFrom = () => {
                        if (isFromCurrent) return;
                        // Clear any existing preview (e.g., from played animation) before applying
                        clearAllPreviewStyles();
                        applyFromPreview(fromValue as string);
                      };

                      const handlePreviewTo = () => {
                        // Clear any existing preview (e.g., from played animation) before applying
                        clearAllPreviewStyles();
                        const toValue = selectedTween.to[prop.key];
                        applyToPreview(toValue as string);
                      };

                      const handleFromChange = (value: string) => {
                        isChangingPropertyRef.current = true;
                        setFromValue(value);
                        // Apply preview after iframe re-renders (double RAF to ensure DOM is updated)
                        requestAnimationFrame(() => {
                          requestAnimationFrame(() => {
                            // Update originalStyle after iframe re-renders (element may have been recreated)
                            const element = getIframeElement(selectedTween.layer_id);
                            if (element && previewedElementRef.current?.layerId === selectedTween.layer_id) {
                              previewedElementRef.current = {
                                ...previewedElementRef.current,
                                element,
                                originalStyle: element.getAttribute('style') || '',
                              };
                            }
                            applyFromPreview(value);
                            isChangingPropertyRef.current = false;
                          });
                        });
                      };

                      const handleToChange = (value: string) => {
                        isChangingPropertyRef.current = true;
                        handleUpdateTween(selectedTween.id, {
                          to: { ...selectedTween.to, [prop.key]: value },
                        });
                        // Apply preview after iframe re-renders (double RAF to ensure DOM is updated)
                        requestAnimationFrame(() => {
                          requestAnimationFrame(() => {
                            // Update originalStyle after iframe re-renders (element may have been recreated)
                            const element = getIframeElement(selectedTween.layer_id);
                            if (element && previewedElementRef.current?.layerId === selectedTween.layer_id) {
                              previewedElementRef.current = {
                                ...previewedElementRef.current,
                                element,
                                originalStyle: element.getAttribute('style') || '',
                              };
                            }
                            applyToPreview(value);
                            isChangingPropertyRef.current = false;
                          });
                        });
                      };

                      return (
                        <div key={prop.key} className="flex items-center gap-1.25">
                          {!prop.toOnly && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="xs"
                                    variant="secondary"
                                    className="size-7 p-0 shrink-0 transition-none"
                                    disabled={isFromCurrent}
                                    onClick={() => {
                                      const currentValue = selectedTween.apply_styles?.[prop.key] || 'on-trigger';
                                      handleUpdateTween(selectedTween.id, {
                                        apply_styles: {
                                          ...selectedTween.apply_styles,
                                          [prop.key]: currentValue === 'on-load' ? 'on-trigger' : 'on-load',
                                        },
                                      });
                                    }}
                                  >
                                    <Icon name={selectedTween.apply_styles?.[prop.key] === 'on-load' ? 'page' : 'cursor-default'} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" align="start">
                                  {selectedTween.apply_styles?.[prop.key] === 'on-load'
                                    ? 'Apply property style on page load'
                                    : 'Apply property style on trigger'}
                                </TooltipContent>
                              </Tooltip>

                              <div className="w-full flex items-center gap-1.5">
                                {isFromCurrent ? (
                                  <Button
                                    size="xs"
                                    variant="secondary"
                                    className="h-7 transition-none flex-1"
                                    disabled
                                  >
                                    Current
                                  </Button>
                                ) : prop.options ? (
                                  <Select
                                    value={fromValue as string}
                                    onValueChange={handleFromChange}
                                    onOpenChange={(open) => open ? handlePreviewFrom() : clearPreviewStyles()}
                                  >
                                    <SelectTrigger className="flex-1 h-7 text-xs">
                                      <SelectValue placeholder="From" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {prop.options.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : prop.unit ? (
                                  <InputGroup className="flex-1 h-7">
                                    <InputGroupInput
                                      value={fromValue ?? ''}
                                      onChange={(e) => handleFromChange(e.target.value)}
                                      onFocus={handlePreviewFrom}
                                      onBlur={() => clearPreviewStyles()}
                                      placeholder="0"
                                      className="text-xs"
                                    />
                                    <InputGroupAddon align="inline-end" className="text-xs text-muted-foreground">
                                      {prop.unit}
                                    </InputGroupAddon>
                                  </InputGroup>
                                ) : (
                                  <Input
                                    value={fromValue ?? ''}
                                    onChange={(e) => handleFromChange(e.target.value)}
                                    onFocus={handlePreviewFrom}
                                    onBlur={() => clearPreviewStyles()}
                                    placeholder="0"
                                    className="flex-1 h-7 text-xs"
                                  />
                                )}
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    className="size-7 p-0 shrink-0"
                                  >
                                    <Icon name="chevronRight" className="size-2.5 opacity-60" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="center" side="bottom">
                                  <DropdownMenuCheckboxItem
                                    checked={animationMode === 'current-to-custom'}
                                    onCheckedChange={() => handleModeChange('current-to-custom')}
                                  >
                                    Current value <Icon name="chevronRight" className="size-2.5 opacity-60" /> Set value
                                  </DropdownMenuCheckboxItem>
                                  <DropdownMenuCheckboxItem
                                    checked={animationMode === 'custom-to-current'}
                                    onCheckedChange={() => handleModeChange('custom-to-current')}
                                  >
                                    Set value <Icon name="chevronRight" className="size-2.5 opacity-60" /> Current value
                                  </DropdownMenuCheckboxItem>
                                  <DropdownMenuCheckboxItem
                                    checked={animationMode === 'custom-to-custom'}
                                    onCheckedChange={() => handleModeChange('custom-to-custom')}
                                  >
                                    Set value <Icon name="chevronRight" className="size-2.5 opacity-60" /> Set value
                                  </DropdownMenuCheckboxItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </>
                          )}

                          <div className="w-full flex items-center gap-1.5">
                            {isToCurrent ? (
                              <Button
                                size="xs"
                                variant="secondary"
                                className="h-7 transition-none flex-1"
                                disabled
                              >
                                Current
                              </Button>
                            ) : prop.options ? (
                              <Select
                                value={toValue as string}
                                onValueChange={handleToChange}
                                onOpenChange={(open) => open ? handlePreviewTo() : clearPreviewStyles()}
                              >
                                <SelectTrigger className="flex-1 h-7 text-xs">
                                  <SelectValue placeholder="To" />
                                </SelectTrigger>
                                <SelectContent>
                                  {prop.options.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : prop.unit ? (
                              <InputGroup className="flex-1 h-7">
                                <InputGroupInput
                                  value={toValue ?? ''}
                                  onChange={(e) => handleToChange(e.target.value)}
                                  onFocus={handlePreviewTo}
                                  onBlur={() => clearPreviewStyles()}
                                  placeholder="0"
                                  className="text-xs"
                                />
                                <InputGroupAddon align="inline-end" className="text-xs text-muted-foreground">
                                  {prop.unit}
                                </InputGroupAddon>
                              </InputGroup>
                            ) : (
                              <Input
                                value={toValue ?? ''}
                                onChange={(e) => handleToChange(e.target.value)}
                                onFocus={handlePreviewTo}
                                onBlur={() => clearPreviewStyles()}
                                placeholder="0"
                                className="flex-1 h-7 text-xs"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
