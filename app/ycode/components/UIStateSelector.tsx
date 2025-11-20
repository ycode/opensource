'use client';

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEditorStore } from '@/stores/useEditorStore';
import type { UIState, Layer } from '@/types';

interface UIStateSelectorProps {
  selectedLayer: Layer | null;
}

export default function UIStateSelector({ selectedLayer }: UIStateSelectorProps) {
  const { activeUIState, setActiveUIState } = useEditorStore();

  // Determine which states are applicable for the current layer
  const isDisabledApplicable = () => {
    if (!selectedLayer) return false;
    const applicableTypes = ['button', 'input', 'textarea', 'select'];
    return applicableTypes.includes(selectedLayer.type || '') ||
           applicableTypes.includes(selectedLayer.name || '');
  };

  const isCurrentApplicable = () => {
    if (!selectedLayer) return false;
    const applicableTypes = ['link', 'a', 'navigation'];
    return applicableTypes.includes(selectedLayer.type || '') ||
           applicableTypes.includes(selectedLayer.name || '');
  };

  return (
    <div className="py-4">
      <Select value={activeUIState} onValueChange={(value) => setActiveUIState(value as UIState)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select state" />
        </SelectTrigger>
        <SelectContent>
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
