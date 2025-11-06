'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Slider } from '@/components/ui/slider';
import Icon from '@/components/ui/icon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useControlledInputs } from '@/hooks/use-controlled-input';
import { useEditorStore } from '@/stores/useEditorStore';
import { extractMeasurementValue } from '@/lib/measurement-utils';
import { removeSpaces } from '@/lib/utils';
import type { Layer } from '@/types';

interface PositionControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function PositionControls({ layer, onLayerUpdate }: PositionControlsProps) {
  const { activeBreakpoint, activeUIState } = useEditorStore();
  const { updateDesignProperty, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
  });

  // Get current values from layer (with inheritance)
  const position = getDesignProperty('positioning', 'position') || 'static';
  const top = getDesignProperty('positioning', 'top') || '';
  const right = getDesignProperty('positioning', 'right') || '';
  const bottom = getDesignProperty('positioning', 'bottom') || '';
  const left = getDesignProperty('positioning', 'left') || '';
  const zIndex = getDesignProperty('positioning', 'zIndex') || '';

  // Only show position inputs for fixed, absolute, or sticky
  const showPositionInputs = position === 'fixed' || position === 'absolute' || position === 'sticky';

  // Local controlled inputs (prevents repopulation bug)
  const inputs = useControlledInputs({
    top,
    right,
    bottom,
    left,
    zIndex,
  }, extractMeasurementValue);

  const [topInput, setTopInput] = inputs.top;
  const [rightInput, setRightInput] = inputs.right;
  const [bottomInput, setBottomInput] = inputs.bottom;
  const [leftInput, setLeftInput] = inputs.left;
  const [zIndexInput, setZIndexInput] = inputs.zIndex;

  // Handle position change
  const handlePositionChange = (value: string) => {
    updateDesignProperty('positioning', 'position', value);
  };

  // Handle top change
  const handleTopChange = (value: string) => {
    setTopInput(value);
    if (value === 'auto') {
      updateDesignProperty('positioning', 'top', 'auto');
    } else {
      const sanitized = removeSpaces(value);
      updateDesignProperty('positioning', 'top', sanitized || null);
    }
  };

  // Handle right change
  const handleRightChange = (value: string) => {
    setRightInput(value);
    if (value === 'auto') {
      updateDesignProperty('positioning', 'right', 'auto');
    } else {
      const sanitized = removeSpaces(value);
      updateDesignProperty('positioning', 'right', sanitized || null);
    }
  };

  // Handle bottom change
  const handleBottomChange = (value: string) => {
    setBottomInput(value);
    if (value === 'auto') {
      updateDesignProperty('positioning', 'bottom', 'auto');
    } else {
      const sanitized = removeSpaces(value);
      updateDesignProperty('positioning', 'bottom', sanitized || null);
    }
  };

  // Handle left change
  const handleLeftChange = (value: string) => {
    setLeftInput(value);
    if (value === 'auto') {
      updateDesignProperty('positioning', 'left', 'auto');
    } else {
      const sanitized = removeSpaces(value);
      updateDesignProperty('positioning', 'left', sanitized || null);
    }
  };

  // Handle z-index change
  const handleZIndexChange = (value: string) => {
    setZIndexInput(value);
    if (value === 'auto') {
      updateDesignProperty('positioning', 'zIndex', 'auto');
    } else {
      const sanitized = removeSpaces(value);
      updateDesignProperty('positioning', 'zIndex', sanitized || null);
    }
  };

  // Handle z-index slider change
  const handleZIndexSliderChange = (values: number[]) => {
    const value = values[0].toString();
    setZIndexInput(value);
    updateDesignProperty('positioning', 'zIndex', value);
  };

  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Position</Label>
      </header>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3">
          <Label variant="muted">Type</Label>
          <div className="col-span-2 *:w-full">
            <Select value={position} onValueChange={handlePositionChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="static">Static</SelectItem>
                  <SelectItem value="relative">Relative</SelectItem>
                  <SelectItem value="absolute">Absolute</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="sticky">Sticky</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {showPositionInputs && (
          <>
            <div className="grid grid-cols-3 items-start">
              <Label variant="muted" className="h-8">Offset</Label>
              <div className="col-span-2 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <InputGroup>
                    <InputGroupAddon>
                      <div className="flex">
                        <Tooltip>
                          <TooltipTrigger>
                            <Icon name="paddingSide" className="size-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Left</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </InputGroupAddon>
                    <InputGroupInput
                      className="!pr-0"
                      value={leftInput}
                      onChange={(e) => handleLeftChange(e.target.value)}
                      placeholder="0"
                    />
                  </InputGroup>
                  <InputGroup>
                    <InputGroupAddon>
                      <div className="flex">
                        <Tooltip>
                          <TooltipTrigger>
                            <Icon name="paddingSide" className="size-3 rotate-90" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Top</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </InputGroupAddon>
                    <InputGroupInput
                      className="!pr-0"
                      value={topInput}
                      onChange={(e) => handleTopChange(e.target.value)}
                      placeholder="0"
                    />
                  </InputGroup>
                  <InputGroup>
                    <InputGroupAddon>
                      <div className="flex">
                        <Tooltip>
                          <TooltipTrigger>
                            <Icon name="paddingSide" className="size-3 rotate-180" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Right</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </InputGroupAddon>
                    <InputGroupInput
                      className="!pr-0"
                      value={rightInput}
                      onChange={(e) => handleRightChange(e.target.value)}
                      placeholder="0"
                    />
                  </InputGroup>
                  <InputGroup>
                    <InputGroupAddon>
                      <div className="flex">
                        <Tooltip>
                          <TooltipTrigger>
                            <Icon name="paddingSide" className="size-3 -rotate-90" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Bottom</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </InputGroupAddon>
                    <InputGroupInput
                      className="!pr-0"
                      value={bottomInput}
                      onChange={(e) => handleBottomChange(e.target.value)}
                      placeholder="0"
                    />
                  </InputGroup>
                </div>
              </div>
            </div>
          </>
        )}

        {position !== 'static' && (
          <div className="grid grid-cols-3">
            <Label variant="muted">Z Index</Label>
            <div className="col-span-2 grid grid-cols-2 items-center gap-2">
              <Input
                type="text"
                value={zIndexInput}
                onChange={(e) => handleZIndexChange(e.target.value)}
                placeholder="auto"
              />
              <Slider
                value={[parseInt(zIndexInput) || 0]}
                onValueChange={handleZIndexSliderChange}
                min={0}
                max={100}
                step={1}
                className="flex-1"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

