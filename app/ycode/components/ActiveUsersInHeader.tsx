'use client';

/**
 * Active Users in Header Component
 *
 * Compact version of active users display integrated into the header bar
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useCollaborationPresenceStore } from '../../../stores/useCollaborationPresenceStore';
import { getUserInitials, getUserStatus } from '../../../lib/collaboration-utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import type { CollaborationUser } from '../../../types';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface ActiveUsersInHeaderProps {
  className?: string;
  onUserClick?: (userId: string) => void;
}

export const ActiveUsersInHeader: React.FC<ActiveUsersInHeaderProps> = ({
  className = '',
  onUserClick
}) => {
  // Use targeted selectors to avoid re-renders on unrelated state changes
  const users = useCollaborationPresenceStore((state) => state.users);
  const currentUserId = useCollaborationPresenceStore((state) => state.currentUserId);
  const [isOpen, setIsOpen] = useState(false);

  // Close popover when clicking on canvas (iframe clicks don't bubble to parent)
  useEffect(() => {
    const handleCanvasClick = () => {
      setIsOpen(false);
    };

    window.addEventListener('canvasClick', handleCanvasClick);
    return () => {
      window.removeEventListener('canvasClick', handleCanvasClick);
    };
  }, []);

  // Memoize active users computation to avoid creating new arrays on every render
  const activeUsers = useMemo(() => {
    const now = Date.now();
    const ACTIVE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    return Object.values(users).filter(user =>
      user.last_active && (now - user.last_active) < ACTIVE_THRESHOLD
    );
  }, [users]);

  const displayUsers = useMemo(() => activeUsers.slice(0, 5), [activeUsers]);
  const hasMoreUsers = activeUsers.length > 5;

  const handleUserClick = useCallback((userId: string) => {
    if (onUserClick) {
      onUserClick(userId);
    }
    setIsOpen(false);
  }, [onUserClick]);

  const getStatusColor = useCallback((user: CollaborationUser) => {
    const status = getUserStatus(user);
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'idle':
        return 'bg-yellow-500';
      case 'away':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  }, []);

  const getStatusText = useCallback((user: CollaborationUser) => {
    const status = getUserStatus(user);
    switch (status) {
      case 'active':
        return 'Active';
      case 'idle':
        return 'Idle';
      case 'away':
        return 'Away';
      default:
        return 'Unknown';
    }
  }, []);

  if (activeUsers.length === 0) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className={`flex items-center gap-2 ${className}`}>
          {/* User avatars */}
          <div className="flex -space-x-3">
            {displayUsers.slice(0, 3).map((user, index) => (
              <div
                key={user.user_id || `user-${index}`}
                className="size-8 rounded-full bg-neutral-700 border-2 border-background flex items-center justify-center text-xs text-current/75 font-medium cursor-pointer"
                style={{ backgroundColor: user.color }}
              >
                {getUserInitials(user.email || '', user.display_name)}
              </div>
            ))}
            {hasMoreUsers && (
              <div className="size-8 rounded-full bg-neutral-700 border-2 border-background flex items-center justify-center text-xs text-current/75 font-medium cursor-pointer">
                +{activeUsers.length - 3}
              </div>
            )}
          </div>
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-80" align="end">
          <div className="max-h-64 overflow-y-auto flex flex-col gap-4">
            {activeUsers.map((user, index) => (
              <div
                key={user.user_id || `user-list-${index}`}
                className="flex items-center gap-3"
                onClick={() => handleUserClick(user.user_id)}
              >
                {/* Avatar with status */}
                <div className="relative">
                  <div
                    className="size-8 rounded-full bg-neutral-700 flex items-center justify-center text-xs text-current/75 font-medium"
                    style={{ backgroundColor: user.color }}
                  >
                    {getUserInitials(user.email || '', user.display_name)}
                  </div>
                  {/* Status indicator */}
                  <div className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-popover ${getStatusColor(user)}`} />
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">

                  <div className="flex items-center gap-2">
                    <Label>
                      {user.email || 'Unknown user'}
                    </Label>
                    {user.user_id === currentUserId && (
                      <span className="text-xs opacity-50">
                        You
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-current/60">
                    <span>{getStatusText(user)}</span>
                    {user.selected_layer_id && (
                      <span>Editing</span>
                    )}
                    {user.is_editing && (
                      <span>Typing...</span>
                    )}
                  </div>

                </div>
              </div>
            ))}
          </div>
      </PopoverContent>
    </Popover>
  );
};

export default ActiveUsersInHeader;
