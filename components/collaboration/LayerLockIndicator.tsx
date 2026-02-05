/**
 * Layer Lock Indicator Component
 * 
 * Shows a visual badge when a layer is locked by another user.
 * Uses the reusable CollaboratorBadge component and unified resource locks.
 */

import React from 'react';
import { useCollaborationPresenceStore, getResourceLockKey, RESOURCE_TYPES } from '../../stores/useCollaborationPresenceStore';
import { CollaboratorBadge } from './CollaboratorBadge';

interface LayerLockIndicatorProps {
  layerId: string;
  layerName?: string;
  className?: string;
  showOverlay?: boolean;
  showBorder?: boolean;
}

export const LayerLockIndicator: React.FC<LayerLockIndicatorProps> = ({
  layerId,
  className = '',
  showOverlay = true,
  showBorder = true,
}) => {
  // Get lock and user info from store (using unified resource locks)
  const lockKey = getResourceLockKey(RESOURCE_TYPES.LAYER, layerId);
  const lock = useCollaborationPresenceStore((state) => state.resourceLocks[lockKey]);
  const ownerUser = useCollaborationPresenceStore((state) => 
    lock ? state.users[lock.user_id] : null
  );

  // Use owner's color or default to a visible red
  const userColor = ownerUser?.color || '#ef4444';

  // Use span instead of div to allow nesting inside p, h1-h6, etc.
  return (
    <>
      {/* Semi-transparent overlay */}
      {showOverlay && (
        <span className="absolute inset-0 block bg-black/10 pointer-events-none z-40 rounded" />
      )}
      
      {/* Lock badge in corner */}
      <span className={`absolute top-1 right-1 z-50 block ${className}`}>
        <CollaboratorBadge
          collaborator={{
            userId: lock?.user_id || '',
            email: ownerUser?.email,
            color: ownerUser?.color,
          }}
          size="sm"
          tooltipPrefix="Editing by"
        />
      </span>
      
      {/* Colored border overlay */}
      {showBorder && (
        <span
          className="absolute inset-0 block pointer-events-none z-40 rounded"
          style={{ 
            boxShadow: `inset 0 0 0 2px ${userColor}`,
          }}
        />
      )}
    </>
  );
};

export default LayerLockIndicator;
