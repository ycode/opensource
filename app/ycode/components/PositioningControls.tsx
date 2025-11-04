'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useControlledInputs } from '@/hooks/use-controlled-input';
import { useEditorStore } from '@/stores/useEditorStore';
import type { Layer } from '@/types';

interface PositioningControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function PositioningControls({ layer, onLayerUpdate }: PositioningControlsProps) {
  const { activeBreakpoint } = useEditorStore();
  const { updateDesignProperty, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint
  });
  
  const [positionUnit, setPositionUnit] = useState<'px' | 'rem' | 'em' | '%'>('px');
  
  // Extract numeric value from design property
  const extractValue = (prop: string): string => {
    if (!prop) return '';
    if (prop === 'auto') return 'auto';
    return prop.replace(/[a-z%]+$/i, '');
  };
  
  // Get current values from layer (with inheritance)
  const position = getDesignProperty('positioning', 'position') || 'static';
  const top = getDesignProperty('positioning', 'top') || '';
  const right = getDesignProperty('positioning', 'right') || '';
  const bottom = getDesignProperty('positioning', 'bottom') || '';
  const left = getDesignProperty('positioning', 'left') || '';
  const zIndex = getDesignProperty('positioning', 'zIndex') || '';
  
  const isPositioned = position !== 'static';
  
  // Local controlled inputs (prevents repopulation bug)
  const inputs = useControlledInputs({
    top,
    right,
    bottom,
    left,
    zIndex,
  }, extractValue);

  const [topInput, setTopInput] = inputs.top;
  const [rightInput, setRightInput] = inputs.right;
  const [bottomInput, setBottomInput] = inputs.bottom;
  const [leftInput, setLeftInput] = inputs.left;
  const [zIndexInput, setZIndexInput] = inputs.zIndex;
  
  // Handle position change
  const handlePositionChange = (value: string) => {
    updateDesignProperty('positioning', 'position', value === 'static' ? null : value);
  };
  
  // Handle top change
  const handleTopChange = (value: string) => {
    setTopInput(value);
    if (value === 'auto') {
      updateDesignProperty('positioning', 'top', 'auto');
    } else {
      updateDesignProperty('positioning', 'top', value ? `${value}${positionUnit}` : null);
    }
  };
  
  // Handle right change
  const handleRightChange = (value: string) => {
    setRightInput(value);
    if (value === 'auto') {
      updateDesignProperty('positioning', 'right', 'auto');
    } else {
      updateDesignProperty('positioning', 'right', value ? `${value}${positionUnit}` : null);
    }
  };
  
  // Handle bottom change
  const handleBottomChange = (value: string) => {
    setBottomInput(value);
    if (value === 'auto') {
      updateDesignProperty('positioning', 'bottom', 'auto');
    } else {
      updateDesignProperty('positioning', 'bottom', value ? `${value}${positionUnit}` : null);
    }
  };
  
  // Handle left change
  const handleLeftChange = (value: string) => {
    setLeftInput(value);
    if (value === 'auto') {
      updateDesignProperty('positioning', 'left', 'auto');
    } else {
      updateDesignProperty('positioning', 'left', value ? `${value}${positionUnit}` : null);
    }
  };
  
  // Handle z-index change
  const handleZIndexChange = (value: string) => {
    setZIndexInput(value);
    if (value === 'auto') {
      updateDesignProperty('positioning', 'zIndex', 'auto');
    } else {
      updateDesignProperty('positioning', 'zIndex', value || null);
    }
  };
  
  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Position</Label>
      </header>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3">
          <Label variant="muted">Type</Label>
          <div className="col-span-2 *:w-full">
            <Select value={position} onValueChange={handlePositionChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="static">Static</SelectItem>
                  <SelectItem value="relative">Relative</SelectItem>
                  <SelectItem value="absolute">Absolute</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="sticky">Sticky</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isPositioned && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label variant="muted" className="mb-2 block text-xs">Top</Label>
                <Input
                  value={topInput}
                  onChange={(e) => handleTopChange(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label variant="muted" className="mb-2 block text-xs">Right</Label>
                <Input
                  value={rightInput}
                  onChange={(e) => handleRightChange(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label variant="muted" className="mb-2 block text-xs">Bottom</Label>
                <Input
                  value={bottomInput}
                  onChange={(e) => handleBottomChange(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label variant="muted" className="mb-2 block text-xs">Left</Label>
                <Input
                  value={leftInput}
                  onChange={(e) => handleLeftChange(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-3">
              <Label variant="muted">Unit</Label>
              <div className="col-span-2 *:w-full">
                <Select value={positionUnit} onValueChange={(value) => setPositionUnit(value as 'px' | 'rem' | 'em' | '%')}>
                  <SelectTrigger>
                    <SelectValue />
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
              </div>
            </div>
          </>
        )}

        <div className="grid grid-cols-3">
          <Label variant="muted">Z-Index</Label>
          <div className="col-span-2 *:w-full">
            <Input
              type="text"
              value={zIndexInput}
              onChange={(e) => handleZIndexChange(e.target.value)}
              placeholder="auto"
            />
          </div>
        </div>
      </div>
    </div>
  );
}


