'use client';

import { Label } from '@/components/ui/label';
import { useDesignSync } from '@/hooks/use-design-sync';
import { useEditorStore } from '@/stores/useEditorStore';
import { removeSpaces } from '@/lib/utils';
import type { Layer } from '@/types';
import ColorPicker from './ColorPicker';

interface BackgroundsControlsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
  activeTextStyleKey?: string | null;
}

export default function BackgroundsControls({ layer, onLayerUpdate, activeTextStyleKey }: BackgroundsControlsProps) {
  const { activeBreakpoint, activeUIState } = useEditorStore();
  const { updateDesignProperty, debouncedUpdateDesignProperty, getDesignProperty } = useDesignSync({
    layer,
    onLayerUpdate,
    activeBreakpoint,
    activeUIState,
    activeTextStyleKey,
  });

  // Get current values from layer (no inheritance - only exact breakpoint values)
  const backgroundColor = getDesignProperty('backgrounds', 'backgroundColor') || '';
  const backgroundImage = getDesignProperty('backgrounds', 'backgroundImage') || '';
  const backgroundSize = getDesignProperty('backgrounds', 'backgroundSize') || 'cover';
  const backgroundPosition = getDesignProperty('backgrounds', 'backgroundPosition') || 'center';
  const backgroundRepeat = getDesignProperty('backgrounds', 'backgroundRepeat') || 'no-repeat';

  // Handle background color change (debounced for text/color input)
  const handleBackgroundColorChange = (value: string) => {
    const sanitized = removeSpaces(value);
    debouncedUpdateDesignProperty('backgrounds', 'backgroundColor', sanitized || null);
  };

  // Handle background image change
  // Use immediate update for file uploads (data URLs), debounced for manual URL typing
  const handleBackgroundImageChange = (value: string, immediate = false) => {
    let processedValue = value;
    
    // Don't sanitize data URLs (they can be very long base64 strings)
    const isDataUrl = value.startsWith('data:') || value.startsWith('url(data:');
    
    if (!isDataUrl) {
      // Only sanitize regular URLs
      const sanitized = removeSpaces(value);
      processedValue = sanitized;
      if (sanitized && !sanitized.startsWith('url(')) {
        processedValue = `url(${sanitized})`;
      }
    } else {
      // For data URLs, just ensure url() wrapper
      if (!value.startsWith('url(')) {
        processedValue = `url(${value})`;
      }
    }
    
    // Use immediate update for uploaded images, debounced for typed URLs
    if (immediate || isDataUrl) {
      updateDesignProperty('backgrounds', 'backgroundImage', processedValue || null);
    } else {
      debouncedUpdateDesignProperty('backgrounds', 'backgroundImage', processedValue || null);
    }
  };

  // Handle background size change (immediate - dropdown selection)
  const handleBackgroundSizeChange = (value: string) => {
    updateDesignProperty('backgrounds', 'backgroundSize', value);
  };

  // Handle background position change (immediate - dropdown selection)
  const handleBackgroundPositionChange = (value: string) => {
    updateDesignProperty('backgrounds', 'backgroundPosition', value);
  };

  // Handle background repeat change (immediate - dropdown selection)
  const handleBackgroundRepeatChange = (value: string) => {
    updateDesignProperty('backgrounds', 'backgroundRepeat', value);
  };

  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Backgrounds</Label>
      </header>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3">
          <Label variant="muted">Fill</Label>
          <div className="col-span-2 *:w-full">
            <ColorPicker
              value={backgroundColor}
              onChange={handleBackgroundColorChange}
              defaultValue="#ffffff"
              backgroundImageProps={{
                backgroundImage,
                backgroundSize,
                backgroundPosition,
                backgroundRepeat,
                onBackgroundImageChange: handleBackgroundImageChange,
                onBackgroundSizeChange: handleBackgroundSizeChange,
                onBackgroundPositionChange: handleBackgroundPositionChange,
                onBackgroundRepeatChange: handleBackgroundRepeatChange,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
