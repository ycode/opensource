'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Icon from '@/components/ui/icon';
import SettingsPanel from '@/app/ycode/components/SettingsPanel';

export default function SizingControls() {
  const [widthUnit, setWidthUnit] = useState<'px' | '%' | 'auto'>('px');
  const [heightUnit, setHeightUnit] = useState<'px' | '%' | 'auto'>('px');
  const [isOpen, setIsOpen] = useState(true);

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
    onLayerUpdate
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
    <SettingsPanel
      title="Sizing" isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="h-8">Width</Label>
          <div className="col-span-2 flex flex-col gap-2">
            <ButtonGroup>
              <Input />
              <ButtonGroupSeparator />
              <Select>
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
                    <InputGroupInput placeholder="Min" />
                  </InputGroup>
                </ButtonGroup>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                  <Select>
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
                    <InputGroupInput placeholder="Max" />
                  </InputGroup>
                </ButtonGroup>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                  <Select>
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
              <Input />
              <ButtonGroupSeparator />
              <Select>
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
                    <InputGroupInput placeholder="Min" />
                  </InputGroup>
                </ButtonGroup>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                  <Select>
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
                            <Icon name="maxSize" className="size-3 rotate-90" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Max height</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </InputGroupAddon>
                    <InputGroupInput placeholder="Max" />
                  </InputGroup>
                </ButtonGroup>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                  <Select>
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

        <div className="grid grid-cols-3">
          <Label variant="muted">Overflow</Label>
          <div className="col-span-2 *:w-full">
            <Select>
              <SelectTrigger>
                Visible
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="1">Visible</SelectItem>
                  <SelectItem value="2">Hidden</SelectItem>
                  <SelectItem value="3">Scroll</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="h-8">Aspect ratio</Label>
          <div className="col-span-2 flex flex-col gap-2">
            <ButtonGroup>
              <Input />
              <ButtonGroupSeparator />
              <Select>
                <SelectTrigger />
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="1">Video</SelectItem>
                    <SelectItem value="2">Square</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </ButtonGroup>
          </div>
        </div>
      </div>
    </div>
    </SettingsPanel>
  );
}


