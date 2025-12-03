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
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';

// 3. ShadCN UI
import Icon, { IconProps } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

type TriggerType = 'click' | 'hover' | 'scroll-into-view' | 'while-scrolling' | 'load';
type PropertyType = 'position-x' | 'position-y' | 'scale' | 'rotation' | 'skew-x' | 'skew-y' | 'opacity' | 'visibility';

interface PropertyOption {
  type: PropertyType;
  label: string;
  properties: Array<{
    key: keyof TweenProperties;
    label: string;
    unit: string;
    options?: Array<{ value: string; label: string }>;
  }>;
}

const PROPERTY_OPTIONS: PropertyOption[] = [
  {
    type: 'position-x',
    label: 'Position X',
    properties: [{ key: 'x', label: 'X', unit: 'px' }],
  },
  {
    type: 'position-y',
    label: 'Position Y',
    properties: [{ key: 'y', label: 'Y', unit: 'px' }],
  },
  {
    type: 'scale',
    label: 'Scale',
    properties: [{ key: 'scale', label: 'Scale', unit: '' }],
  },
  {
    type: 'rotation',
    label: 'Rotation',
    properties: [{ key: 'rotation', label: 'Angle', unit: 'deg' }],
  },
  {
    type: 'skew-x',
    label: 'Skew X',
    properties: [{ key: 'skewX', label: 'X', unit: 'deg' }],
  },
  {
    type: 'skew-y',
    label: 'Skew Y',
    properties: [{ key: 'skewY', label: 'Y', unit: 'deg' }],
  },
  {
    type: 'opacity',
    label: 'Opacity',
    properties: [{ key: 'opacity', label: 'Value', unit: '' }],
  },
  {
    type: 'visibility',
    label: 'Visibility',
    properties: [{
      key: 'visibility',
      label: 'Value',
      unit: '',
      options: [
        { value: 'visible', label: 'Visible' },
        { value: 'hidden', label: 'Hidden' },
      ],
    }],
  },
];

const TRIGGER_LABELS: Record<TriggerType, string> = {
  'click': 'Click',
  'hover': 'Hover',
  'scroll-into-view': 'Scroll into view',
  'while-scrolling': 'While scrolling',
  'load': 'Page load',
};

const START_POSITION_OPTIONS: Record<string, { short: string; long: string }> = {
  '>': { short: 'After previous', long: 'After previous animation ends' },
  '<': { short: 'With previous', long: 'With the previous animation' },
  'at': { short: 'At', long: 'At a specific time' },
};

const EASE_OPTIONS: { value: string; label: string; icon: IconProps['name'] }[] = [
  { value: 'none', label: 'Linear', icon: 'ease-linear' },
  { value: 'power1.in', label: 'Ease in', icon: 'ease-in' },
  { value: 'power1.inOut', label: 'Ease in out', icon: 'ease-in-out' },
  { value: 'power1.out', label: 'Ease out', icon: 'ease-out' },
  { value: 'back.in', label: 'Back in', icon: 'ease-back-in' },
  { value: 'back.inOut', label: 'Back in out', icon: 'ease-back-in-out' },
  { value: 'back.out', label: 'Back out', icon: 'ease-back-out' },
];

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

/** Calculate the actual start time in seconds for a tween */
function calculateTweenStartTime(tweens: InteractionTween[], index: number): number {
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

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Reset selections when trigger layer changes or reset is triggered
  useEffect(() => {
    setSelectedInteractionId(null);
    setSelectedTweenId(null);
  }, [triggerLayer.id, resetKey]);

  // Memoize interactions to prevent unnecessary re-renders
  const interactions = useMemo(() => triggerLayer.interactions || [], [triggerLayer.interactions]);
  const selectedInteraction = interactions.find((i) => i.id === selectedInteractionId);
  const usedTriggers = useMemo(() => new Set(interactions.map(i => i.trigger)), [interactions]);

  // Find selected tween
  const selectedTween =
    selectedInteraction && selectedTweenId
      ? (selectedInteraction.tweens || []).find((t) => t.id === selectedTweenId) || null
      : null;

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
          apply_styles: 'on-trigger',
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

            const newFrom = { ...tween.from };
            const newTo = { ...tween.to };
            propertyOption.properties.forEach((prop) => {
              const key = prop.key;
              if (key === 'visibility') {
                newFrom[key] = 'hidden';
                newTo[key] = 'visible';
              } else if (key === 'scale') {
                newFrom[key] = '0';
                newTo[key] = '1';
              } else if (key === 'opacity') {
                newFrom[key] = '0';
                newTo[key] = '1';
              } else {
                newFrom[key] = '0';
                newTo[key] = '100';
              }
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

  // Get all property options that are set in a tween (check both from and to)
  const getTweenProperties = (tween: InteractionTween): PropertyOption[] => {
    return PROPERTY_OPTIONS.filter((opt) =>
      opt.properties.some((p) => {
        const hasFrom = tween.from[p.key] !== undefined && tween.from[p.key] !== null;
        const hasTo = tween.to[p.key] !== undefined && tween.to[p.key] !== null;
        return hasFrom || hasTo;
      })
    );
  };

  // Check if a property type is already added to a tween
  const isPropertyInTween = (tween: InteractionTween, propertyType: PropertyType): boolean => {
    const propertyOption = PROPERTY_OPTIONS.find((p) => p.type === propertyType);
    if (!propertyOption) return false;
    return propertyOption.properties.some((p) => {
      const hasFrom = tween.from[p.key] !== undefined && tween.from[p.key] !== null;
      const hasTo = tween.to[p.key] !== undefined && tween.to[p.key] !== null;
      return hasFrom || hasTo;
    });
  };

  // Toggle breakpoint in timeline
  const handleToggleBreakpoint = useCallback(
    (breakpoint: Breakpoint) => {
      if (!selectedInteraction) return;

      const currentBreakpoints = selectedInteraction.timeline.breakpoints;
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
                        {selectedInteraction.timeline.breakpoints.length === 3
                          ? 'All breakpoints'
                          : selectedInteraction.timeline.breakpoints.join(', ')}
                      </span>
                      <Icon name="chevronCombo" className="size-3 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    {(['mobile', 'tablet', 'desktop'] as Breakpoint[]).map((bp) => (
                      <DropdownMenuCheckboxItem
                        key={bp}
                        checked={selectedInteraction.timeline.breakpoints.includes(bp)}
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
                    selectedInteraction.timeline.repeat === 0
                      ? selectedInteraction.timeline.yoyo ? 'reverse' : 'reset'
                      : selectedInteraction.timeline.yoyo ? 'loop-reverse' : 'loop'
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

            {/* Apply Styles */}
            <div className="grid grid-cols-3 items-center">
              <Label variant="muted">Styles</Label>
              <div className="col-span-2">
                <Select
                  value={selectedInteraction.timeline.apply_styles}
                  onValueChange={(value: 'on-load' | 'on-trigger') =>
                    handleUpdateTimeline({ apply_styles: value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="on-load">Apply on load</SelectItem>
                    <SelectItem value="on-trigger">Apply on trigger</SelectItem>
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
            <div className="-my-1">
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleReorderTweens}
            >
              <SortableContext
                items={(selectedInteraction.tweens || []).map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2 pb-4">
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
          )}
        </div>
      )}

      {/* Tween Settings - Only show when tween is selected */}
      {selectedInteraction && selectedTween && (
        <div className="border-t">
          <header className="py-5 flex justify-between">
            <span className="font-medium">Animation settings</span>
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
                <Input
                  type="number"
                  step="0.1"
                  value={selectedTween.duration}
                  onChange={(e) =>
                    handleUpdateTween(selectedTween.id, {
                      duration: Number(e.target.value),
                    })
                  }
                  placeholder="seconds"
                />
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
                      const isFromCurrent = fromValue === null || fromValue === undefined;

                      const setFromValue = (value: string | null) => {
                        handleUpdateTween(selectedTween.id, {
                          from: { ...selectedTween.from, [prop.key]: value },
                        });
                      };

                      const getDefaultFromValue = () => {
                        if (prop.key === 'visibility') return 'hidden';
                        if (prop.key === 'scale' || prop.key === 'opacity') return '0';
                        return '0';
                      };

                      return (
                        <div key={prop.key} className="flex items-center gap-1.25">
                          <div className="w-full flex items-center gap-1.5">
                            {isFromCurrent ? (
                              <Button
                                size="xs"
                                variant="secondary"
                                className="h-7 transition-none w-28.5"
                                onClick={() => setFromValue(getDefaultFromValue())}
                              >
                                Current
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="xs"
                                  variant="secondary"
                                  className="size-7 p-0 shrink-0 transition-none"
                                  onClick={() => setFromValue(null)}
                                  title="Use current value"
                                >
                                  <Icon name="none" />
                                </Button>

                                {prop.options ? (
                                  <Select
                                    value={fromValue as string}
                                    onValueChange={setFromValue}
                                  >
                                    <SelectTrigger className="flex-1 h-7 text-xs w-20">
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
                                ) : (
                                  <Input
                                    value={fromValue ?? ''}
                                    onChange={(e) => setFromValue(e.target.value)}
                                    placeholder="From"
                                    className="flex-1 h-7 text-xs w-20"
                                  />
                                )}
                              </>
                            )}
                          </div>

                          <Icon
                            name="chevronRight"
                            className="size-2.5 opacity-60 shrink-0"
                          />

                          <div className="w-full">
                            {prop.options ? (
                              <Select
                                value={(selectedTween.to[prop.key] as string) ?? ''}
                                onValueChange={(value) =>
                                  handleUpdateTween(selectedTween.id, {
                                    to: {
                                      ...selectedTween.to,
                                      [prop.key]: value,
                                    },
                                  })
                                }
                              >
                                <SelectTrigger className="w-full h-7 text-xs">
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
                            ) : (
                              <Input
                                value={selectedTween.to[prop.key] ?? ''}
                                onChange={(e) =>
                                  handleUpdateTween(selectedTween.id, {
                                    to: {
                                      ...selectedTween.to,
                                      [prop.key]: e.target.value,
                                    },
                                  })
                                }
                                placeholder={propertyOption.properties.length > 1 ? `${prop.label} to` : 'To'}
                                className="w-full h-7 text-xs"
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
