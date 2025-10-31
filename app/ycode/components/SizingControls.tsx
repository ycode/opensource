'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useDesignSync } from '@/hooks/use-design-sync';
import type { Layer } from '@/types';

interface SizingControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function SizingControls({ layer, onLayerUpdate }: SizingControlsProps) {
  const { updateDesignProperty, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
  });
  
  const [widthUnit, setWidthUnit] = useState<'px' | 'rem' | 'em' | '%'>('px');
  const [heightUnit, setHeightUnit] = useState<'px' | 'rem' | 'em' | '%'>('px');
  
  // Get current values from layer
  const width = getDesignProperty('sizing', 'width') || '';
  const height = getDesignProperty('sizing', 'height') || '';
  const minWidth = getDesignProperty('sizing', 'minWidth') || '';
  const minHeight = getDesignProperty('sizing', 'minHeight') || '';
  const maxWidth = getDesignProperty('sizing', 'maxWidth') || '';
  const maxHeight = getDesignProperty('sizing', 'maxHeight') || '';
  
  // Extract numeric value from design property
  const extractValue = (prop: string): string => {
    if (!prop) return '';
    // Handle special keywords
    if (['auto', 'full', 'screen', 'min', 'max', 'fit'].includes(prop)) return prop;
    if (prop === '100%') return 'full';
    return prop.replace(/[a-z%]+$/i, '');
  };
  
  // Handle width change
  const handleWidthChange = (value: string) => {
    if (['auto', 'full', 'screen', 'min', 'max', 'fit'].includes(value)) {
      updateDesignProperty('sizing', 'width', value);
    } else if (value === '') {
      updateDesignProperty('sizing', 'width', null);
    } else {
      updateDesignProperty('sizing', 'width', `${value}${widthUnit}`);
    }
  };
  
  // Handle height change
  const handleHeightChange = (value: string) => {
    if (['auto', 'full', 'screen', 'min', 'max', 'fit'].includes(value)) {
      updateDesignProperty('sizing', 'height', value);
    } else if (value === '') {
      updateDesignProperty('sizing', 'height', null);
    } else {
      updateDesignProperty('sizing', 'height', `${value}${heightUnit}`);
    }
  };
  
  // Handle min width change
  const handleMinWidthChange = (value: string) => {
    if (['auto', 'full', 'min', 'max', 'fit'].includes(value)) {
      updateDesignProperty('sizing', 'minWidth', value);
    } else {
      updateDesignProperty('sizing', 'minWidth', value ? `${value}${widthUnit}` : null);
    }
  };
  
  // Handle min height change
  const handleMinHeightChange = (value: string) => {
    if (['auto', 'full', 'screen', 'min', 'max', 'fit'].includes(value)) {
      updateDesignProperty('sizing', 'minHeight', value);
    } else {
      updateDesignProperty('sizing', 'minHeight', value ? `${value}${heightUnit}` : null);
    }
  };
  
  // Handle max width change
  const handleMaxWidthChange = (value: string) => {
    if (['none', 'full', 'min', 'max', 'fit', 'prose'].includes(value)) {
      updateDesignProperty('sizing', 'maxWidth', value);
    } else {
      updateDesignProperty('sizing', 'maxWidth', value ? `${value}${widthUnit}` : null);
    }
  };
  
  // Handle max height change
  const handleMaxHeightChange = (value: string) => {
    if (['none', 'full', 'screen', 'min', 'max', 'fit'].includes(value)) {
      updateDesignProperty('sizing', 'maxHeight', value);
    } else {
      updateDesignProperty('sizing', 'maxHeight', value ? `${value}${heightUnit}` : null);
    }
  };
  
  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Size</Label>
      </header>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3">
          <Label variant="muted">Width</Label>
          <div className="col-span-2 *:w-full">
            <InputGroup>
              <InputGroupInput
                value={extractValue(width)}
                onChange={(e) => handleWidthChange(e.target.value)}
                placeholder="auto"
              />
              <InputGroupAddon align="inline-end">
                <Select value={widthUnit} onValueChange={(value) => setWidthUnit(value as 'px' | 'rem' | 'em' | '%')}>
                  <SelectTrigger size="xs" variant="ghost">
                    {widthUnit}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="px">px</SelectItem>
                      <SelectItem value="rem">rem</SelectItem>
                      <SelectItem value="em">em</SelectItem>
                      <SelectItem value="%">%</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Height</Label>
          <div className="col-span-2 *:w-full">
            <InputGroup>
              <InputGroupInput
                value={extractValue(height)}
                onChange={(e) => handleHeightChange(e.target.value)}
                placeholder="auto"
              />
              <InputGroupAddon align="inline-end">
                <Select value={heightUnit} onValueChange={(value) => setHeightUnit(value as 'px' | 'rem' | 'em' | '%')}>
                  <SelectTrigger size="xs" variant="ghost">
                    {heightUnit}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="px">px</SelectItem>
                      <SelectItem value="rem">rem</SelectItem>
                      <SelectItem value="em">em</SelectItem>
                      <SelectItem value="%">%</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Min W</Label>
          <div className="col-span-2 *:w-full">
            <InputGroup>
              <InputGroupInput
                value={extractValue(minWidth)}
                onChange={(e) => handleMinWidthChange(e.target.value)}
                placeholder="0"
              />
              <InputGroupAddon align="inline-end">
                <Select value={widthUnit} onValueChange={(value) => setWidthUnit(value as 'px' | 'rem' | 'em' | '%')}>
                  <SelectTrigger size="xs" variant="ghost">
                    {widthUnit}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="px">px</SelectItem>
                      <SelectItem value="rem">rem</SelectItem>
                      <SelectItem value="em">em</SelectItem>
                      <SelectItem value="%">%</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Min H</Label>
          <div className="col-span-2 *:w-full">
            <InputGroup>
              <InputGroupInput
                value={extractValue(minHeight)}
                onChange={(e) => handleMinHeightChange(e.target.value)}
                placeholder="0"
              />
              <InputGroupAddon align="inline-end">
                <Select value={heightUnit} onValueChange={(value) => setHeightUnit(value as 'px' | 'rem' | 'em' | '%')}>
                  <SelectTrigger size="xs" variant="ghost">
                    {heightUnit}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="px">px</SelectItem>
                      <SelectItem value="rem">rem</SelectItem>
                      <SelectItem value="em">em</SelectItem>
                      <SelectItem value="%">%</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Max W</Label>
          <div className="col-span-2 *:w-full">
            <InputGroup>
              <InputGroupInput
                value={extractValue(maxWidth)}
                onChange={(e) => handleMaxWidthChange(e.target.value)}
                placeholder="none"
              />
              <InputGroupAddon align="inline-end">
                <Select value={widthUnit} onValueChange={(value) => setWidthUnit(value as 'px' | 'rem' | 'em' | '%')}>
                  <SelectTrigger size="xs" variant="ghost">
                    {widthUnit}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="px">px</SelectItem>
                      <SelectItem value="rem">rem</SelectItem>
                      <SelectItem value="em">em</SelectItem>
                      <SelectItem value="%">%</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Max H</Label>
          <div className="col-span-2 *:w-full">
            <InputGroup>
              <InputGroupInput
                value={extractValue(maxHeight)}
                onChange={(e) => handleMaxHeightChange(e.target.value)}
                placeholder="none"
              />
              <InputGroupAddon align="inline-end">
                <Select value={heightUnit} onValueChange={(value) => setHeightUnit(value as 'px' | 'rem' | 'em' | '%')}>
                  <SelectTrigger size="xs" variant="ghost">
                    {heightUnit}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="px">px</SelectItem>
                      <SelectItem value="rem">rem</SelectItem>
                      <SelectItem value="em">em</SelectItem>
                      <SelectItem value="%">%</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>
      </div>
    </div>
  );
}


