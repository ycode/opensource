'use client';

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEditorStore } from '@/stores/useEditorStore';
import type { UIState, Layer } from '@/types';
import { DEFAULT_TEXT_STYLES, getTextStyleLabel } from '@/lib/text-format-utils';

interface UIStateSelectorProps {
  selectedLayer: Layer | null;
}

export default function UIStateSelector({ selectedLayer }: UIStateSelectorProps) {
  const { activeUIState, setActiveUIState, activeTextStyleKey, setActiveTextStyleKey } = useEditorStore();

  // Determine which states are applicable for the current layer
  const isDisabledApplicable = () => {
    if (!selectedLayer) return false;
    const applicableTypes = ['button', 'input', 'textarea', 'select'];
    return applicableTypes.includes(selectedLayer.name || '');
  };

  const isCurrentApplicable = () => {
    if (!selectedLayer) return false;
    const applicableTypes = ['link', 'a', 'navigation'];
    return applicableTypes.includes(selectedLayer.name || '');
  };

  const isTextLayer = selectedLayer?.name === 'text';

  return (
    <div className="sticky -top-2 bg-background z-10 py-4 flex flex-row gap-2">
      {/* Text Style Selector - show for text layers with textStyles, placed first */}
      {isTextLayer && (
        <Select
          value={activeTextStyleKey || 'default'}
          onValueChange={(value) => setActiveTextStyleKey(value === 'default' ? null : value)}
        >
          <SelectTrigger className="w-1/2">
            <SelectValue placeholder="Select style" />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              <SelectItem value="default">Default style</SelectItem>
            </SelectGroup>
            <SelectGroup>
              {Object.entries({ ...DEFAULT_TEXT_STYLES, ...selectedLayer?.textStyles }).map(([key, style]) => (
                <SelectItem key={key} value={key}>
                  {getTextStyleLabel(key, style)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}

      <Select value={activeUIState} onValueChange={(value) => setActiveUIState(value as UIState)}>
        <SelectTrigger className={isTextLayer ? 'w-1/2' : 'w-full'}>
          <SelectValue placeholder="Select state" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            <SelectItem value="neutral">Neutral</SelectItem>
            <SelectItem value="hover">Hover</SelectItem>
            <SelectItem value="focus">Focus</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled" disabled={!isDisabledApplicable()}>
              Disabled
            </SelectItem>
            <SelectItem value="current" disabled={!isCurrentApplicable()}>
              Current
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
