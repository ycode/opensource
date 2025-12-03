'use client';

/**
 * InteractionsPanel - Manages layer interactions and animations
 *
 * Handles triggers (click, hover, etc.) and their associated transitions
 */

// 1. React/Next.js
import React, { useState, useCallback, useMemo, useEffect } from 'react';

// 2. ShadCN UI
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyDescription } from '@/components/ui/empty';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// 3. Utils
import { cn } from '@/lib/utils';
import { getLayerName, getLayerIcon } from '@/lib/layer-utils';

// 4. Types
import type { Layer, LayerInteraction, InteractionTarget, InteractionAnimation, InteractionProperty } from '@/types';
import { Badge } from '@/components/ui/badge';

interface InteractionsPanelProps {
  triggerLayer: Layer;
  allLayers: Layer[]; // All layers available for target selection
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  selectedLayerId?: string | null; // Currently selected layer in editor
  resetKey?: number; // When this changes, reset all selections
  onStateChange?: (state: {
    selectedTriggerId?: string | null;
    shouldRefresh?: boolean;
  }) => void;
  onSelectLayer?: (layerId: string) => void; // Callback to select a layer in the editor
}

type TriggerType = 'click' | 'hover' | 'scroll-into-view' | 'while-scrolling' | 'load';
type PropertyType = 'position' | 'scale' | 'rotation' | 'skew' | 'opacity';

interface PropertyOption {
  type: PropertyType;
  label: string;
  properties: Array<{
    key: keyof InteractionProperty;
    label: string;
    unit: string;
  }>;
}

const PROPERTY_OPTIONS: PropertyOption[] = [
  {
    type: 'position',
    label: 'Position',
    properties: [
      { key: 'x', label: 'X', unit: 'px' },
      { key: 'y', label: 'Y', unit: 'px' },
    ],
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
    type: 'skew',
    label: 'Skew',
    properties: [
      { key: 'skewX', label: 'X', unit: 'deg' },
      { key: 'skewY', label: 'Y', unit: 'deg' },
    ],
  },
  {
    type: 'opacity',
    label: 'Opacity',
    properties: [{ key: 'opacity', label: 'Value', unit: '' }],
  },
];

const TRIGGER_LABELS: Record<TriggerType, string> = {
  'click': 'Click',
  'hover': 'Hover',
  'scroll-into-view': 'Scroll into view',
  'while-scrolling': 'While scrolling',
  'load': 'Page load',
};

export default function InteractionsPanel({
  triggerLayer,
  allLayers,
  onLayerUpdate,
  selectedLayerId,
  resetKey,
  onStateChange,
  onSelectLayer,
}: InteractionsPanelProps) {
  const [selectedInteractionId, setSelectedInteractionId] = useState<string | null>(null);
  const [expandedAnimations, setExpandedAnimations] = useState<Set<string>>(new Set());

  // Reset selections when trigger layer changes or reset is triggered
  useEffect(() => {
    setSelectedInteractionId(null);
    setExpandedAnimations(new Set());
  }, [triggerLayer.id, resetKey]);

  // Memoize interactions to prevent unnecessary re-renders
  const interactions = useMemo(() => triggerLayer.interactions || [], [triggerLayer.interactions]);
  const selectedInteraction = interactions.find((i) => i.id === selectedInteractionId);
  const usedTriggers = useMemo(() => new Set(interactions.map(i => i.trigger)), [interactions]);
  // Find target that matches the currently selected layer
  const selectedTarget =
    selectedInteraction && selectedLayerId
      ? selectedInteraction.targets.find((t) => t.layer_id === selectedLayerId) || null
      : null;

  // Flatten layers for selection
  const flatLayers = useMemo(() => {
    const flatten = (layers: Layer[], depth = 0): Array<{ layer: Layer; depth: number }> => {
      const result: Array<{ layer: Layer; depth: number }> = [];
      layers.forEach((l) => {
        result.push({ layer: l, depth });
        if (l.children) {
          result.push(...flatten(l.children, depth + 1));
        }
      });
      return result;
    };
    return flatten(allLayers);
  }, [allLayers]);

  // Find layers that animate the current trigger layer (where this layer is a target)
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
        // Find the first interaction that targets this layer
        const matchingInteraction = layerInteractions.find((interaction) =>
          interaction.targets.some((target) => target.layer_id === triggerLayer.id)
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

  // Auto-select first target when a trigger event is selected (only on ID change)
  useEffect(() => {
    if (selectedInteractionId) {
      const interaction = interactions.find((i) => i.id === selectedInteractionId);
      const firstTarget = interaction?.targets[0];
      if (firstTarget && onSelectLayer) {
        const targetLayer = flatLayers.find((fl) => fl.layer.id === firstTarget.layer_id)?.layer;
        if (targetLayer) {
          onSelectLayer(targetLayer.id);
        }
      }
    }
    // Only run when selectedInteractionId changes, not when interaction content changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInteractionId]);

  // Generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
        id: generateId(),
        trigger,
        targets: [], // Start with no targets - user will add them
      };

      const updatedInteractions = [...interactions, newInteraction];
      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
      setSelectedInteractionId(newInteraction.id);
    },
    [interactions, triggerLayer.id, onLayerUpdate]
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

  // Add target layer
  const handleAddTarget = useCallback(
    (layerId: string) => {
      if (!selectedInteraction) return;

      const newTarget: InteractionTarget = {
        layer_id: layerId,
        animations: [],
      };

      const updatedInteractions = interactions.map((interaction) => {
        if (interaction.id !== selectedInteractionId) return interaction;
        return {
          ...interaction,
          targets: [...interaction.targets, newTarget],
        };
      });

      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
      // Select the newly added target in the editor
      if (onSelectLayer) {
        onSelectLayer(layerId);
      }
    },
    [selectedInteraction, interactions, selectedInteractionId, triggerLayer.id, onLayerUpdate, onSelectLayer]
  );

  // Remove target layer
  const handleRemoveTarget = useCallback(
    (layerIdToRemove: string) => {
      if (!selectedInteraction) return;

      const updatedInteractions = interactions.map((interaction) => {
        if (interaction.id !== selectedInteractionId) return interaction;
        return {
          ...interaction,
          targets: interaction.targets.filter((t) => t.layer_id !== layerIdToRemove),
        };
      });

      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
    },
    [selectedInteraction, interactions, selectedInteractionId, triggerLayer.id, onLayerUpdate]
  );

  // Add animation property
  const handleAddProperty = useCallback(
    (propertyType: PropertyType) => {
      if (!selectedInteraction || !selectedLayerId) return;

      const propertyOption = PROPERTY_OPTIONS.find((p) => p.type === propertyType);
      if (!propertyOption) return;

      // Build from/to objects with default values for this property type
      const from: InteractionProperty = {};
      const to: InteractionProperty = {};
      propertyOption.properties.forEach((prop) => {
        const key = prop.key;
        if (key !== 'visibility') {
          from[key] = '0';
          to[key] = key === 'scale' ? '1' : '100';
        }
      });

      const newAnimation: InteractionAnimation = {
        id: generateId(),
        delay: 0,
        duration: 300,
        repeat: false,
        yoyo: false,
        ease: 'power1.out',
        from,
        to,
      };

      const updatedInteractions = interactions.map((interaction) => {
        if (interaction.id !== selectedInteractionId) return interaction;

        const updatedTargets = interaction.targets.map((target) => {
          if (target.layer_id !== selectedLayerId) return target;
          return {
            ...target,
            animations: [...target.animations, newAnimation],
          };
        });

        return { ...interaction, targets: updatedTargets };
      });

      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
      setExpandedAnimations(new Set([...expandedAnimations, newAnimation.id]));
    },
    [
      selectedInteraction,
      selectedLayerId,
      interactions,
      selectedInteractionId,
      triggerLayer.id,
      onLayerUpdate,
      expandedAnimations,
    ]
  );

  // Remove animation
  const handleRemoveAnimation = useCallback(
    (animationId: string) => {
      if (!selectedInteraction || !selectedLayerId) return;

      const updatedInteractions = interactions.map((interaction) => {
        if (interaction.id !== selectedInteractionId) return interaction;

        const updatedTargets = interaction.targets.map((target) => {
          if (target.layer_id !== selectedLayerId) return target;
          return {
            ...target,
            animations: target.animations.filter((a) => a.id !== animationId),
          };
        });

        return { ...interaction, targets: updatedTargets };
      });

      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
      setExpandedAnimations((prev) => {
        const next = new Set(prev);
        next.delete(animationId);
        return next;
      });
    },
    [
      selectedInteraction,
      selectedLayerId,
      interactions,
      selectedInteractionId,
      triggerLayer.id,
      onLayerUpdate,
    ]
  );

  // Update animation
  const handleUpdateAnimation = useCallback(
    (animationId: string, updates: Partial<InteractionAnimation>) => {
      if (!selectedInteraction || !selectedLayerId) return;

      const updatedInteractions = interactions.map((interaction) => {
        if (interaction.id !== selectedInteractionId) return interaction;

        const updatedTargets = interaction.targets.map((target) => {
          if (target.layer_id !== selectedLayerId) return target;
          return {
            ...target,
            animations: target.animations.map((a) =>
              a.id === animationId ? { ...a, ...updates } : a
            ),
          };
        });

        return { ...interaction, targets: updatedTargets };
      });

      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
    },
    [
      selectedInteraction,
      selectedLayerId,
      interactions,
      selectedInteractionId,
      triggerLayer.id,
      onLayerUpdate,
    ]
  );

  // Toggle animation expansion
  const toggleAnimation = useCallback((animationId: string) => {
    setExpandedAnimations((prev) => {
      const next = new Set(prev);
      if (next.has(animationId)) {
        next.delete(animationId);
      } else {
        next.add(animationId);
      }
      return next;
    });
  }, []);

  // Get property option for animation based on which properties are set
  const getAnimationPropertyOption = (animation: InteractionAnimation): PropertyOption | null => {
    return PROPERTY_OPTIONS.find((opt) =>
      opt.properties.some((p) => animation.from[p.key] !== undefined && animation.from[p.key] !== null)
    ) || null;
  };

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

      {/* Interaction Details - Targets Section */}
      {selectedInteraction && (
        <div className="mt-4 border-t">
          {/* Targets Header */}
          <header className="py-5 flex justify-between">
            <span className="font-medium">Layers to animate</span>
            <div className="-my-1">
              <Button
                size="xs"
                variant="secondary"
                onClick={() => {
                  if (selectedLayerId) {
                    handleAddTarget(selectedLayerId);
                  }
                }}
                disabled={!selectedLayerId || selectedInteraction.targets.some(t => t.layer_id === selectedLayerId)}
              >
                <Icon name="plus" />
              </Button>
            </div>
          </header>

          {/* Target List */}
          {selectedInteraction.targets.length === 0 ? (
            <Empty>
              <EmptyDescription>
                Select a layer you want to animate and click on the plus button to add it.
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="flex flex-col gap-2 mb-4">
              {selectedInteraction.targets.map((target, index) => {
                const targetLayer = flatLayers.find((fl) => fl.layer.id === target.layer_id)?.layer;
                const isActive = selectedLayerId === target.layer_id;

                return (
                  <div
                    key={index}
                    onClick={() => {
                      if (onSelectLayer && targetLayer) {
                        onSelectLayer(targetLayer.id);
                      }
                    }}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.75 rounded-lg transition-colors text-left w-full cursor-pointer',
                      isActive
                        ? 'bg-teal-500/50 text-primary-foreground'
                        : 'bg-secondary/50 hover:bg-secondary/100'
                    )}
                  >
                    <div
                      className={cn(
                        'size-5 flex items-center justify-center rounded-[6px]',
                        isActive ? 'bg-primary-foreground/20' : 'bg-secondary'
                      )}
                    >
                      <Icon name="layers" className="size-2.5" />
                    </div>

                    <Label variant={isActive ? 'default' : 'muted'} className="cursor-pointer">
                      {targetLayer ? getLayerName(targetLayer) : 'Unknown Layer'}
                    </Label>

                    <div className="ml-auto -my-1 -mr-0.5">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTarget(target.layer_id);
                        }}
                      >
                        <Icon name="x" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Properties Section - Only show when target is selected */}
      {selectedInteraction && selectedTarget && (
        <div className="border-t">
          {/* Properties Header */}
          <header className="py-5 flex justify-between">
            <span className="font-medium">Properties to animate</span>
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
                      onClick={() => handleAddProperty(opt.type)}
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Animations List */}
          {selectedTarget.animations.length === 0 ? (
            <Empty>
              <EmptyDescription>
                Add a property to animate to get started.
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="space-y-4">
              {selectedTarget.animations.map((animation) => {
                const propertyOption = getAnimationPropertyOption(animation);
                const isExpanded = expandedAnimations.has(animation.id);

                return (
                  <div key={animation.id} className="px-4 bg-secondary/50 rounded-lg">
                    {/* Animation Header */}
                    <header
                      onClick={() => toggleAnimation(animation.id)}
                      className="px-4 flex items-center gap-1.5 cursor-pointer hover:bg-secondary/25 rounded-lg -mx-4 py-3 transition-colors"
                    >
                      <Icon
                        name="chevronRight"
                        className={cn(
                          'size-3 opacity-50 transition-transform',
                          isExpanded && 'rotate-90'
                        )}
                      />

                      <Label className="cursor-pointer">
                        {propertyOption?.label || 'Property'}
                      </Label>

                      <div className="ml-auto">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAnimation(animation.id);
                          }}
                        >
                          <Icon name="x" />
                        </Button>
                      </div>
                    </header>

                    {/* Animation Details */}
                    {isExpanded && (
                      <div className="-mt-4">
                        {/* Property Values */}
                        <div className="py-4 flex flex-col gap-4">
                          {propertyOption?.properties.map((prop) => (
                            <div key={prop.key} className="flex flex-col gap-2">
                              <Label variant="muted">{prop.label}</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  value={animation.from[prop.key] ?? ''}
                                  onChange={(e) =>
                                    handleUpdateAnimation(animation.id, {
                                      from: {
                                        ...animation.from,
                                        [prop.key]: e.target.value,
                                      },
                                    })
                                  }
                                  placeholder="From"
                                />
                                <Icon
                                  name="chevronRight"
                                  className="size-3 opacity-50 shrink-0"
                                />
                                <Input
                                  value={animation.to[prop.key] ?? ''}
                                  onChange={(e) =>
                                    handleUpdateAnimation(animation.id, {
                                      to: {
                                        ...animation.to,
                                        [prop.key]: e.target.value,
                                      },
                                    })
                                  }
                                  placeholder="To"
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <hr />

                        {/* Timing Controls */}
                        <div className="flex flex-col gap-2 py-4">
                          <div className="grid grid-cols-3">
                            <Label variant="muted">Delay</Label>
                            <div className="col-span-2 *:w-full">
                              <Input
                                type="number"
                                value={animation.delay}
                                onChange={(e) =>
                                  handleUpdateAnimation(animation.id, {
                                    delay: Number(e.target.value),
                                  })
                                }
                                placeholder="ms"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3">
                            <Label variant="muted">Duration</Label>
                            <div className="col-span-2 *:w-full">
                              <Input
                                type="number"
                                value={animation.duration}
                                onChange={(e) =>
                                  handleUpdateAnimation(animation.id, {
                                    duration: Number(e.target.value),
                                  })
                                }
                                placeholder="ms"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
