/**
 * Layer Lock Indicator Component
 * 
 * Shows visual indicators when a layer is locked by another user
 */

import React, { useCallback } from 'react';
import { useCollaborationPresenceStore } from '../../stores/useCollaborationPresenceStore';
import { useLayerLocks } from '../../hooks/use-layer-locks';
import { getDisplayName, getUserInitials } from '../../lib/collaboration-utils';
import type { Layer } from '../../types';

interface LayerLockIndicatorProps {
  layerId: string;
  layerName?: string;
  className?: string;
  showTooltip?: boolean;
  onRequestUnlock?: (layerId: string) => void;
}

export const LayerLockIndicator: React.FC<LayerLockIndicatorProps> = ({
  layerId,
  layerName,
  className = '',
  showTooltip = true,
  onRequestUnlock
}) => {
  const { users, locks } = useCollaborationPresenceStore();
  const { isLayerLocked, getLockOwner, requestLockRelease } = useLayerLocks();
  
  const isLocked = isLayerLocked(layerId);
  const lockOwner = getLockOwner(layerId);
  const ownerUser = lockOwner ? users[lockOwner] : null;
  
  const handleRequestUnlock = useCallback(() => {
    if (onRequestUnlock) {
      onRequestUnlock(layerId);
    } else {
      requestLockRelease(layerId);
    }
  }, [layerId, onRequestUnlock, requestLockRelease]);
  
  if (!isLocked || !ownerUser) {
    return null;
  }
  
  return (
    <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none z-50">
      <div className="flex flex-col items-center gap-2">
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg border-2 border-white/30"
          style={{ backgroundColor: ownerUser?.color || '#666' }}
        >
          {getUserInitials(ownerUser?.email || '')}
        </div>
        <div className="text-xs text-white bg-zinc-900/80 px-2 py-1 rounded backdrop-blur-sm">
          Locked by {getDisplayName(ownerUser?.email || '')}
        </div>
      </div>
    </div>
  );
};

export default LayerLockIndicator;
