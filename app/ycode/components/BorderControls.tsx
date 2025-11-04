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
import type { Layer } from '@/types';

interface BorderControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function BorderControls({ layer, onLayerUpdate }: BorderControlsProps) {
  const { activeBreakpoint } = useEditorStore();
  const { updateDesignProperty, updateDesignProperties, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint
  });
  
  // Extract numeric value from design property
  const extractValue = (prop: string): string => {
    if (!prop) return '';
    return prop.replace(/[a-z%]+$/i, '');
  };
  
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
  }, extractValue);

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
    getCurrentValue: useCallback((prop: string) => getDesignProperty('borders', prop) || '', [getDesignProperty]),
  });
  
  const widthModeToggle = useModeToggle({
    category: 'borders',
    unifiedProperty: 'borderWidth',
    individualProperties: ['borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth'],
    updateDesignProperty,
    updateDesignProperties,
    getCurrentValue: useCallback((prop: string) => getDesignProperty('borders', prop) || '', [getDesignProperty]),
  });
  
  // Extract numeric value from design property
  // Handle radius changes
  const handleRadiusChange = (value: string) => {
    setBorderRadiusInput(value);
    updateDesignProperty('borders', 'borderRadius', value ? `${value}px` : null);
  };
  
  const handleTopLeftRadiusChange = (value: string) => {
    setBorderTopLeftRadiusInput(value);
    updateDesignProperty('borders', 'borderTopLeftRadius', value ? `${value}px` : null);
  };
  
  const handleTopRightRadiusChange = (value: string) => {
    setBorderTopRightRadiusInput(value);
    updateDesignProperty('borders', 'borderTopRightRadius', value ? `${value}px` : null);
  };
  
  const handleBottomRightRadiusChange = (value: string) => {
    setBorderBottomRightRadiusInput(value);
    updateDesignProperty('borders', 'borderBottomRightRadius', value ? `${value}px` : null);
  };
  
  const handleBottomLeftRadiusChange = (value: string) => {
    setBorderBottomLeftRadiusInput(value);
    updateDesignProperty('borders', 'borderBottomLeftRadius', value ? `${value}px` : null);
  };
  
  // Handle border width changes
  const handleBorderWidthChange = (value: string) => {
    setBorderWidthInput(value);
    updateDesignProperty('borders', 'borderWidth', value ? `${value}px` : null);
  };
  
  const handleTopWidthChange = (value: string) => {
    updateDesignProperty('borders', 'borderTopWidth', value ? `${value}px` : null);
  };
  
  const handleRightWidthChange = (value: string) => {
    updateDesignProperty('borders', 'borderRightWidth', value ? `${value}px` : null);
  };
  
  const handleBottomWidthChange = (value: string) => {
    updateDesignProperty('borders', 'borderBottomWidth', value ? `${value}px` : null);
  };
  
  const handleLeftWidthChange = (value: string) => {
    updateDesignProperty('borders', 'borderLeftWidth', value ? `${value}px` : null);
  };
  
  // Handle border style change
  const handleBorderStyleChange = (value: string) => {
    updateDesignProperty('borders', 'borderStyle', value);
  };
  
  // Handle border color change
  const handleBorderColorChange = (value: string) => {
    updateDesignProperty('borders', 'borderColor', value || null);
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
                    className="!pr-0"
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
                    className="!pr-0"
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
                    className="!pr-0"
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
                    className="!pr-0"
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
