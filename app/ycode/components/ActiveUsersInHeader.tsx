'use client';

/**
 * Active Users in Header Component
 * 
 * Compact version of active users display integrated into the header bar
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useCollaborationPresenceStore } from '../../../stores/useCollaborationPresenceStore';
import { getUserInitials, getDisplayName, getUserStatus } from '../../../lib/collaboration-utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import type { CollaborationUser } from '../../../types';

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
        <Button
          variant="secondary"
          size="sm"
          className={`flex items-center gap-2 ${className}`}
        >
          {/* User avatars */}
          <div className="flex -space-x-1">
            {displayUsers.slice(0, 3).map((user, index) => (
              <div
                key={user.user_id || `user-${index}`}
                className="w-6 h-6 rounded-full border-2 border-neutral-950 flex items-center justify-center text-xs font-medium"
                style={{ backgroundColor: user.color }}
              >
                {getUserInitials(user.email || '', user.display_name)}
              </div>
            ))}
            {hasMoreUsers && (
              <div className="w-6 h-6 rounded-full bg-neutral-600 border-2 border-neutral-950 flex items-center justify-center text-xs font-medium">
                +{activeUsers.length - 3}
              </div>
            )}
          </div>
          
          {/* User count */}
          <span className="text-xs text-white/70">
            {activeUsers.length}
          </span>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          {/* Header */}
          <div>
            <h3 className="text-sm font-medium text-white">
              Active Collaborators
            </h3>
            <p className="text-xs text-white/60 mt-1">
              {activeUsers.length} user{activeUsers.length !== 1 ? 's' : ''} online
            </p>
          </div>
          
          {/* User List */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {activeUsers.map((user, index) => (
              <div
                key={user.user_id || `user-list-${index}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
                onClick={() => handleUserClick(user.user_id)}
              >
                {/* Avatar with status */}
                <div className="relative">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white"
                    style={{ backgroundColor: user.color }}
                  >
                    {getUserInitials(user.email || '', user.display_name)}
                  </div>
                  {/* Status indicator */}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-neutral-900 ${getStatusColor(user)}`} />
                </div>
                
                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {getDisplayName(user.email || '')}
                    </span>
                    {user.user_id === currentUserId && (
                      <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs ${getStatusColor(user).replace('bg-', 'text-')}`}>
                      {getStatusText(user)}
                    </span>
                    {user.selected_layer_id && (
                      <span className="text-xs text-white/60">
                        Editing
                      </span>
                    )}
                    {user.is_editing && (
                      <span className="text-xs text-blue-400">
                        Typing...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ActiveUsersInHeader;
