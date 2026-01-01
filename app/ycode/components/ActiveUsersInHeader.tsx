'use client';

/**
 * Active Users in Header Component
 * 
 * Compact version of active users display integrated into the header bar
 */

import React, { useState, useCallback } from 'react';
import { useCollaborationPresenceStore } from '../../../stores/useCollaborationPresenceStore';
import { useAuthStore } from '../../../stores/useAuthStore';
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
  const { users, currentUserId, getActiveUsers } = useCollaborationPresenceStore();
  const { user: currentUser } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  
  const activeUsers = getActiveUsers();
  const displayUsers = activeUsers.slice(0, 5); // Show up to 5 users in header
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
            {displayUsers.slice(0, 3).map((user) => (
              <div
                key={user.user_id}
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
            {activeUsers.map((user) => (
              <div
                key={user.user_id}
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
