'use client';

import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import Icon from '@/components/ui/icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useControlledInputs } from '@/hooks/use-controlled-input';
import { useModeToggle } from '@/hooks/use-mode-toggle';
import { useEditorStore } from '@/stores/useEditorStore';
import { extractMeasurementValue } from '@/lib/measurement-utils';
import { removeSpaces } from '@/lib/utils';
import type { Layer } from '@/types';

interface BorderControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function BorderControls({ layer, onLayerUpdate }: BorderControlsProps) {
  const { activeBreakpoint, activeUIState } = useEditorStore();
  const { updateDesignProperty, updateDesignProperties, debouncedUpdateDesignProperty, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
  });
  
  // Get current values from layer (with inheritance)
  const borderRadius = getDesignProperty('borders', 'borderRadius') || '';
  const borderTopLeftRadius = getDesignProperty('borders', 'borderTopLeftRadius') || '';
  const borderTopRightRadius = getDesignProperty('borders', 'borderTopRightRadius') || '';
  const borderBottomRightRadius = getDesignProperty('borders', 'borderBottomRightRadius') || '';
  const borderBottomLeftRadius = getDesignProperty('borders', 'borderBottomLeftRadius') || '';
  const borderWidth = getDesignProperty('borders', 'borderWidth') || '';
  const borderTopWidth = getDesignProperty('borders', 'borderTopWidth') || '';
  const borderRightWidth = getDesignProperty('borders', 'borderRightWidth') || '';
  const borderBottomWidth = getDesignProperty('borders', 'borderBottomWidth') || '';
  const borderLeftWidth = getDesignProperty('borders', 'borderLeftWidth') || '';
  const borderStyle = getDesignProperty('borders', 'borderStyle') || 'solid';
  const borderColor = getDesignProperty('borders', 'borderColor') || '';
  
  const hasBorder = !!(borderWidth || borderTopWidth || borderRightWidth || borderBottomWidth || borderLeftWidth);
  
  // Local controlled inputs (prevents repopulation bug)
  const inputs = useControlledInputs({
    borderRadius,
    borderTopLeftRadius,
    borderTopRightRadius,
    borderBottomRightRadius,
    borderBottomLeftRadius,
    borderWidth,
    borderTopWidth,
    borderRightWidth,
    borderBottomWidth,
    borderLeftWidth,
  }, extractMeasurementValue);

  const [borderRadiusInput, setBorderRadiusInput] = inputs.borderRadius;
  const [borderTopLeftRadiusInput, setBorderTopLeftRadiusInput] = inputs.borderTopLeftRadius;
  const [borderTopRightRadiusInput, setBorderTopRightRadiusInput] = inputs.borderTopRightRadius;
  const [borderBottomRightRadiusInput, setBorderBottomRightRadiusInput] = inputs.borderBottomRightRadius;
  const [borderBottomLeftRadiusInput, setBorderBottomLeftRadiusInput] = inputs.borderBottomLeftRadius;
  const [borderWidthInput, setBorderWidthInput] = inputs.borderWidth;
  const [borderTopWidthInput, setBorderTopWidthInput] = inputs.borderTopWidth;
  const [borderRightWidthInput, setBorderRightWidthInput] = inputs.borderRightWidth;
  const [borderBottomWidthInput, setBorderBottomWidthInput] = inputs.borderBottomWidth;
  const [borderLeftWidthInput, setBorderLeftWidthInput] = inputs.borderLeftWidth;
  
  // Use mode toggle hooks for radius and width
  const radiusModeToggle = useModeToggle({
    category: 'borders',
    unifiedProperty: 'borderRadius',
    individualProperties: ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'],
    updateDesignProperty,
    updateDesignProperties,
    // Don't wrap in useCallback - let it recreate on every render to avoid stale closures
    getCurrentValue: (prop: string) => getDesignProperty('borders', prop) || '',
  });
  
  const widthModeToggle = useModeToggle({
    category: 'borders',
    unifiedProperty: 'borderWidth',
    individualProperties: ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'],
    updateDesignProperty,
    updateDesignProperties,
    // Don't wrap in useCallback - let it recreate on every render to avoid stale closures
    getCurrentValue: (prop: string) => getDesignProperty('borders', prop) || '',
  });
  
  // Handle radius changes (debounced for text input)
  const handleRadiusChange = (value: string) => {
    setBorderRadiusInput(value);
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('borders', 'borderRadius', sanitized || null);
  };
  
  const handleTopLeftRadiusChange = (value: string) => {
    setBorderTopLeftRadiusInput(value);
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('borders', 'borderTopLeftRadius', sanitized || null);
  };
  
  const handleTopRightRadiusChange = (value: string) => {
    setBorderTopRightRadiusInput(value);
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('borders', 'borderTopRightRadius', sanitized || null);
  };
  
  const handleBottomRightRadiusChange = (value: string) => {
    setBorderBottomRightRadiusInput(value);
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('borders', 'borderBottomRightRadius', sanitized || null);
  };
  
  const handleBottomLeftRadiusChange = (value: string) => {
    setBorderBottomLeftRadiusInput(value);
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('borders', 'borderBottomLeftRadius', sanitized || null);
  };
  
  // Handle border width changes (debounced for text input)
  const handleBorderWidthChange = (value: string) => {
    setBorderWidthInput(value);
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('borders', 'borderWidth', sanitized || null);
  };
  
  const handleTopWidthChange = (value: string) => {
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('borders', 'borderTopWidth', sanitized || null);
  };
  
  const handleRightWidthChange = (value: string) => {
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('borders', 'borderRightWidth', sanitized || null);
  };
  
  const handleBottomWidthChange = (value: string) => {
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('borders', 'borderBottomWidth', sanitized || null);
  };
  
  const handleLeftWidthChange = (value: string) => {
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('borders', 'borderLeftWidth', sanitized || null);
  };
  
  // Handle border style change (immediate - dropdown selection)
  const handleBorderStyleChange = (value: string) => {
    updateDesignProperty('borders', 'borderStyle', value);
  };
  
  // Handle border color change (debounced for text input)
  const handleBorderColorChange = (value: string) => {
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('borders', 'borderColor', sanitized || null);
  };
  
  // Add border
  const handleAddBorder = () => {
    updateDesignProperties([
      { category: 'borders', property: 'borderWidth', value: '1px' },
      { category: 'borders', property: 'borderStyle', value: 'solid' },
      { category: 'borders', property: 'borderColor', value: '#000000' },
    ]);
  };
  
  // Remove border
  const handleRemoveBorder = () => {
    updateDesignProperties([
      { category: 'borders', property: 'borderWidth', value: null },
      { category: 'borders', property: 'borderTopWidth', value: null },
      { category: 'borders', property: 'borderRightWidth', value: null },
      { category: 'borders', property: 'borderBottomWidth', value: null },
      { category: 'borders', property: 'borderLeftWidth', value: null },
      { category: 'borders', property: 'borderStyle', value: null },
      { category: 'borders', property: 'borderColor', value: null },
    ]);
  };

  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Borders</Label>
      </header>

      <div className="flex flex-col gap-2">

        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="h-8">Radius</Label>
          <div className="col-span-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input
                stepper
                min="0"
                step="1"
                className="flex-1"
                disabled={radiusModeToggle.mode === 'individual-borders'}
                value={borderRadiusInput}
                onChange={(e) => handleRadiusChange(e.target.value)}
                placeholder="0"
              />
              <Button 
                variant={radiusModeToggle.mode === 'individual-borders' ? 'secondary' : 'ghost'} 
                size="sm"
                onClick={radiusModeToggle.handleToggle}
              >
                <Icon name="individualBorders" />
              </Button>
            </div>
            {radiusModeToggle.mode === 'individual-borders' && (
              <div className="grid grid-cols-2 gap-2">
                <InputGroup>
                  <InputGroupAddon>
                    <Icon name="borderTopLeft" className="size-3" />
                  </InputGroupAddon>
                  <InputGroupInput
                    stepper
                    min="0"
                    step="1"
                    value={borderTopLeftRadiusInput}
                    onChange={(e) => handleTopLeftRadiusChange(e.target.value)}
                    placeholder="0"
                  />
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon>
                    <Icon name="borderTopLeft" className="size-3 rotate-90" />
                  </InputGroupAddon>
                  <InputGroupInput
                    stepper
                    min="0"
                    step="1"
                    value={borderTopRightRadiusInput}
                    onChange={(e) => handleTopRightRadiusChange(e.target.value)}
                    placeholder="0"
                  />
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon>
                    <Icon name="borderTopLeft" className="size-3 rotate-270" />
                  </InputGroupAddon>
                  <InputGroupInput
                    stepper
                    min="0"
                    step="1"
                    value={borderBottomLeftRadiusInput}
                    onChange={(e) => handleBottomLeftRadiusChange(e.target.value)}
                    placeholder="0"
                  />
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon>
                    <Icon name="borderTopLeft" className="size-3 rotate-180" />
                  </InputGroupAddon>
                  <InputGroupInput
                    stepper
                    min="0"
                    step="1"
                    value={borderBottomRightRadiusInput}
                    onChange={(e) => handleBottomRightRadiusChange(e.target.value)}
                    placeholder="0"
                  />
                </InputGroup>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="h-8">Border</Label>
          <div className="col-span-2">
            <Popover>
              <PopoverTrigger asChild>
                {!hasBorder ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full"
                    onClick={handleAddBorder}
                  >
                    <Icon name="plus" />
                    Add
                  </Button>
                ) : (
                  <InputGroup>
                    <div className="w-full flex items-center justify-between gap-1 px-2.5">
                      <Label variant="muted">{borderStyle || 'Solid'}</Label>
                      <Button
                        size="xs"
                        className="-mr-1.5"
                        variant="ghost"
                        onClick={handleRemoveBorder}
                      >
                        <Icon name="x" />
                      </Button>
                    </div>
                  </InputGroup>
                )}
              </PopoverTrigger>

              <PopoverContent className="w-[255px] mr-4">

                <div className="flex flex-col gap-2">

                  <div className="grid grid-cols-3 items-start">
                    <Label variant="muted" className="h-8">Width</Label>
                    <div className="col-span-2 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Input
                          className="flex-1"
                          disabled={widthModeToggle.mode === 'individual-borders'}
                          value={borderWidthInput}
                          onChange={(e) => handleBorderWidthChange(e.target.value)}
                          placeholder="1"
                        />
                        <Button 
                          variant={widthModeToggle.mode === 'individual-borders' ? 'secondary' : 'ghost'} 
                          size="sm"
                          onClick={widthModeToggle.handleToggle}
                        >
                          <Icon name="individualBorders" />
                        </Button>
                      </div>
                      {widthModeToggle.mode === 'individual-borders' && (
                          <div className="grid grid-cols-4 gap-2">
                            <div className="flex flex-col items-center gap-1">
                              <Input
                                value={borderTopWidthInput}
                                onChange={(e) => handleTopWidthChange(e.target.value)}
                                placeholder="1"
                              />
                              <Label className="!text-[8px]" variant="muted">Top</Label>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <Input
                                value={borderRightWidthInput}
                                onChange={(e) => handleRightWidthChange(e.target.value)}
                                placeholder="1"
                              />
                              <Label className="!text-[8px]" variant="muted">Right</Label>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <Input
                                value={borderBottomWidthInput}
                                onChange={(e) => handleBottomWidthChange(e.target.value)}
                                placeholder="1"
                              />
                              <Label className="!text-[8px]" variant="muted">Bottom</Label>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <Input
                                value={borderLeftWidthInput}
                                onChange={(e) => handleLeftWidthChange(e.target.value)}
                                placeholder="1"
                              />
                              <Label className="!text-[8px]" variant="muted">Left</Label>
                            </div>
                          </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3">
                    <Label variant="muted">Style</Label>
                    <div className="col-span-2 *:w-full">
                      <Select value={borderStyle} onValueChange={handleBorderStyleChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="solid">Solid</SelectItem>
                            <SelectItem value="dashed">Dashed</SelectItem>
                            <SelectItem value="dotted">Dotted</SelectItem>
                            <SelectItem value="double">Double</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3">
                    <Label variant="muted">Color</Label>
                    <div className="col-span-2 *:w-full">
                      <Input
                        type="color"
                        value={borderColor || '#000000'}
                        onChange={(e) => handleBorderColorChange(e.target.value)}
                      />
                    </div>
                  </div>

                </div>

              </PopoverContent>
            </Popover>
          </div>
        </div>

      </div>

    </div>
  );
}
