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

// 3. Utils
import { cn } from '@/lib/utils';
import { getLayerName, getLayerIcon } from '@/lib/layer-utils';

// 4. Types
import type { Layer, LayerInteraction, InteractionTarget, InteractionTransition } from '@/types';

interface InteractionsPanelProps {
  triggerLayer: Layer;
  allLayers: Layer[]; // All layers available for target selection
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  selectedLayerId?: string | null; // Currently selected layer in editor
  resetKey?: number; // When this changes, reset all selections
  onStateChange?: (state: {
    isSelectingTarget?: boolean;
    selectedTriggerId?: string | null;
    shouldRefresh?: boolean;
  }) => void;
  onSelectLayer?: (layerId: string) => void; // Callback to select a layer in the editor
}

type TriggerType = 'click' | 'hover' | 'scroll-into-view' | 'while-scrolling' | 'load';
type PropertyType = 'move' | 'scale' | 'rotate' | 'skew' | 'opacity' | 'filter';

interface PropertyOption {
  type: PropertyType;
  label: string;
  properties: Array<{
    key: string;
    label: string;
    unit: string;
  }>;
}

const PROPERTY_OPTIONS: PropertyOption[] = [
  {
    type: 'move',
    label: 'Move',
    properties: [
      { key: 'translateX', label: 'X', unit: 'px' },
      { key: 'translateY', label: 'Y', unit: 'px' },
    ],
  },
  {
    type: 'scale',
    label: 'Scale',
    properties: [
      { key: 'scaleX', label: 'X', unit: '' },
      { key: 'scaleY', label: 'Y', unit: '' },
    ],
  },
  {
    type: 'rotate',
    label: 'Rotate',
    properties: [{ key: 'rotate', label: 'Angle', unit: 'deg' }],
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
  const [expandedTransitions, setExpandedTransitions] = useState<Set<string>>(new Set());
  const [isSelectingTarget, setIsSelectingTarget] = useState(false);

  // Reset selections when trigger layer changes or reset is triggered
  useEffect(() => {
    setSelectedInteractionId(null);
    setExpandedTransitions(new Set());
    setIsSelectingTarget(false);
  }, [triggerLayer.id, resetKey]);

  // Memoize interactions to prevent unnecessary re-renders
  const interactions = useMemo(() => triggerLayer.interactions || [], [triggerLayer.interactions]);
  const selectedInteraction = interactions.find((i) => i.id === selectedInteractionId);
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

  // Auto-select first target when a trigger event is selected
  useEffect(() => {
    if (selectedInteractionId && selectedInteraction) {
      const firstTarget = selectedInteraction.targets[0];
      if (firstTarget && onSelectLayer) {
        // Select the corresponding layer in the editor
        const targetLayer = flatLayers.find((fl) => fl.layer.id === firstTarget.layer_id)?.layer;
        if (targetLayer) {
          onSelectLayer(targetLayer.id);
        }
      }
    }
  }, [selectedInteractionId, selectedInteraction, onSelectLayer, flatLayers]);

  // Generate unique ID
  const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Notify parent about state changes
  useEffect(() => {
    onStateChange?.({
      isSelectingTarget,
      selectedTriggerId: selectedInteractionId,
    });
  }, [isSelectingTarget, selectedInteractionId, onStateChange]);

  // Handle layer selection when in target selection mode
  useEffect(() => {
    // Only capture target if a trigger is selected and we're in selection mode
    if (isSelectingTarget && selectedLayerId && selectedInteraction && selectedInteractionId) {
      // Check if layer is already a target
      const isAlreadyTarget = selectedInteraction.targets.some(
        (t) => t.layer_id === selectedLayerId
      );

      if (!isAlreadyTarget) {
        // Add target directly without using handleAddTarget to avoid circular dependency
        const newTarget: InteractionTarget = {
          layer_id: selectedLayerId,
          transitions: [],
        };

        const updatedInteractions = interactions.map((interaction) => {
          if (interaction.id !== selectedInteractionId) return interaction;
          return {
            ...interaction,
            targets: [...interaction.targets, newTarget],
          };
        });

        onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
      }

      // Exit selection mode
      setIsSelectingTarget(false);
    }
  }, [isSelectingTarget, selectedLayerId, selectedInteraction, selectedInteractionId, interactions, triggerLayer.id, onLayerUpdate]);

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
    },
    [interactions, triggerLayer.id, onLayerUpdate, selectedInteractionId]
  );

  // Add target layer
  const handleAddTarget = useCallback(
    (layerId: string) => {
      if (!selectedInteraction) return;

      const newTarget: InteractionTarget = {
        layer_id: layerId,
        transitions: [],
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

  // Add transition property
  const handleAddProperty = useCallback(
    (propertyType: PropertyType) => {
      if (!selectedInteraction || !selectedLayerId) return;

      const propertyOption = PROPERTY_OPTIONS.find((p) => p.type === propertyType);
      if (!propertyOption) return;

      const newTransition: InteractionTransition = {
        id: generateId(),
        delay: 0,
        duration: 300,
        from: {
          property: propertyOption.properties[0].key,
          value: '0',
          unit: propertyOption.properties[0].unit,
        },
        to: {
          property: propertyOption.properties[0].key,
          value: '100',
          unit: propertyOption.properties[0].unit,
        },
      };

      const updatedInteractions = interactions.map((interaction) => {
        if (interaction.id !== selectedInteractionId) return interaction;

        const updatedTargets = interaction.targets.map((target) => {
          if (target.layer_id !== selectedLayerId) return target;
          return {
            ...target,
            transitions: [...target.transitions, newTransition],
          };
        });

        return { ...interaction, targets: updatedTargets };
      });

      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
      setExpandedTransitions(new Set([...expandedTransitions, newTransition.id]));
    },
    [
      selectedInteraction,
      selectedLayerId,
      interactions,
      selectedInteractionId,
      triggerLayer.id,
      onLayerUpdate,
      expandedTransitions,
    ]
  );

  // Remove transition
  const handleRemoveTransition = useCallback(
    (transitionId: string) => {
      if (!selectedInteraction || !selectedLayerId) return;

      const updatedInteractions = interactions.map((interaction) => {
        if (interaction.id !== selectedInteractionId) return interaction;

        const updatedTargets = interaction.targets.map((target) => {
          if (target.layer_id !== selectedLayerId) return target;
          return {
            ...target,
            transitions: target.transitions.filter((t) => t.id !== transitionId),
          };
        });

        return { ...interaction, targets: updatedTargets };
      });

      onLayerUpdate(triggerLayer.id, { interactions: updatedInteractions });
      setExpandedTransitions((prev) => {
        const next = new Set(prev);
        next.delete(transitionId);
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

  // Update transition property
  const handleUpdateTransition = useCallback(
    (transitionId: string, updates: Partial<InteractionTransition>) => {
      if (!selectedInteraction || !selectedLayerId) return;

      const updatedInteractions = interactions.map((interaction) => {
        if (interaction.id !== selectedInteractionId) return interaction;

        const updatedTargets = interaction.targets.map((target) => {
          if (target.layer_id !== selectedLayerId) return target;
          return {
            ...target,
            transitions: target.transitions.map((t) =>
              t.id === transitionId ? { ...t, ...updates } : t
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

  // Toggle transition expansion
  const toggleTransition = useCallback((transitionId: string) => {
    setExpandedTransitions((prev) => {
      const next = new Set(prev);
      if (next.has(transitionId)) {
        next.delete(transitionId);
      } else {
        next.add(transitionId);
      }
      return next;
    });
  }, []);

  // Get property option for transition
  const getPropertyOption = (transition: InteractionTransition): PropertyOption | null => {
    return PROPERTY_OPTIONS.find((opt) =>
      opt.properties.some((p) => p.key === transition.from.property)
    ) || null;
  };

  // Check if there's an active trigger (different layer selected or target selected)
  const hasActiveTrigger = selectedInteractionId !== null;

  return (
    <div className="flex flex-col h-full">
      {/* Trigger Layer */}
      <div className="pb-4 mb-4 border-b -mt-2">
        <header className="py-5 flex justify-between">
          <span className="font-medium">Trigger layer</span>
          {onStateChange && hasActiveTrigger && (
            <div className="-my-1">
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onStateChange({ shouldRefresh: true })}
                title="Update to current layer"
              >
                <Icon name="undo" />
              </Button>
            </div>
          )}
        </header>

        <div
          className={cn(
            'flex items-center gap-2 px-2 py-1.75 rounded-lg transition-colors',
            hasActiveTrigger
              ? 'bg-teal-500/50 text-primary-foreground'
              : 'bg-secondary/50'
          )}
        >
          <div
            className={cn(
              'size-5 flex items-center justify-center rounded-[6px]',
              hasActiveTrigger ? 'bg-primary-foreground/20' : 'bg-secondary'
            )}
          >
            <Icon name={getLayerIcon(triggerLayer)} className="size-2.5" />
          </div>
          <Label variant={hasActiveTrigger ? 'default' : 'muted'}>
            {getLayerName(triggerLayer)}
          </Label>
        </div>
      </div>

      {/* Triggers Header */}
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
              <DropdownMenuItem onClick={() => handleAddInteraction('click')}>
                Click
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddInteraction('hover')}>
                Hover
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddInteraction('scroll-into-view')}>
                Scroll into view
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAddInteraction('while-scrolling')}>
                While scrolling
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleAddInteraction('load')}>
                Page load
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Interaction List */}
      {interactions.length === 0 ? (
        <Empty>
          <EmptyDescription>
            No interactions yet. Add a trigger to animate this element.
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

      {/* Interaction Details - Targets Section */}
      {selectedInteraction && (
        <div className="mt-4 border-t">
          {/* Targets Header */}
          <header className="py-5 flex justify-between">
            <span className="font-medium">Target layers</span>
            <div className="-my-1">
              {isSelectingTarget ? (
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => setIsSelectingTarget(false)}
                >
                  Cancel
                </Button>
              ) : (
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => setIsSelectingTarget(true)}
                >
                  <Icon name="plus" />
                </Button>
              )}
            </div>
          </header>

          {/* Target Selection Mode Message */}
          {isSelectingTarget && (
            <div className="mb-4 p-3 bg-teal-500/20 border border-teal-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <Icon name="zap" className="size-4 text-teal-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-teal-100">
                    Select a layer
                  </p>
                  <p className="text-xs text-teal-200/70 mt-1">
                    Click on any layer in the tree or canvas to add it as a target
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Target List */}
          {selectedInteraction.targets.length === 0 && !isSelectingTarget ? (
            <Empty>
              <EmptyDescription>
                Select the layer you want to animate and click on [+] to add it as a target.
              </EmptyDescription>
            </Empty>
          ) : !isSelectingTarget ? (
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

                    <Label variant={isActive ? 'default' : 'muted'}>
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
          ) : null}
        </div>
      )}

      {/* Properties Section - Only show when target is selected */}
      {selectedInteraction && selectedTarget && (
        <div className="border-t">
          {/* Properties Header */}
          <header className="py-5 flex justify-between">
            <span className="font-medium">Properties</span>
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

          {/* Transitions List */}
          {selectedTarget.transitions.length === 0 ? (
            <Empty>
              <EmptyDescription>
                No properties animated yet. Add a property to get started.
              </EmptyDescription>
            </Empty>
          ) : (
            <div className="space-y-4">
              {selectedTarget.transitions.map((transition) => {
                const propertyOption = getPropertyOption(transition);
                const isExpanded = expandedTransitions.has(transition.id);

                return (
                  <div key={transition.id} className="px-4 bg-secondary/50 rounded-lg">
                    {/* Transition Header */}
                    <header
                      onClick={() => toggleTransition(transition.id)}
                      className="px-4 flex items-center gap-1.5 cursor-pointer hover:bg-secondary/25 rounded-lg -mx-4 py-3 transition-colors"
                    >
                      <Icon
                        name="chevronRight"
                        className={cn(
                          'size-3 opacity-50 transition-transform',
                          isExpanded && 'rotate-90'
                        )}
                      />
                      <Label>{propertyOption?.label || 'Property'}</Label>
                      <div className="ml-auto">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveTransition(transition.id);
                          }}
                        >
                          <Icon name="x" />
                        </Button>
                      </div>
                    </header>

                    {/* Transition Details */}
                    {isExpanded && (
                      <div className="-mt-4">
                        {/* Property Values */}
                        <div className="py-4 flex flex-col gap-4">
                          {propertyOption?.properties.map((prop) => (
                            <div key={prop.key} className="flex flex-col gap-2">
                              <Label variant="muted">{prop.label}</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  value={transition.from.value}
                                  onChange={(e) =>
                                    handleUpdateTransition(transition.id, {
                                      from: {
                                        ...transition.from,
                                        value: e.target.value,
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
                                  value={transition.to.value}
                                  onChange={(e) =>
                                    handleUpdateTransition(transition.id, {
                                      to: {
                                        ...transition.to,
                                        value: e.target.value,
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
                                value={transition.delay}
                                onChange={(e) =>
                                  handleUpdateTransition(transition.id, {
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
                                value={transition.duration}
                                onChange={(e) =>
                                  handleUpdateTransition(transition.id, {
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
