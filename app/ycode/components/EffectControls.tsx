'use client';

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useEditorStore } from '@/stores/useEditorStore';
import { removeSpaces } from '@/lib/utils';
import type { Layer } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import ColorPicker from '@/app/ycode/components/ColorPicker';

interface EffectControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function EffectControls({ layer, onLayerUpdate }: EffectControlsProps) {
  const { activeBreakpoint, activeUIState } = useEditorStore();
  const { updateDesignProperty, debouncedUpdateDesignProperty, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
  });

  // Get current values from layer (no inheritance - only exact breakpoint values)
  const opacity = getDesignProperty('effects', 'opacity') || '100';
  const boxShadow = getDesignProperty('effects', 'boxShadow') || '';

  // Shadow interface
  interface Shadow {
    id: string;
    position: 'outside' | 'inside';
    color: string;
    x: number;
    y: number;
    blur: number;
    spread: number;
  }

  // Parse existing shadows from boxShadow property
  const parseExistingShadows = (shadowString: string): Shadow[] => {
    if (!shadowString) return [];
    
    try {
      // Split by comma followed by underscore (our separator for multiple shadows)
      const shadowStrings = shadowString.split(',_');
      
      return shadowStrings.map((shadowStr, index) => {
        const isInset = shadowStr.startsWith('inset_');
        const cleanShadow = isInset ? shadowStr.replace('inset_', '') : shadowStr;
        
        // Parse: 0px_9px_4px_0px_rgba(0,0,0,0.25)
        // Match pattern: number+unit, number+unit, number+unit, number+unit, color
        const parts = cleanShadow.split('_');
        
        if (parts.length >= 5) {
          const x = parseInt(parts[0]) || 0;
          const y = parseInt(parts[1]) || 0;
          const blur = parseInt(parts[2]) || 0;
          const spread = parseInt(parts[3]) || 0;
          // Color is everything after the 4th underscore
          const color = parts.slice(4).join('_');
          
          return {
            id: `shadow-${Date.now()}-${index}`,
            position: isInset ? 'inside' : 'outside',
            color,
            x,
            y,
            blur,
            spread,
          };
        }
        
        // Fallback for invalid format
        return {
          id: `shadow-${Date.now()}-${index}`,
          position: 'outside',
          color: 'rgba(0,0,0,0.25)',
          x: 0,
          y: 9,
          blur: 4,
          spread: 0,
        };
      });
    } catch (error) {
      console.error('Error parsing shadows:', error);
      return [];
    }
  };

  const [shadows, setShadows] = useState<Shadow[]>([]);
  const [editingShadowId, setEditingShadowId] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Sync shadows when layer changes (not when boxShadow updates during editing)
  useEffect(() => {
    const currentBoxShadow = getDesignProperty('effects', 'boxShadow') || '';
    
    if (currentBoxShadow) {
      // Parse and load existing shadows
      const parsed = parseExistingShadows(currentBoxShadow);
      setShadows(parsed);
    } else {
      // Clear shadows when no boxShadow
      setShadows([]);
    }
    // Reset editing state when layer changes
    setEditingShadowId(null);
    setPopoverOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer?.id, activeBreakpoint, activeUIState]);

  // Extract numeric value (0-100)
  const extractOpacity = (prop: string): number => {
    if (!prop) return 100;
    const match = prop.match(/(\d+)/);
    return match ? parseInt(match[1]) : 100;
  };

  const opacityValue = extractOpacity(opacity);

  // Handle opacity change (debounced for text input)
  const handleOpacityChange = (value: string) => {
    const numValue = Math.max(0, Math.min(100, parseInt(value) || 0));
    debouncedUpdateDesignProperty('effects', 'opacity', `${numValue}`);
  };

  // Handle opacity slider change (immediate - slider interaction)
  const handleOpacitySliderChange = (values: number[]) => {
    updateDesignProperty('effects', 'opacity', `${values[0]}`);
  };

  // Handle box shadow change (debounced for text input)
  const handleBoxShadowChange = (value: string) => {
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('effects', 'boxShadow', sanitized || null);
  };

  // Generate shadow CSS value from shadow object
  const generateShadowString = (shadow: Shadow): string => {
    const inset = shadow.position === 'inside' ? 'inset_' : '';
    return `${inset}${shadow.x}px_${shadow.y}px_${shadow.blur}px_${shadow.spread}px_${shadow.color}`;
  };

  // Generate full shadows value for all shadows
  const generateFullShadowValue = (shadowsList: Shadow[]): string => {
    return shadowsList.map(generateShadowString).join(',_');
  };

  // Get currently editing shadow
  const editingShadow = shadows.find(s => s.id === editingShadowId);

  // Convert any color format to rgba
  const convertToRgba = (color: string): string => {
    // If already rgba, return as is
    if (color.startsWith('rgba')) return color;
    if (color.startsWith('rgb')) {
      // Convert rgb to rgba by adding opacity 1
      return color.replace('rgb(', 'rgba(').replace(')', ',1)');
    }

    // Convert HEX to rgba
    const hex = color.replace('#', '');
    let r: number, g: number, b: number, a = 1;

    if (hex.length === 8) {
      // 8-char hex with alpha
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
      a = parseInt(hex.substring(6, 8), 16) / 255;
    } else if (hex.length === 6) {
      // 6-char hex
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 3) {
      // 3-char hex
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else {
      // Fallback
      return 'rgba(0,0,0,1)';
    }

    return `rgba(${r},${g},${b},${a})`;
  };

  // Open popover and create new shadow OR edit existing
  const handleOpenPopover = (open: boolean) => {
    if (open && !editingShadowId) {
      // Create new shadow with defaults
      const newShadow: Shadow = {
        id: Date.now().toString(),
        position: 'outside',
        color: 'rgba(0,0,0,0.25)',
        x: 0,
        y: 9,
        blur: 4,
        spread: 0,
      };

      const updatedShadows = [...shadows, newShadow];
      setShadows(updatedShadows);
      setEditingShadowId(newShadow.id);

      // Apply immediately
      const shadowValue = generateFullShadowValue(updatedShadows);
      updateDesignProperty('effects', 'boxShadow', shadowValue);
    } else if (!open) {
      // Close popover
      setEditingShadowId(null);
    }
    setPopoverOpen(open);
  };

  // Open popover to edit existing shadow
  const handleEditShadow = (shadowId: string) => {
    setEditingShadowId(shadowId);
    setPopoverOpen(true);
  };

  // Update shadow property in real-time
  const updateEditingShadow = (updates: Partial<Shadow>) => {
    if (!editingShadowId) return;

    const updatedShadows = shadows.map(s =>
      s.id === editingShadowId ? { ...s, ...updates } : s
    );
    setShadows(updatedShadows);

    // Apply immediately
    const shadowValue = generateFullShadowValue(updatedShadows);
    updateDesignProperty('effects', 'boxShadow', shadowValue);
  };

  // Remove shadow
  const handleRemoveShadow = (shadowId: string) => {
    const updatedShadows = shadows.filter(s => s.id !== shadowId);
    setShadows(updatedShadows);

    if (updatedShadows.length === 0) {
      updateDesignProperty('effects', 'boxShadow', null);
    } else {
      const shadowValue = generateFullShadowValue(updatedShadows);
      updateDesignProperty('effects', 'boxShadow', shadowValue);
    }
  };

  // Shadow value change handlers (update in real-time)
  const handleShadowPositionChange = (value: 'outside' | 'inside') => {
    updateEditingShadow({ position: value });
  };

  const handleShadowColorChange = (value: string) => {
    const rgbaColor = convertToRgba(value);
    updateEditingShadow({ color: rgbaColor });
  };

  const handleShadowXChange = (value: number) => {
    updateEditingShadow({ x: value });
  };

  const handleShadowYChange = (value: number) => {
    updateEditingShadow({ y: value });
  };

  const handleShadowBlurChange = (value: number) => {
    updateEditingShadow({ blur: value });
  };

  const handleShadowSpreadChange = (value: number) => {
    updateEditingShadow({ spread: value });
  };

  // Get display name for shadow
  const getShadowDisplayName = (shadow: Shadow): string => {
    const pos = shadow.position === 'inside' ? 'Inner' : 'Outer';
    return `${pos} ${shadow.x}px ${shadow.y}px ${shadow.blur}px`;
  };

  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Effects</Label>
      </header>

      <div className="flex flex-col gap-2">

          <div className="grid grid-cols-3">
              <Label variant="muted">Opacity</Label>
              <div className="col-span-2 grid grid-cols-2 items-center gap-2">
                  <InputGroup>
                      <InputGroupInput
                        className="!pr-0"
                        value={opacityValue}
                        onChange={(e) => handleOpacityChange(e.target.value)}
                        type="number"
                        min="0"
                        max="100"
                      />
                      <InputGroupAddon align="inline-end">
                          <Label variant="muted" className="text-xs">%</Label>
                      </InputGroupAddon>
                  </InputGroup>
                  <Slider
                    className="flex-1"
                    value={[opacityValue]}
                    onValueChange={handleOpacitySliderChange}
                    min={0}
                    max={100}
                    step={1}
                  />
              </div>
          </div>

          <div className="grid grid-cols-3 items-start">
              <Label variant="muted" className="py-2">Shadow</Label>
              <div className="col-span-2 *:w-full flex flex-col gap-2">

                  <Popover open={popoverOpen} onOpenChange={handleOpenPopover}>
                    <PopoverTrigger asChild>
                      <Button variant="secondary" size="sm">Add</Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 my-0.5 flex flex-col gap-2" align="end">
                      {editingShadow && (
                        <>
                          <div className="grid grid-cols-3">
                            <Label variant="muted">Position</Label>
                            <div className="col-span-2">
                              <Tabs
                                value={editingShadow.position}
                                onValueChange={(value) => handleShadowPositionChange(value as 'outside' | 'inside')}
                                className="w-full"
                              >
                                <TabsList className="w-full">
                                  <TabsTrigger value="outside">
                                    Outside
                                  </TabsTrigger>
                                  <TabsTrigger value="inside">
                                    Inside
                                  </TabsTrigger>
                                </TabsList>
                              </Tabs>
                            </div>
                          </div>

                          <div className="grid grid-cols-3">
                            <Label variant="muted">Color</Label>
                            <div className="col-span-2 *:w-full">
                              <ColorPicker value={editingShadow.color} onChange={handleShadowColorChange} />
                            </div>
                          </div>

                          <div className="grid grid-cols-3">
                            <Label variant="muted">X</Label>
                            <div className="col-span-2 grid grid-cols-2 items-center gap-2">
                              <Input
                                type="number"
                                value={editingShadow.x}
                                onChange={(e) => handleShadowXChange(parseInt(e.target.value) || 0)}
                              />
                              <Slider
                                className="flex-1"
                                value={[editingShadow.x]}
                                onValueChange={(values) => handleShadowXChange(values[0])}
                                min={-100}
                                max={100}
                                step={1}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3">
                            <Label variant="muted">Y</Label>
                            <div className="col-span-2 grid grid-cols-2 items-center gap-2">
                              <Input
                                type="number"
                                value={editingShadow.y}
                                onChange={(e) => handleShadowYChange(parseInt(e.target.value) || 0)}
                              />
                              <Slider
                                className="flex-1"
                                value={[editingShadow.y]}
                                onValueChange={(values) => handleShadowYChange(values[0])}
                                min={-100}
                                max={100}
                                step={1}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3">
                            <Label variant="muted">Blur</Label>
                            <div className="col-span-2 grid grid-cols-2 items-center gap-2">
                              <Input
                                type="number"
                                value={editingShadow.blur}
                                onChange={(e) => handleShadowBlurChange(parseInt(e.target.value) || 0)}
                              />
                              <Slider
                                className="flex-1"
                                value={[editingShadow.blur]}
                                onValueChange={(values) => handleShadowBlurChange(values[0])}
                                min={0}
                                max={100}
                                step={1}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-3">
                            <Label variant="muted">Spread</Label>
                            <div className="col-span-2 grid grid-cols-2 items-center gap-2">
                              <Input
                                type="number"
                                value={editingShadow.spread}
                                onChange={(e) => handleShadowSpreadChange(parseInt(e.target.value) || 0)}
                              />
                              <Slider
                                className="flex-1"
                                value={[editingShadow.spread]}
                                onValueChange={(values) => handleShadowSpreadChange(values[0])}
                                min={0}
                                max={100}
                                step={1}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </PopoverContent>
                  </Popover>

                  {shadows.map((shadow) => (
                    <div
                      key={shadow.id}
                      className="bg-secondary/50 rounded-lg flex justify-between items-center p-2 cursor-pointer hover:bg-secondary/70 transition-colors"
                      onClick={() => handleEditShadow(shadow.id)}
                    >
                      <Label variant="muted" className="cursor-pointer">{getShadowDisplayName(shadow)}</Label>
                      <Button
                        variant="outline"
                        className="!size-4 !p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveShadow(shadow.id);
                        }}
                      >
                        <Icon name="x" className="size-2" />
                      </Button>
                    </div>
                  ))}

                  {/*<Select value={boxShadow || 'none'} onValueChange={handleBoxShadowChange}>*/}
                  {/*    <SelectTrigger>*/}
                  {/*        <SelectValue />*/}
                  {/*    </SelectTrigger>*/}
                  {/*    <SelectContent>*/}
                  {/*        <SelectGroup>*/}
                  {/*            <SelectItem value="none">None</SelectItem>*/}
                  {/*            <SelectItem value="sm">Small</SelectItem>*/}
                  {/*            <SelectItem value="md">Medium</SelectItem>*/}
                  {/*            <SelectItem value="lg">Large</SelectItem>*/}
                  {/*            <SelectItem value="xl">Extra Large</SelectItem>*/}
                  {/*            <SelectItem value="2xl">2X Large</SelectItem>*/}
                  {/*            <SelectItem value="inner">Inner</SelectItem>*/}
                  {/*        </SelectGroup>*/}
                  {/*    </SelectContent>*/}
                  {/*</Select>*/}

              </div>
          </div>

      </div>
    </div>
  );
}
