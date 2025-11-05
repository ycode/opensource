'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useControlledInputs } from '@/hooks/use-controlled-input';
import { useEditorStore } from '@/stores/useEditorStore';
import type { Layer } from '@/types';

interface SizingControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function SizingControls({ layer, onLayerUpdate }: SizingControlsProps) {
  const { activeBreakpoint, activeUIState } = useEditorStore();
  const { updateDesignProperty, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
  });

  const [widthUnit, setWidthUnit] = useState<'px' | 'rem' | 'em' | '%'>('px');
  const [heightUnit, setHeightUnit] = useState<'px' | 'rem' | 'em' | '%'>('px');

  // Extract numeric value from design property
  const extractValue = (prop: string): string => {
    if (!prop) return '';
    // Handle special keywords
    if (['auto', 'full', 'screen', 'min', 'max', 'fit'].includes(prop)) return prop;
    if (prop === '100%') return 'full';
    return prop.replace(/[a-z%]+$/i, '');
  };

  // Get current values from layer (with inheritance)
  const width = getDesignProperty('sizing', 'width') || '';
  const height = getDesignProperty('sizing', 'height') || '';
  const minWidth = getDesignProperty('sizing', 'minWidth') || '';
  const minHeight = getDesignProperty('sizing', 'minHeight') || '';
  const maxWidth = getDesignProperty('sizing', 'maxWidth') || '';
  const maxHeight = getDesignProperty('sizing', 'maxHeight') || '';

  // Local controlled inputs (prevents repopulation bug)
  const inputs = useControlledInputs({
    width,
    height,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
  }, extractValue);

  const [widthInput, setWidthInput] = inputs.width;
  const [heightInput, setHeightInput] = inputs.height;
  const [minWidthInput, setMinWidthInput] = inputs.minWidth;
  const [minHeightInput, setMinHeightInput] = inputs.minHeight;
  const [maxWidthInput, setMaxWidthInput] = inputs.maxWidth;
  const [maxHeightInput, setMaxHeightInput] = inputs.maxHeight;

  // Handle width change
  const handleWidthChange = (value: string) => {
    setWidthInput(value);
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
    setHeightInput(value);
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
    setMinWidthInput(value);
    if (['auto', 'full', 'min', 'max', 'fit'].includes(value)) {
      updateDesignProperty('sizing', 'minWidth', value);
    } else {
      updateDesignProperty('sizing', 'minWidth', value ? `${value}${widthUnit}` : null);
    }
  };

  // Handle min height change
  const handleMinHeightChange = (value: string) => {
    setMinHeightInput(value);
    if (['auto', 'full', 'screen', 'min', 'max', 'fit'].includes(value)) {
      updateDesignProperty('sizing', 'minHeight', value);
    } else {
      updateDesignProperty('sizing', 'minHeight', value ? `${value}${heightUnit}` : null);
    }
  };

  // Handle max width change
  const handleMaxWidthChange = (value: string) => {
    setMaxWidthInput(value);
    if (['none', 'full', 'min', 'max', 'fit', 'prose'].includes(value)) {
      updateDesignProperty('sizing', 'maxWidth', value);
    } else {
      updateDesignProperty('sizing', 'maxWidth', value ? `${value}${widthUnit}` : null);
    }
  };

  // Handle max height change
  const handleMaxHeightChange = (value: string) => {
    setMaxHeightInput(value);
    if (['none', 'full', 'screen', 'min', 'max', 'fit'].includes(value)) {
      updateDesignProperty('sizing', 'maxHeight', value);
    } else {
      updateDesignProperty('sizing', 'maxHeight', value ? `${value}${heightUnit}` : null);
    }
  };

  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Sizing</Label>
      </header>

      {/* Width */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Label variant="muted" className="h-8 content-center">Width</Label>
        <div className="col-span-2">
          <InputGroup>
            <InputGroupInput
              type="text"
              value={widthInput}
              onChange={(e) => handleWidthChange(e.target.value)}
              placeholder="auto"
            />
            <InputGroupAddon>
              <Select value={widthUnit} onValueChange={(value: any) => setWidthUnit(value)}>
                <SelectTrigger
                  size="xs" variant="ghost"
                  className="border-0"
                >
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

      {/* Height */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Label variant="muted" className="h-8 content-center">Height</Label>
        <div className="col-span-2">
          <InputGroup>
            <InputGroupInput
              type="text"
              value={heightInput}
              onChange={(e) => handleHeightChange(e.target.value)}
              placeholder="auto"
            />
            <InputGroupAddon>
              <Select value={heightUnit} onValueChange={(value: any) => setHeightUnit(value)}>
                <SelectTrigger
                  size="xs" variant="ghost"
                  className="border-0"
                >
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

      {/* Min Width */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Label variant="muted" className="h-8 content-center">Min W</Label>
        <div className="col-span-2">
          <InputGroup>
            <InputGroupInput
              type="text"
              value={minWidthInput}
              onChange={(e) => handleMinWidthChange(e.target.value)}
              placeholder="auto"
            />
            <InputGroupAddon>
              <Select value={widthUnit} onValueChange={(value: any) => setWidthUnit(value)}>
                <SelectTrigger
                  size="xs" variant="ghost"
                  className="border-0"
                >
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

      {/* Max Width */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Label variant="muted" className="h-8 content-center">Max W</Label>
        <div className="col-span-2">
          <InputGroup>
            <InputGroupInput
              type="text"
              value={maxWidthInput}
              onChange={(e) => handleMaxWidthChange(e.target.value)}
              placeholder="none"
            />
            <InputGroupAddon>
              <Select value={widthUnit} onValueChange={(value: any) => setWidthUnit(value)}>
                <SelectTrigger
                  size="xs" variant="ghost"
                  className="border-0"
                >
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

      {/* Min Height */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Label variant="muted" className="h-8 content-center">Min H</Label>
        <div className="col-span-2">
          <InputGroup>
            <InputGroupInput
              type="text"
              value={minHeightInput}
              onChange={(e) => handleMinHeightChange(e.target.value)}
              placeholder="auto"
            />
            <InputGroupAddon>
              <Select value={heightUnit} onValueChange={(value: any) => setHeightUnit(value)}>
                <SelectTrigger
                  size="xs" variant="ghost"
                  className="border-0"
                >
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

      {/* Max Height */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Label variant="muted" className="h-8 content-center">Max H</Label>
        <div className="col-span-2">
          <InputGroup>
            <InputGroupInput
              type="text"
              value={maxHeightInput}
              onChange={(e) => handleMaxHeightChange(e.target.value)}
              placeholder="none"
            />
            <InputGroupAddon>
              <Select value={heightUnit} onValueChange={(value: any) => setHeightUnit(value)}>
                <SelectTrigger
                  size="xs" variant="ghost"
                  className="border-0"
                >
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
  );
}


