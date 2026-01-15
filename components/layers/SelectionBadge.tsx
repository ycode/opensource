import Icon from '@/components/ui/icon';
import { getLayerIcon, getLayerName } from '@/lib/layer-utils';
import type { Layer } from '@/types';

interface SelectionBadgeProps {
  /** Layer to display */
  layer: Layer;
  /** Optional description text (e.g., "0 items", "5 items", "Double-click to edit") */
  description?: string;
}

/**
 * Selection Badge Component
 * Displays layer icon, name, and optional description when a layer is selected
 */
export default function SelectionBadge({ layer, description }: SelectionBadgeProps) {
  return (
    <span className="absolute -top-[25px] -left-[3px] bg-blue-500 font-normal text-white text-xs px-3 py-1 rounded shadow-lg z-10 pointer-events-none flex items-center justify-center gap-1.5">
      <Icon name={getLayerIcon(layer)} className="size-3" />
      <span>{getLayerName(layer)}</span>
      {description && (
        <>
          <span className="opacity-75">•</span>
          <span className="opacity-75">{description}</span>
        </>
      )}
    </span>
  );
}
