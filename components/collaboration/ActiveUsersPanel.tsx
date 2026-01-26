/**
 * Active Users Panel Component
 * 
 * Displays list of collaborators currently on the page with their status and activity
 */

import React, { useState, useCallback } from 'react';
import { useCollaborationPresenceStore } from '../../stores/useCollaborationPresenceStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { getUserInitials, getDisplayName, getUserStatus } from '../../lib/collaboration-utils';
import type { CollaborationUser } from '../../types';

interface ActiveUsersPanelProps {
  className?: string;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  showUserCount?: boolean;
  maxUsers?: number;
  onUserClick?: (userId: string) => void;
}

export const ActiveUsersPanel: React.FC<ActiveUsersPanelProps> = ({
  className = '',
  position = 'top-right',
  showUserCount = true,
  maxUsers = 10,
  onUserClick
}) => {
  const { users, currentUserId, getActiveUsers } = useCollaborationPresenceStore();
  const { user: currentUser } = useAuthStore();
  const [isExpanded, setIsExpanded] = useState(false);
  
  const activeUsers = getActiveUsers();
  const displayUsers = activeUsers.slice(0, maxUsers);
  const hasMoreUsers = activeUsers.length > maxUsers;
  
  const getPositionClasses = useCallback(() => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4';
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      default:
        return 'top-4 right-4';
    }
  }, [position]);
  
  const handleUserClick = useCallback((userId: string) => {
    if (onUserClick) {
      onUserClick(userId);
    }
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
    <div className={`fixed ${getPositionClasses()} z-50 ${className}`}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-lg shadow-lg transition-colors"
      >
        <div className="flex -space-x-2">
          {displayUsers.slice(0, 3).map((user) => (
            <div
              key={user.user_id}
              className="w-8 h-8 rounded-full border-2 border-zinc-800 flex items-center justify-center text-xs font-medium"
              style={{ backgroundColor: user.color }}
            >
              {getUserInitials(user.email || '', user.display_name)}
            </div>
          ))}
          {hasMoreUsers && (
            <div className="w-8 h-8 rounded-full bg-zinc-600 border-2 border-zinc-800 flex items-center justify-center text-xs font-medium">
              +{activeUsers.length - 3}
            </div>
          )}
        </div>
        {showUserCount && (
          <span className="text-sm font-medium">
            {activeUsers.length} user{activeUsers.length !== 1 ? 's' : ''}
          </span>
        )}
        <svg
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      
      {/* Expanded Panel */}
      {isExpanded && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-zinc-800 rounded-lg shadow-xl border border-zinc-700 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-zinc-700">
            <h3 className="text-sm font-medium text-white">
              Active Collaborators
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {activeUsers.length} user{activeUsers.length !== 1 ? 's' : ''} online
            </p>
          </div>
          
          {/* User List */}
          <div className="max-h-64 overflow-y-auto">
            {displayUsers.map((user) => (
              <div
                key={user.user_id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-700 transition-colors cursor-pointer"
                onClick={() => handleUserClick(user.user_id)}
              >
                {/* Avatar */}
                <div className="relative">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white"
                    style={{ backgroundColor: user.color }}
                  >
                    {getUserInitials(user.email || '', user.display_name)}
                  </div>
                  {/* Status indicator */}
                  <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-zinc-800 ${getStatusColor(user)}`} />
                </div>
                
                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {user.display_name || getDisplayName(user.email || '')}
                    </span>
                    {user.user_id === currentUserId && (
                      <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs ${getStatusColor(user).replace('bg-', 'text-')}`}>
                      {getStatusText(user)}
                    </span>
                    {user.selected_layer_id && (
                      <span className="text-xs text-zinc-400">
                        Editing layer
                      </span>
                    )}
                    {user.is_editing && (
                      <span className="text-xs text-blue-400">
                        Typing...
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Cursor indicator */}
                {user.cursor && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                )}
              </div>
            ))}
            
            {hasMoreUsers && (
              <div className="px-4 py-3 text-center text-xs text-zinc-400 border-t border-zinc-700">
                +{activeUsers.length - maxUsers} more user{activeUsers.length - maxUsers !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActiveUsersPanel;
