/**
 * ResourceLockOverlay Component
 * 
 * Shows an overlay with collaborator badge when a resource is locked by another user.
 * Reusable for layers, collection items, and other lockable resources.
 */

import React from 'react';
import { useCollaborationPresenceStore, getResourceLockKey } from '@/stores/useCollaborationPresenceStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { CollaboratorBadge } from './CollaboratorBadge';
import { cn } from '@/lib/utils';

interface ResourceLockOverlayProps {
  resourceType: string;
  resourceId: string;
  className?: string;
  overlayClassName?: string;
  badgePosition?: 'top-right' | 'top-left' | 'center';
  showOverlay?: boolean;
  tooltipPrefix?: string;
}

export function ResourceLockOverlay({
  resourceType,
  resourceId,
  className,
  overlayClassName,
  badgePosition = 'top-right',
  showOverlay = true,
  tooltipPrefix = 'Editing by',
}: ResourceLockOverlayProps) {
  const currentUserId = useAuthStore((state) => state.user?.id);
  
  // Get lock info
  const lockKey = getResourceLockKey(resourceType, resourceId);
  const lock = useCollaborationPresenceStore((state) => state.resourceLocks[lockKey]);
  const lockOwner = useCollaborationPresenceStore((state) => 
    lock ? state.users[lock.user_id] : null
  );
  
  // Check if locked by another user
  const isLockedByOther = lock && 
    lock.user_id !== currentUserId && 
    Date.now() <= lock.expires_at;
  
  if (!isLockedByOther) {
    return null;
  }

  const positionClasses = {
    'top-right': 'top-1 right-1',
    'top-left': 'top-1 left-1',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  };

  return (
    <div className={cn('absolute inset-0 pointer-events-none z-40', className)}>
      {/* Semi-transparent overlay */}
      {showOverlay && (
        <div className={cn('absolute inset-0 bg-black/10 rounded', overlayClassName)} />
      )}
      
      {/* Collaborator badge */}
      <div className={cn('absolute z-50 pointer-events-auto', positionClasses[badgePosition])}>
        <CollaboratorBadge
          collaborator={{
            userId: lock.user_id,
            email: lockOwner?.email,
            color: lockOwner?.color,
          }}
          size="sm"
          tooltipPrefix={tooltipPrefix}
        />
      </div>
    </div>
  );
}

export default ResourceLockOverlay;
