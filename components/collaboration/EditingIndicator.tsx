/**
 * Editing Indicator Component
 * 
 * Shows visual indicators when users are actively editing text layers
 */

import React, { useMemo, useCallback } from 'react';
import { useCollaborationPresenceStore } from '../../stores/useCollaborationPresenceStore';
import { getDisplayName } from '../../lib/collaboration-utils';

interface EditingIndicatorProps {
  layerId: string;
  className?: string;
  showPulse?: boolean;
  showTypingText?: boolean;
  typingText?: string;
}

export const EditingIndicator: React.FC<EditingIndicatorProps> = ({
  layerId,
  className = '',
  showPulse = true,
  showTypingText = true,
  typingText = 'is typing...'
}) => {
  // Use targeted selector - only subscribe to users object
  const users = useCollaborationPresenceStore((state) => state.users);
  
  // Memoize the editing users computation to avoid creating new arrays on every render
  const editingUsers = useMemo(() => {
    return Object.values(users).filter(
      user => user.selected_layer_id === layerId && user.is_editing
    );
  }, [users, layerId]);
  
  const getEditingText = useCallback(() => {
    if (editingUsers.length === 0) return '';
    
    if (editingUsers.length === 1) {
      return `${getDisplayName(editingUsers[0].email || '')} ${typingText}`;
    }
    
    if (editingUsers.length === 2) {
      return `${getDisplayName(editingUsers[0].email || '')} and ${getDisplayName(editingUsers[1].email || '')} are typing`;
    }
    
    return `${editingUsers.length} people are typing`;
  }, [editingUsers, typingText]);
  
  if (editingUsers.length === 0) {
    return null;
  }
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* User avatars */}
      <div className="flex -space-x-1">
        {editingUsers.slice(0, 3).map((user, index) => (
          <div
            key={user.user_id || `editor-${index}`}
            className={`w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-xs font-medium text-white ${
              showPulse ? 'animate-pulse' : ''
            }`}
            style={{ backgroundColor: user.color }}
          >
            {getDisplayName(user.email || '').charAt(0).toUpperCase()}
          </div>
        ))}
        {editingUsers.length > 3 && (
          <div className="w-6 h-6 rounded-full bg-gray-600 border-2 border-white shadow-sm flex items-center justify-center text-xs font-medium text-white">
            +{editingUsers.length - 3}
          </div>
        )}
      </div>
      
      {/* Typing text */}
      {showTypingText && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {getEditingText()}
        </div>
      )}
      
      {/* Typing animation */}
      <div className="flex items-center gap-1">
        <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
};

export default EditingIndicator;
