'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useEditorStore } from '@/stores/useEditorStore';
import type { Layer } from '@/types';

interface EffectControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function EffectControls({ layer, onLayerUpdate }: EffectControlsProps) {
  const { activeBreakpoint, activeUIState } = useEditorStore();
  const { updateDesignProperty, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
  });
  
  // Get current values from layer (no inheritance - only exact breakpoint values)
  const opacity = getDesignProperty('effects', 'opacity') || '100';
  const boxShadow = getDesignProperty('effects', 'boxShadow') || '';
  
  // Extract numeric value (0-100)
  const extractOpacity = (prop: string): number => {
    if (!prop) return 100;
    const match = prop.match(/(\d+)/);
    return match ? parseInt(match[1]) : 100;
  };
  
  const opacityValue = extractOpacity(opacity);
  
  // Handle opacity change
  const handleOpacityChange = (value: string) => {
    const numValue = Math.max(0, Math.min(100, parseInt(value) || 0));
    updateDesignProperty('effects', 'opacity', `${numValue}`);
  };
  
  // Handle opacity slider change
  const handleOpacitySliderChange = (values: number[]) => {
    updateDesignProperty('effects', 'opacity', `${values[0]}`);
  };
  
  // Handle box shadow change
  const handleBoxShadowChange = (value: string) => {
    updateDesignProperty('effects', 'boxShadow', value || null);
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

          <div className="grid grid-cols-3">
              <Label variant="muted">Shadow</Label>
              <div className="col-span-2 *:w-full">
                  <Select value={boxShadow || 'none'} onValueChange={handleBoxShadowChange}>
                      <SelectTrigger>
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectGroup>
                              <SelectItem value="none">None</SelectItem>
                              <SelectItem value="sm">Small</SelectItem>
                              <SelectItem value="md">Medium</SelectItem>
                              <SelectItem value="lg">Large</SelectItem>
                              <SelectItem value="xl">Extra Large</SelectItem>
                              <SelectItem value="2xl">2X Large</SelectItem>
                              <SelectItem value="inner">Inner</SelectItem>
                          </SelectGroup>
                      </SelectContent>
                  </Select>
              </div>
          </div>

      </div>
    </div>
  );
}
