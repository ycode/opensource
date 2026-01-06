'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import SettingsPanel from '@/app/ycode/components/SettingsPanel';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useControlledInputs } from '@/hooks/use-controlled-input';
import { useEditorStore } from '@/stores/useEditorStore';
import { extractMeasurementValue, formatMeasurementValue } from '@/lib/measurement-utils';
import type { Layer } from '@/types';

interface SizingControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function SizingControls({ layer, onLayerUpdate }: SizingControlsProps) {
  const { activeBreakpoint, activeUIState } = useEditorStore();
  const { updateDesignProperty, debouncedUpdateDesignProperty, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
  });

  const [isOpen, setIsOpen] = useState(true);

  // Get current values from layer (with inheritance)
  const width = getDesignProperty('sizing', 'width') || '';
  const height = getDesignProperty('sizing', 'height') || '';
  const minWidth = getDesignProperty('sizing', 'minWidth') || '';
  const minHeight = getDesignProperty('sizing', 'minHeight') || '';
  const maxWidth = getDesignProperty('sizing', 'maxWidth') || '';
  const maxHeight = getDesignProperty('sizing', 'maxHeight') || '';
  const overflow = getDesignProperty('sizing', 'overflow') || 'visible';
  const aspectRatio = getDesignProperty('sizing', 'aspectRatio') || '';

  // Extract aspect ratio value for display (remove brackets)
  const extractAspectRatioValue = (value: string): string => {
    if (!value) return '';
    // Remove brackets: [16/9] → 16/9
    if (value.startsWith('[') && value.endsWith(']')) {
      return value.slice(1, -1);
    }
    return value;
  };

  // Local controlled inputs (prevents repopulation bug)
  const inputs = useControlledInputs({
    width,
    height,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
  }, extractMeasurementValue);

  const [widthInput, setWidthInput] = inputs.width;
  const [heightInput, setHeightInput] = inputs.height;
  const [minWidthInput, setMinWidthInput] = inputs.minWidth;
  const [minHeightInput, setMinHeightInput] = inputs.minHeight;
  const [maxWidthInput, setMaxWidthInput] = inputs.maxWidth;
  const [maxHeightInput, setMaxHeightInput] = inputs.maxHeight;

  // Aspect ratio uses custom extraction to remove brackets
  const [aspectRatioInput, setAspectRatioInput] = useState(extractAspectRatioValue(aspectRatio));

  // Sync aspect ratio input when prop changes
  useEffect(() => {
    setAspectRatioInput(extractAspectRatioValue(aspectRatio));
  }, [aspectRatio]);

  // Handle width changes (debounced for text input)
  const handleWidthChange = (value: string) => {
    setWidthInput(value);
    debouncedUpdateDesignProperty('sizing', 'width', formatMeasurementValue(value));
  };

  // Get current width preset value (for Select display)
  const getWidthPresetValue = () => {
    if (widthInput === '100%') return 'w-[100%]';
    if (widthInput === 'fit') return 'w-fit-content';
    if (widthInput === '100vw') return 'w-[100vw]';
    return '';
  };

  // Preset changes are immediate (button clicks)
  const handleWidthPresetChange = (value: string) => {
    if (value === 'w-[100%]') {
      setWidthInput('100%');
      updateDesignProperty('sizing', 'width', '[100%]');
    } else if (value === 'w-fit-content') {
      setWidthInput('fit');
      updateDesignProperty('sizing', 'width', 'fit');
    } else if (value === 'w-[100vw]') {
      setWidthInput('100vw');
      updateDesignProperty('sizing', 'width', '[100vw]');
    }
  };

  // Handle height changes (debounced for text input)
  const handleHeightChange = (value: string) => {
    setHeightInput(value);
    debouncedUpdateDesignProperty('sizing', 'height', formatMeasurementValue(value));
  };

  // Get current height preset value (for Select display)
  const getHeightPresetValue = () => {
    if (heightInput === '100%') return 'h-[100%]';
    if (heightInput === '100svh') return 'h-[100svh]';
    return '';
  };

  // Preset changes are immediate (button clicks)
  const handleHeightPresetChange = (value: string) => {
    if (value === 'h-[100%]') {
      setHeightInput('100%');
      updateDesignProperty('sizing', 'height', '[100%]');
    } else if (value === 'h-[100svh]') {
      setHeightInput('100svh');
      updateDesignProperty('sizing', 'height', '[100svh]');
    }
  };

  // Get current min/max width preset values
  const getMinWidthPresetValue = () => {
    if (minWidthInput === '100%') return 'w-[100%]';
    if (minWidthInput === 'fit') return 'w-fit-content';
    if (minWidthInput === '100vw') return 'w-[100vw]';
    return '';
  };

  const getMaxWidthPresetValue = () => {
    if (maxWidthInput === '100%') return 'w-[100%]';
    if (maxWidthInput === 'fit') return 'w-fit-content';
    if (maxWidthInput === '100vw') return 'w-[100vw]';
    return '';
  };

  // Handle min/max width changes (debounced for text input)
  const handleMinWidthChange = (value: string) => {
    setMinWidthInput(value);
    debouncedUpdateDesignProperty('sizing', 'minWidth', formatMeasurementValue(value));
  };

  const handleMinWidthPresetChange = (value: string) => {
    if (value === 'w-[100%]') {
      setMinWidthInput('100%');
      updateDesignProperty('sizing', 'minWidth', '[100%]');
    } else if (value === 'w-fit-content') {
      setMinWidthInput('fit');
      updateDesignProperty('sizing', 'minWidth', 'fit');
    } else if (value === 'w-[100vw]') {
      setMinWidthInput('100vw');
      updateDesignProperty('sizing', 'minWidth', '[100vw]');
    }
  };

  const handleMaxWidthChange = (value: string) => {
    setMaxWidthInput(value);
    debouncedUpdateDesignProperty('sizing', 'maxWidth', formatMeasurementValue(value));
  };

  const handleMaxWidthPresetChange = (value: string) => {
    if (value === 'w-[100%]') {
      setMaxWidthInput('100%');
      updateDesignProperty('sizing', 'maxWidth', '[100%]');
    } else if (value === 'w-fit-content') {
      setMaxWidthInput('fit');
      updateDesignProperty('sizing', 'maxWidth', 'fit');
    } else if (value === 'w-[100vw]') {
      setMaxWidthInput('100vw');
      updateDesignProperty('sizing', 'maxWidth', '[100vw]');
    }
  };

  // Get current min/max height preset values
  const getMinHeightPresetValue = () => {
    if (minHeightInput === '100%') return 'h-[100%]';
    if (minHeightInput === '100svh') return 'h-[100svh]';
    return '';
  };

  const getMaxHeightPresetValue = () => {
    if (maxHeightInput === '100%') return 'h-[100%]';
    if (maxHeightInput === '100svh') return 'h-[100svh]';
    return '';
  };

  // Handle min/max height changes (debounced for text input)
  const handleMinHeightChange = (value: string) => {
    setMinHeightInput(value);
    debouncedUpdateDesignProperty('sizing', 'minHeight', formatMeasurementValue(value));
  };

  const handleMinHeightPresetChange = (value: string) => {
    if (value === 'h-[100%]') {
      setMinHeightInput('100%');
      updateDesignProperty('sizing', 'minHeight', '[100%]');
    } else if (value === 'h-[100svh]') {
      setMinHeightInput('100svh');
      updateDesignProperty('sizing', 'minHeight', '[100svh]');
    }
  };

  const handleMaxHeightChange = (value: string) => {
    setMaxHeightInput(value);
    debouncedUpdateDesignProperty('sizing', 'maxHeight', formatMeasurementValue(value));
  };

  const handleMaxHeightPresetChange = (value: string) => {
    if (value === 'h-[100%]') {
      setMaxHeightInput('100%');
      updateDesignProperty('sizing', 'maxHeight', '[100%]');
    } else if (value === 'h-[100svh]') {
      setMaxHeightInput('100svh');
      updateDesignProperty('sizing', 'maxHeight', '[100svh]');
    }
  };

  // Handle overflow change
  const handleOverflowChange = (value: string) => {
    updateDesignProperty('sizing', 'overflow', value);
  };

  // Handle aspect ratio changes (debounced for text input)
  const handleAspectRatioChange = (value: string) => {
    setAspectRatioInput(value);
    // Format as [16/9] for arbitrary values
    const formattedValue = value ? `[${value}]` : null;
    debouncedUpdateDesignProperty('sizing', 'aspectRatio', formattedValue);
  };

  // Get current aspect ratio preset value (for Select display)
  const getAspectRatioPresetValue = () => {
    if (aspectRatioInput === '16/9') return 'aspect-video';
    if (aspectRatioInput === '1/1') return 'aspect-square';
    if (aspectRatioInput === '4/3') return 'aspect-4/3';
    if (aspectRatioInput === '3/4') return 'aspect-3/4';
    return '';
  };

  // Preset changes are immediate (dropdown selection)
  const handleAspectRatioPresetChange = (value: string) => {
    if (value === 'aspect-video') {
      setAspectRatioInput('16/9');
      updateDesignProperty('sizing', 'aspectRatio', '[16/9]');
    } else if (value === 'aspect-square') {
      setAspectRatioInput('1/1');
      updateDesignProperty('sizing', 'aspectRatio', '[1/1]');
    } else if (value === 'aspect-4/3') {
      setAspectRatioInput('4/3');
      updateDesignProperty('sizing', 'aspectRatio', '[4/3]');
    } else if (value === 'aspect-3/4') {
      setAspectRatioInput('3/4');
      updateDesignProperty('sizing', 'aspectRatio', '[3/4]');
    } else if (value === 'aspect-auto') {
      setAspectRatioInput('');
      updateDesignProperty('sizing', 'aspectRatio', null);
    }
  };

  return (
    <SettingsPanel
      title="Sizing" isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="grid grid-cols-3 items-start">
        <Label variant="muted" className="h-8">Width</Label>
        <div className="col-span-2 flex flex-col gap-2">
          <ButtonGroup>
            <Input
              value={widthInput} onChange={(e) => handleWidthChange(e.target.value)}
              placeholder="0"
            />
            <ButtonGroupSeparator />
            <Select value={getWidthPresetValue()} onValueChange={handleWidthPresetChange}>
              <SelectTrigger />
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="w-[100%]">Fill</SelectItem>
                  <SelectItem value="w-fit-content">Fit</SelectItem>
                  <SelectItem value="w-[100vw]">Screen</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </ButtonGroup>
          <div className="grid grid-cols-2 gap-2">
            <div className="w-full group relative">
              <ButtonGroup className="w-full">
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger>
                          <Icon name="minSize" className="size-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Min width</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    placeholder="Min" value={minWidthInput}
                    onChange={(e) => handleMinWidthChange(e.target.value)}
                  />
                </InputGroup>
              </ButtonGroup>
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                <Select value={getMinWidthPresetValue()} onValueChange={handleMinWidthPresetChange}>
                  <SelectTrigger size="xs" variant="ghost" />
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="w-[100%]">Fill</SelectItem>
                      <SelectItem value="w-fit-content">Fit</SelectItem>
                      <SelectItem value="w-[100vw]">Screen</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="w-full group relative">
              <ButtonGroup className="w-full">
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger>
                          <Icon name="maxSize" className="size-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Max width</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    placeholder="Max" value={maxWidthInput}
                    onChange={(e) => handleMaxWidthChange(e.target.value)}
                  />
                </InputGroup>
              </ButtonGroup>
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                <Select value={getMaxWidthPresetValue()} onValueChange={handleMaxWidthPresetChange}>
                  <SelectTrigger size="xs" variant="ghost" />
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="w-[100%]">Fill</SelectItem>
                      <SelectItem value="w-fit-content">Fit</SelectItem>
                      <SelectItem value="w-[100vw]">Screen</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 items-start">
        <Label variant="muted" className="h-8">Height</Label>
        <div className="col-span-2 flex flex-col gap-2">
          <ButtonGroup>
            <Input
              value={heightInput} onChange={(e) => handleHeightChange(e.target.value)}
              placeholder="0"
            />
            <ButtonGroupSeparator />
            <Select value={getHeightPresetValue()} onValueChange={handleHeightPresetChange}>
              <SelectTrigger />
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="h-[100%]">Fill</SelectItem>
                  <SelectItem value="h-[100svh]">Screen</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </ButtonGroup>
          <div className="grid grid-cols-2 gap-2">
            <div className="w-full group relative">
              <ButtonGroup className="w-full">
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger>
                          <Icon name="minSize" className="size-3 rotate-90" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Min height</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    placeholder="Min" value={minHeightInput}
                    onChange={(e) => handleMinHeightChange(e.target.value)}
                  />
                </InputGroup>
              </ButtonGroup>
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                <Select value={getMinHeightPresetValue()} onValueChange={handleMinHeightPresetChange}>
                  <SelectTrigger size="xs" variant="ghost" />
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="h-[100%]">Fill</SelectItem>
                      <SelectItem value="h-[100svh]">Screen</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="w-full group relative">
              <ButtonGroup className="w-full">
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger>
                          <Icon name="maxSize" className="size-3 rotate-90" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Max height</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    placeholder="Max" value={maxHeightInput}
                    onChange={(e) => handleMaxHeightChange(e.target.value)}
                  />
                </InputGroup>
              </ButtonGroup>
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                <Select value={getMaxHeightPresetValue()} onValueChange={handleMaxHeightPresetChange}>
                  <SelectTrigger size="xs" variant="ghost" />
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="h-[100%]">Fill</SelectItem>
                      <SelectItem value="h-[100svh]">Screen</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3">
        <Label variant="muted">Overflow</Label>
        <div className="col-span-2 *:w-full">
          <Select value={overflow} onValueChange={handleOverflowChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="visible">Visible</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
                <SelectItem value="scroll">Scroll</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 items-start">
        <Label variant="muted" className="h-8">Aspect ratio</Label>
        <div className="col-span-2 flex flex-col gap-2">
          <ButtonGroup>
            <Input
              value={aspectRatioInput}
              onChange={(e) => handleAspectRatioChange(e.target.value)}
            />
            <ButtonGroupSeparator />
            <Select value={getAspectRatioPresetValue()} onValueChange={handleAspectRatioPresetChange}>
              <SelectTrigger />
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="aspect-square">Square</SelectItem>
                  <SelectItem value="aspect-video">Video</SelectItem>
                  <SelectItem value="aspect-4/3">4:3</SelectItem>
                  <SelectItem value="aspect-3/4">3:4</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </ButtonGroup>
        </div>
      </div>
    </SettingsPanel>
  );
}
