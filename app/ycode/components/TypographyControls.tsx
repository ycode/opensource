'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDesignSync } from '@/hooks/use-design-sync';
import type { Layer } from '@/types';

interface TypographyControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function TypographyControls({ layer, onLayerUpdate }: TypographyControlsProps) {
  const { updateDesignProperty, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate
  });
  
  const [sizeUnit, setSizeUnit] = useState<'px' | 'rem' | 'em'>('px');
  
  // Get current values from layer
  const fontFamily = getDesignProperty('typography', 'fontFamily') || 'sans';
  const fontWeight = getDesignProperty('typography', 'fontWeight') || 'normal';
  const fontSize = getDesignProperty('typography', 'fontSize') || '';
  const textAlign = getDesignProperty('typography', 'textAlign') || 'left';
  const letterSpacing = getDesignProperty('typography', 'letterSpacing') || '';
  const lineHeight = getDesignProperty('typography', 'lineHeight') || '';
  
  // Handle font family change
  const handleFontFamilyChange = (value: string) => {
    updateDesignProperty('typography', 'fontFamily', value === 'inherit' ? null : value);
  };
  
  // Handle font weight change
  const handleFontWeightChange = (value: string) => {
    updateDesignProperty('typography', 'fontWeight', value);
  };
  
  // Handle font size change
  const handleFontSizeChange = (value: string) => {
    updateDesignProperty('typography', 'fontSize', value ? `${value}${sizeUnit}` : null);
  };
  
  // Handle font size unit change
  const handleFontSizeUnitChange = (newUnit: 'px' | 'rem' | 'em') => {
    setSizeUnit(newUnit);
    // Update the stored value with the new unit
    const numericValue = extractValue(fontSize);
    if (numericValue) {
      updateDesignProperty('typography', 'fontSize', `${numericValue}${newUnit}`);
    }
  };
  
  // Handle text align change
  const handleTextAlignChange = (value: string) => {
    updateDesignProperty('typography', 'textAlign', value);
  };
  
  // Handle letter spacing change
  const handleLetterSpacingChange = (value: string) => {
    updateDesignProperty('typography', 'letterSpacing', value ? `${value}${sizeUnit}` : null);
  };
  
  // Handle letter spacing unit change
  const handleLetterSpacingUnitChange = (newUnit: 'px' | 'rem' | 'em') => {
    setSizeUnit(newUnit);
    // Update the stored value with the new unit
    const numericValue = extractValue(letterSpacing);
    if (numericValue) {
      updateDesignProperty('typography', 'letterSpacing', `${numericValue}${newUnit}`);
    }
  };
  
  // Handle line height change
  const handleLineHeightChange = (value: string) => {
    updateDesignProperty('typography', 'lineHeight', value || null);
  };
  
  // Extract numeric value from design property
  const extractValue = (prop: string): string => {
    if (!prop) return '';
    return prop.replace(/[a-z%]+$/i, '');
  };
  
  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Typography</Label>
      </header>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3">
          <Label variant="muted">Font</Label>
          <div className="col-span-2 *:w-full">
            <Select value={fontFamily} onValueChange={handleFontFamilyChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="inherit">Inherit</SelectItem>
                  <SelectItem value="sans">Sans</SelectItem>
                  <SelectItem value="serif">Serif</SelectItem>
                  <SelectItem value="mono">Mono</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Weight</Label>
          <div className="col-span-2 *:w-full">
            <Select value={fontWeight} onValueChange={handleFontWeightChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="thin">Thin</SelectItem>
                  <SelectItem value="extralight">Extralight</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="normal">Regular</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="semibold">Semibold</SelectItem>
                  <SelectItem value="bold">Bold</SelectItem>
                  <SelectItem value="extrabold">Extrabold</SelectItem>
                  <SelectItem value="black">Black</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Size</Label>
          <div className="col-span-2 *:w-full">
            <InputGroup>
              <InputGroupInput
                value={extractValue(fontSize)}
                onChange={(e) => handleFontSizeChange(e.target.value)}
                placeholder="16"
              />
              <InputGroupAddon align="inline-end">
                <Select value={sizeUnit} onValueChange={handleFontSizeUnitChange}>
                  <SelectTrigger size="xs" variant="ghost">
                    {sizeUnit}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="px">px</SelectItem>
                      <SelectItem value="rem">rem</SelectItem>
                      <SelectItem value="em">em</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Align</Label>
          <div className="col-span-2">
            <Tabs value={textAlign} onValueChange={handleTextAlignChange} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="left" className="px-2 text-xs">
                  <Icon name="textAlignLeft" />
                </TabsTrigger>
                <TabsTrigger value="center" className="px-2 text-xs">
                  <Icon name="textAlignCenter" />
                </TabsTrigger>
                <TabsTrigger value="right" className="px-2 text-xs">
                  <Icon name="textAlignRight" />
                </TabsTrigger>
                <TabsTrigger value="justify" className="px-2 text-xs">
                  <Icon name="textAlignJustify" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Spacing</Label>
          <div className="col-span-2 grid grid-cols-2 gap-2">
            <InputGroup>
              <InputGroupAddon>
                <div className="flex">
                  <Tooltip>
                    <TooltipTrigger>
                      <Icon name="letterSpacing" className="size-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Letter spacing</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </InputGroupAddon>
              <InputGroupInput
                className="!pr-0"
                value={extractValue(letterSpacing)}
                onChange={(e) => handleLetterSpacingChange(e.target.value)}
                placeholder="0"
              />
            </InputGroup>
            <InputGroup>
              <InputGroupAddon>
                <div className="flex">
                  <Tooltip>
                    <TooltipTrigger>
                      <Icon name="lineHeight" className="size-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Line height</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </InputGroupAddon>
              <InputGroupInput
                className="!pr-0"
                value={extractValue(lineHeight)}
                onChange={(e) => handleLineHeightChange(e.target.value)}
                placeholder="1.5"
              />
            </InputGroup>
          </div>
        </div>
      </div>
    </div>
  );
}
