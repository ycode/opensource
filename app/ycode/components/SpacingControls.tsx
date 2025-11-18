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
  const { updateDesignProperty, updateDesignProperties, getDesignProperty } = useDesignSync({
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
  
  // Local controlled inputs (prevents repopulation bug)
  const inputs = useControlledInputs({
    margin,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
  }, extractMeasurementValue);

  const [marginInput, setMarginInput] = inputs.margin;
  const [marginTopInput, setMarginTopInput] = inputs.marginTop;
  const [marginRightInput, setMarginRightInput] = inputs.marginRight;
  const [marginBottomInput, setMarginBottomInput] = inputs.marginBottom;
  const [marginLeftInput, setMarginLeftInput] = inputs.marginLeft;
  
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
  
  // Handle margin changes
  const handleMarginChange = (value: string) => {
    setMarginInput(value);
    if (marginModeToggle.mode === 'all-borders') {
      if (value === 'auto') {
        updateDesignProperty('spacing', 'margin', 'auto');
      } else {
        const sanitized = removeSpaces(value);
        updateDesignProperty('spacing', 'margin', sanitized || null);
      }
    }
  };
  
  const handleMarginTopChange = (value: string) => {
    setMarginTopInput(value);
    if (value === 'auto') {
      updateDesignProperty('spacing', 'marginTop', 'auto');
    } else {
      const sanitized = removeSpaces(value);
      updateDesignProperty('spacing', 'marginTop', sanitized || null);
    }
  };
  
  const handleMarginRightChange = (value: string) => {
    setMarginRightInput(value);
    if (value === 'auto') {
      updateDesignProperty('spacing', 'marginRight', 'auto');
    } else {
      const sanitized = removeSpaces(value);
      updateDesignProperty('spacing', 'marginRight', sanitized || null);
    }
  };
  
  const handleMarginBottomChange = (value: string) => {
    setMarginBottomInput(value);
    if (value === 'auto') {
      updateDesignProperty('spacing', 'marginBottom', 'auto');
    } else {
      const sanitized = removeSpaces(value);
      updateDesignProperty('spacing', 'marginBottom', sanitized || null);
    }
  };
  
  const handleMarginLeftChange = (value: string) => {
    setMarginLeftInput(value);
    if (value === 'auto') {
      updateDesignProperty('spacing', 'marginLeft', 'auto');
    } else {
      const sanitized = removeSpaces(value);
      updateDesignProperty('spacing', 'marginLeft', sanitized || null);
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
                  value={marginInput}
                  onChange={(e) => handleMarginChange(e.target.value)}
                  placeholder="16"
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
                    value={marginLeftInput}
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
                    value={marginTopInput}
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
                    value={marginRightInput}
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
                    value={marginBottomInput}
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
