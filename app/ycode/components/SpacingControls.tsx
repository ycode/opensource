'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useControlledInputs } from '@/hooks/use-controlled-input';
import { useModeToggle } from '@/hooks/use-mode-toggle';
import { useEditorStore } from '@/stores/useEditorStore';
import { extractMeasurementValue } from '@/lib/measurement-utils';
import { removeSpaces } from '@/lib/utils';
import type { Layer } from '@/types';

interface SpacingControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function SpacingControls({ layer, onLayerUpdate }: SpacingControlsProps) {
  const { activeBreakpoint, activeUIState } = useEditorStore();
  const { updateDesignProperty, updateDesignProperties, debouncedUpdateDesignProperty, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
  });

  // Get current values from layer (with inheritance)
  const margin = getDesignProperty('spacing', 'margin') || '';
  const marginTop = getDesignProperty('spacing', 'marginTop') || '';
  const marginRight = getDesignProperty('spacing', 'marginRight') || '';
  const marginBottom = getDesignProperty('spacing', 'marginBottom') || '';
  const marginLeft = getDesignProperty('spacing', 'marginLeft') || '';
  const padding = getDesignProperty('spacing', 'padding') || '';
  const paddingTop = getDesignProperty('spacing', 'paddingTop') || '';
  const paddingRight = getDesignProperty('spacing', 'paddingRight') || '';
  const paddingBottom = getDesignProperty('spacing', 'paddingBottom') || '';
  const paddingLeft = getDesignProperty('spacing', 'paddingLeft') || '';

  // Local controlled inputs (prevents repopulation bug)
  const inputs = useControlledInputs({
    margin,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    padding,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
  }, extractMeasurementValue);

  const [marginInput, setMarginInput] = inputs.margin;
  const [marginTopInput, setMarginTopInput] = inputs.marginTop;
  const [marginRightInput, setMarginRightInput] = inputs.marginRight;
  const [marginBottomInput, setMarginBottomInput] = inputs.marginBottom;
  const [marginLeftInput, setMarginLeftInput] = inputs.marginLeft;
  const [paddingInput, setPaddingInput] = inputs.padding;
  const [paddingTopInput, setPaddingTopInput] = inputs.paddingTop;
  const [paddingRightInput, setPaddingRightInput] = inputs.paddingRight;
  const [paddingBottomInput, setPaddingBottomInput] = inputs.paddingBottom;
  const [paddingLeftInput, setPaddingLeftInput] = inputs.paddingLeft;

  // Use mode toggle hook for margin
  const marginModeToggle = useModeToggle({
    category: 'spacing',
    unifiedProperty: 'margin',
    individualProperties: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
    updateDesignProperty,
    updateDesignProperties,
    // Don't wrap in useCallback - let it recreate on every render to avoid stale closures
    getCurrentValue: (prop: string) => getDesignProperty('spacing', prop) || '',
  });

  // Use mode toggle hook for padding
  const paddingModeToggle = useModeToggle({
    category: 'spacing',
    unifiedProperty: 'padding',
    individualProperties: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
    updateDesignProperty,
    updateDesignProperties,
    // Don't wrap in useCallback - let it recreate on every render to avoid stale closures
    getCurrentValue: (prop: string) => getDesignProperty('spacing', prop) || '',
  });

  // Handle margin changes (debounced for smooth typing experience)
  const handleMarginChange = (value: string) => {
    setMarginInput(value);
    if (marginModeToggle.mode === 'all-borders') {
      if (value === 'auto') {
        debouncedUpdateDesignProperty('spacing', 'margin', 'auto');
      } else {
        const sanitized = removeSpaces(value);
        debouncedUpdateDesignProperty('spacing', 'margin', sanitized || null);
      }
    }
  };

  const handleMarginTopChange = (value: string) => {
    setMarginTopInput(value);
    if (value === 'auto') {
      debouncedUpdateDesignProperty('spacing', 'marginTop', 'auto');
    } else {
      const sanitized = removeSpaces(value);
      debouncedUpdateDesignProperty('spacing', 'marginTop', sanitized || null);
    }
  };

  const handleMarginRightChange = (value: string) => {
    setMarginRightInput(value);
    if (value === 'auto') {
      debouncedUpdateDesignProperty('spacing', 'marginRight', 'auto');
    } else {
      const sanitized = removeSpaces(value);
      debouncedUpdateDesignProperty('spacing', 'marginRight', sanitized || null);
    }
  };

  const handleMarginBottomChange = (value: string) => {
    setMarginBottomInput(value);
    if (value === 'auto') {
      debouncedUpdateDesignProperty('spacing', 'marginBottom', 'auto');
    } else {
      const sanitized = removeSpaces(value);
      debouncedUpdateDesignProperty('spacing', 'marginBottom', sanitized || null);
    }
  };

  const handleMarginLeftChange = (value: string) => {
    setMarginLeftInput(value);
    if (value === 'auto') {
      debouncedUpdateDesignProperty('spacing', 'marginLeft', 'auto');
    } else {
      const sanitized = removeSpaces(value);
      debouncedUpdateDesignProperty('spacing', 'marginLeft', sanitized || null);
    }
  };

  // Handle padding changes (debounced for text input)
  const handlePaddingChange = (value: string) => {
    setPaddingInput(value);
    if (paddingModeToggle.mode === 'all-borders') {
      const sanitized = removeSpaces(value);
      debouncedUpdateDesignProperty('spacing', 'padding', sanitized || null);
    }
  };

  const handlePaddingTopChange = (value: string) => {
    setPaddingTopInput(value);
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('spacing', 'paddingTop', sanitized || null);
  };

  const handlePaddingRightChange = (value: string) => {
    setPaddingRightInput(value);
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('spacing', 'paddingRight', sanitized || null);
  };

  const handlePaddingBottomChange = (value: string) => {
    setPaddingBottomInput(value);
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('spacing', 'paddingBottom', sanitized || null);
  };

  const handlePaddingLeftChange = (value: string) => {
    setPaddingLeftInput(value);
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('spacing', 'paddingLeft', sanitized || null);
  };

  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Spacing</Label>
      </header>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="h-8">Margin</Label>
          <div className="col-span-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <InputGroup className="flex-1">
                <InputGroupInput
                  stepper
                  disabled={marginModeToggle.mode === 'individual-borders'}
                  value={marginInput}
                  onChange={(e) => handleMarginChange(e.target.value)}
                />
              </InputGroup>
              <Button
                variant={marginModeToggle.mode === 'individual-borders' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={marginModeToggle.handleToggle}
              >
                <Icon name="individualBorders" />
              </Button>
            </div>
            {marginModeToggle.mode === 'individual-borders' && (
              <div className="grid grid-cols-2 gap-2">
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger tabIndex={-1}>
                          <Icon name="paddingSide" className="size-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Left margin</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    stepper
                    value={marginLeftInput}
                    onChange={(e) => handleMarginLeftChange(e.target.value)}
                  />
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger tabIndex={-1}>
                          <Icon name="paddingSide" className="size-3 rotate-90" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Top margin</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    stepper
                    value={marginTopInput}
                    onChange={(e) => handleMarginTopChange(e.target.value)}
                  />
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger tabIndex={-1}>
                          <Icon name="paddingSide" className="size-3 rotate-180" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Right margin</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    stepper
                    value={marginRightInput}
                    onChange={(e) => handleMarginRightChange(e.target.value)}
                  />
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger tabIndex={-1}>
                          <Icon name="paddingSide" className="size-3 rotate-270" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Bottom margin</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    stepper
                    value={marginBottomInput}
                    onChange={(e) => handleMarginBottomChange(e.target.value)}
                  />
                </InputGroup>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="h-8">Padding</Label>
          <div className="col-span-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <InputGroup className="flex-1">
                <InputGroupInput
                  stepper
                  min="0"
                  step="1"
                  disabled={paddingModeToggle.mode === 'individual-borders'}
                  value={paddingInput}
                  onChange={(e) => handlePaddingChange(e.target.value)}
                />
              </InputGroup>
              <Button
                variant={paddingModeToggle.mode === 'individual-borders' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={paddingModeToggle.handleToggle}
              >
                <Icon name="individualBorders" />
              </Button>
            </div>
            {paddingModeToggle.mode === 'individual-borders' && (
              <div className="grid grid-cols-2 gap-2">
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger tabIndex={-1}>
                          <Icon name="paddingSide" className="size-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Left padding</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    stepper
                    min="0"
                    step="1"
                    value={paddingLeftInput}
                    onChange={(e) => handlePaddingLeftChange(e.target.value)}
                  />
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger tabIndex={-1}>
                          <Icon name="paddingSide" className="size-3 rotate-90" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Top padding</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    stepper
                    min="0"
                    step="1"
                    value={paddingTopInput}
                    onChange={(e) => handlePaddingTopChange(e.target.value)}
                  />
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger tabIndex={-1}>
                          <Icon name="paddingSide" className="size-3 rotate-180" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Right padding</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    stepper
                    min="0"
                    step="1"
                    value={paddingRightInput}
                    onChange={(e) => handlePaddingRightChange(e.target.value)}
                  />
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger tabIndex={-1}>
                          <Icon name="paddingSide" className="size-3 rotate-270" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Bottom padding</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    stepper
                    min="0"
                    step="1"
                    value={paddingBottomInput}
                    onChange={(e) => handlePaddingBottomChange(e.target.value)}
                  />
                </InputGroup>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
