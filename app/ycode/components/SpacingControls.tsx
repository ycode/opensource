'use client';

import { useState, useCallback } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useModeToggle } from '@/hooks/use-mode-toggle';
import type { Layer } from '@/types';

interface SpacingControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function SpacingControls({ layer, onLayerUpdate }: SpacingControlsProps) {
  const { updateDesignProperty, updateDesignProperties, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate
  });
  
  const [marginUnit, setMarginUnit] = useState<'px' | 'rem' | 'em'>('px');
  
  // Get current values from layer
  const margin = getDesignProperty('spacing', 'margin') || '';
  const marginTop = getDesignProperty('spacing', 'marginTop') || '';
  const marginRight = getDesignProperty('spacing', 'marginRight') || '';
  const marginBottom = getDesignProperty('spacing', 'marginBottom') || '';
  const marginLeft = getDesignProperty('spacing', 'marginLeft') || '';
  
  // Use mode toggle hook for margin
  const marginModeToggle = useModeToggle({
    category: 'spacing',
    unifiedProperty: 'margin',
    individualProperties: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
    updateDesignProperty,
    updateDesignProperties,
    getCurrentValue: useCallback((prop: string) => getDesignProperty('spacing', prop) || '', [getDesignProperty]),
  });
  
  // Extract numeric value from design property
  const extractValue = (prop: string): string => {
    if (!prop) return '';
    if (prop === 'auto') return 'auto';
    return prop.replace(/[a-z%]+$/i, '');
  };
  
  // Handle margin changes
  const handleMarginChange = (value: string) => {
    if (marginModeToggle.mode === 'all-borders') {
      if (value === 'auto') {
        updateDesignProperty('spacing', 'margin', 'auto');
      } else {
        updateDesignProperty('spacing', 'margin', value ? `${value}${marginUnit}` : null);
      }
    }
  };
  
  const handleMarginTopChange = (value: string) => {
    if (value === 'auto') {
      updateDesignProperty('spacing', 'marginTop', 'auto');
    } else {
      updateDesignProperty('spacing', 'marginTop', value ? `${value}${marginUnit}` : null);
    }
  };
  
  const handleMarginRightChange = (value: string) => {
    if (value === 'auto') {
      updateDesignProperty('spacing', 'marginRight', 'auto');
    } else {
      updateDesignProperty('spacing', 'marginRight', value ? `${value}${marginUnit}` : null);
    }
  };
  
  const handleMarginBottomChange = (value: string) => {
    if (value === 'auto') {
      updateDesignProperty('spacing', 'marginBottom', 'auto');
    } else {
      updateDesignProperty('spacing', 'marginBottom', value ? `${value}${marginUnit}` : null);
    }
  };
  
  const handleMarginLeftChange = (value: string) => {
    if (value === 'auto') {
      updateDesignProperty('spacing', 'marginLeft', 'auto');
    } else {
      updateDesignProperty('spacing', 'marginLeft', value ? `${value}${marginUnit}` : null);
    }
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
                  disabled={marginModeToggle.mode === 'individual-borders'}
                  value={extractValue(margin)}
                  onChange={(e) => handleMarginChange(e.target.value)}
                  placeholder="16"
                />
                <InputGroupAddon align="inline-end">
                  <Select value={marginUnit} onValueChange={(value) => setMarginUnit(value as 'px' | 'rem' | 'em')}>
                    <SelectTrigger size="xs" variant="ghost">
                      {marginUnit}
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
                        <TooltipTrigger>
                          <Icon name="paddingSide" className="size-3" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Left margin</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    className="!pr-0"
                    value={extractValue(marginLeft)}
                    onChange={(e) => handleMarginLeftChange(e.target.value)}
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
                          <p>Top margin</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    className="!pr-0"
                    value={extractValue(marginTop)}
                    onChange={(e) => handleMarginTopChange(e.target.value)}
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
                          <p>Right margin</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    className="!pr-0"
                    value={extractValue(marginRight)}
                    onChange={(e) => handleMarginRightChange(e.target.value)}
                    placeholder="0"
                  />
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon>
                    <div className="flex">
                      <Tooltip>
                        <TooltipTrigger>
                          <Icon name="paddingSide" className="size-3 rotate-270" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Bottom margin</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </InputGroupAddon>
                  <InputGroupInput
                    className="!pr-0"
                    value={extractValue(marginBottom)}
                    onChange={(e) => handleMarginBottomChange(e.target.value)}
                    placeholder="0"
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


