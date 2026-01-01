/**
 * Activity Notifications Component
 * 
 * Displays toast notifications for collaboration activities
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useCollaborationPresenceStore } from '../../stores/useCollaborationPresenceStore';
import { formatTimeAgo } from '../../lib/collaboration-utils';
import type { ActivityNotification } from '../../types';

interface ActivityNotificationsProps {
  className?: string;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxNotifications?: number;
  autoHide?: boolean;
  hideDelay?: number;
}

// Icon components for different notification types
const UserIcon = ({ color }: { color: string }) => (
  <svg
    className={`w-4 h-4 ${color}`}
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
      clipRule="evenodd"
    />
  </svg>
);

const SettingsIcon = ({ color }: { color: string }) => (
  <svg
    className={`w-4 h-4 ${color}`}
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
      clipRule="evenodd"
    />
  </svg>
);

const CheckIcon = ({ color }: { color: string }) => (
  <svg
    className={`w-4 h-4 ${color}`}
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
      clipRule="evenodd"
    />
  </svg>
);

const ListIcon = ({ color }: { color: string }) => (
  <svg
    className={`w-4 h-4 ${color}`}
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
      clipRule="evenodd"
    />
  </svg>
);

const ClockIcon = ({ color }: { color: string }) => (
  <svg
    className={`w-4 h-4 ${color}`}
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
      clipRule="evenodd"
    />
  </svg>
);

const InfoIcon = ({ color }: { color: string }) => (
  <svg
    className={`w-4 h-4 ${color}`}
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
      clipRule="evenodd"
    />
  </svg>
);

const CloseIcon = () => (
  <svg
    className="w-4 h-4"
    fill="currentColor"
    viewBox="0 0 20 20"
  >
    <path
      fillRule="evenodd"
      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
      clipRule="evenodd"
    />
  </svg>
);

export const ActivityNotifications: React.FC<ActivityNotificationsProps> = ({
  className = '',
  position = 'bottom-right',
  maxNotifications = 5,
  autoHide = true,
  hideDelay = 5000
}) => {
  const { notifications, removeNotification } = useCollaborationPresenceStore();
  const [visibleNotifications, setVisibleNotifications] = useState<string[]>([]);
  
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
        return 'bottom-4 right-4';
    }
  }, [position]);
  
  const getNotificationIcon = useCallback((type: ActivityNotification['type']) => {
    switch (type) {
      case 'user_joined':
        return <UserIcon color="text-green-500" />;
      case 'user_left':
        return <UserIcon color="text-red-500" />;
      case 'layer_edit_started':
        return <SettingsIcon color="text-blue-500" />;
      case 'layer_edit_ended':
        return <CheckIcon color="text-green-500" />;
      case 'page_published':
        return <ListIcon color="text-purple-500" />;
      case 'user_idle':
        return <ClockIcon color="text-yellow-500" />;
      default:
        return <InfoIcon color="text-gray-500" />;
    }
  }, []);
  
  const getNotificationColor = useCallback((type: ActivityNotification['type']) => {
    switch (type) {
      case 'user_joined':
        return 'border-green-500 bg-green-500/10';
      case 'user_left':
        return 'border-red-500 bg-red-500/10';
      case 'layer_edit_started':
        return 'border-blue-500 bg-blue-500/10';
      case 'layer_edit_ended':
        return 'border-green-500 bg-green-500/10';
      case 'page_published':
        return 'border-purple-500 bg-purple-500/10';
      case 'user_idle':
        return 'border-yellow-500 bg-yellow-500/10';
      default:
        return 'border-gray-500 bg-gray-500/10';
    }
  }, []);
  
  const handleDismiss = useCallback((notificationId: string) => {
    removeNotification(notificationId);
    setVisibleNotifications(prev => prev.filter(id => id !== notificationId));
  }, [removeNotification]);
  
  // Auto-hide notifications
  useEffect(() => {
    if (!autoHide) return;
    
    const timeouts: NodeJS.Timeout[] = [];
    
    notifications.forEach(notification => {
      if (!visibleNotifications.includes(notification.id)) {
        setVisibleNotifications(prev => [...prev, notification.id]);
        
        const timeout = setTimeout(() => {
          handleDismiss(notification.id);
        }, hideDelay);
        
        timeouts.push(timeout);
      }
    });
    
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [notifications, autoHide, hideDelay, visibleNotifications, handleDismiss]);
  
  const displayNotifications = notifications
    .filter(notification => visibleNotifications.includes(notification.id))
    .slice(0, maxNotifications);
  
  if (displayNotifications.length === 0) {
    return null;
  }
  
  return (
    <div className={`fixed ${getPositionClasses()} z-50 space-y-2 ${className}`}>
      {displayNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`flex items-start gap-3 p-3 rounded-lg border shadow-lg backdrop-blur-sm transition-all duration-300 ${getNotificationColor(notification.type)}`}
        >
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {getNotificationIcon(notification.type)}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white">
              {notification.message}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {formatTimeAgo(notification.timestamp)}
            </div>
          </div>
          
          {/* Dismiss button */}
          <button
            onClick={() => handleDismiss(notification.id)}
            className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
          >
            <CloseIcon />
          </button>
        </div>
      ))}
    </div>
  );
};

export default ActivityNotifications;
