'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useEditorStore } from '@/stores/useEditorStore';
import { removeSpaces } from '@/lib/utils';
import type { Layer } from '@/types';
import ColorPicker from './ColorPicker';

interface BackgroundsControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function BackgroundsControls({ layer, onLayerUpdate }: BackgroundsControlsProps) {
  const { activeBreakpoint, activeUIState } = useEditorStore();
  const { updateDesignProperty, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
  });
  
  // Get current values from layer (no inheritance - only exact breakpoint values)
  const backgroundColor = getDesignProperty('backgrounds', 'backgroundColor') || '';
  const backgroundImage = getDesignProperty('backgrounds', 'backgroundImage') || '';
  const backgroundSize = getDesignProperty('backgrounds', 'backgroundSize') || 'cover';
  const backgroundPosition = getDesignProperty('backgrounds', 'backgroundPosition') || 'center';
  const backgroundRepeat = getDesignProperty('backgrounds', 'backgroundRepeat') || 'no-repeat';
  
  // Handle background color change
  const handleBackgroundColorChange = (value: string) => {
    const sanitized = removeSpaces(value);
    updateDesignProperty('backgrounds', 'backgroundColor', sanitized || null);
  };
  
  // Handle background image change
  const handleBackgroundImageChange = (value: string) => {
    const sanitized = removeSpaces(value);
    if (sanitized && !sanitized.startsWith('url(')) {
      value = `url(${sanitized})`;
    } else {
      value = sanitized;
    }
    updateDesignProperty('backgrounds', 'backgroundImage', value || null);
  };
  
  // Handle background size change
  const handleBackgroundSizeChange = (value: string) => {
    updateDesignProperty('backgrounds', 'backgroundSize', value);
  };
  
  // Handle background position change
  const handleBackgroundPositionChange = (value: string) => {
    updateDesignProperty('backgrounds', 'backgroundPosition', value);
  };
  
  // Handle background repeat change
  const handleBackgroundRepeatChange = (value: string) => {
    updateDesignProperty('backgrounds', 'backgroundRepeat', value);
  };
  
  // Extract URL from background image
  const extractImageUrl = (prop: string): string => {
    if (!prop) return '';
    if (prop.startsWith('url(')) {
      return prop.slice(4, -1).replace(/['"]/g, '');
    }
    return prop;
  };
  
  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Backgrounds</Label>
      </header>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3">
          <Label variant="muted">Color</Label>
          <div className="col-span-2 *:w-full">
            <ColorPicker
              value={backgroundColor}
              onChange={handleBackgroundColorChange}
              defaultValue="#ffffff"
            />
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Image</Label>
          <div className="col-span-2 *:w-full">
            <Input
              type="text"
              value={extractImageUrl(backgroundImage)}
              onChange={(e) => handleBackgroundImageChange(e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
          </div>
        </div>

        {backgroundImage && (
          <>
            <div className="grid grid-cols-3">
              <Label variant="muted">Size</Label>
              <div className="col-span-2 *:w-full">
                <Select value={backgroundSize} onValueChange={handleBackgroundSizeChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="cover">Cover</SelectItem>
                      <SelectItem value="contain">Contain</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3">
              <Label variant="muted">Position</Label>
              <div className="col-span-2 *:w-full">
                <Select value={backgroundPosition} onValueChange={handleBackgroundPositionChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="top">Top</SelectItem>
                      <SelectItem value="bottom">Bottom</SelectItem>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="right">Right</SelectItem>
                      <SelectItem value="left-top">Left Top</SelectItem>
                      <SelectItem value="left-bottom">Left Bottom</SelectItem>
                      <SelectItem value="right-top">Right Top</SelectItem>
                      <SelectItem value="right-bottom">Right Bottom</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3">
              <Label variant="muted">Repeat</Label>
              <div className="col-span-2 *:w-full">
                <Select value={backgroundRepeat} onValueChange={handleBackgroundRepeatChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="no-repeat">No Repeat</SelectItem>
                      <SelectItem value="repeat">Repeat</SelectItem>
                      <SelectItem value="repeat-x">Repeat X</SelectItem>
                      <SelectItem value="repeat-y">Repeat Y</SelectItem>
                      <SelectItem value="repeat-round">Repeat Round</SelectItem>
                      <SelectItem value="repeat-space">Repeat Space</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
