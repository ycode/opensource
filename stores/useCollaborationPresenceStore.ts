/**
 * Enhanced Collaboration Presence Store
 * 
 * Manages real-time collaboration state including users, locks, and notifications.
 * Uses a unified resource locking system for all lockable resources (layers, collection items, etc.)
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { 
  CollaborationUser, 
  CollaborationState, 
  ActivityNotification 
} from '../types';
import { 
  generateUserColor, 
  generateNotificationId,
  getUserStatus,
} from '../lib/collaboration-utils';

// Generic resource lock - used for all lockable resources (layers, collection items, etc.)
export interface ResourceLock {
  resource_type: string; // 'layer' | 'collection_item' | etc.
  resource_id: string;
  user_id: string;
  acquired_at: number;
  expires_at: number;
}

// Helper to create a resource lock key
export const getResourceLockKey = (type: string, id: string) => `${type}:${id}`;

// Resource type constants
export const RESOURCE_TYPES = {
  LAYER: 'layer',
  COLLECTION_ITEM: 'collection_item',
} as const;

interface CollaborationPresenceState extends Omit<CollaborationState, 'locks'> {
  notifications: ActivityNotification[];
  selectedUsers: string[]; // Users currently selected in UI
  resourceLocks: Record<string, ResourceLock>; // Unified resource locks (key = "type:id")
  
  // Actions
  setUsers: (users: Record<string, CollaborationUser>) => void;
  updateUser: (userId: string, updates: Partial<CollaborationUser>) => void;
  removeUser: (userId: string) => void;
  setConnectionStatus: (connected: boolean) => void;
  setCurrentUser: (userId: string, email: string, avatarUrl?: string | null) => void;
  addNotification: (notification: Omit<ActivityNotification, 'id'>) => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;
  selectUser: (userId: string) => void;
  deselectUser: (userId: string) => void;
  clearSelection: () => void;
  
  // Unified resource lock actions
  acquireResourceLock: (type: string, resourceId: string, userId: string) => void;
  releaseResourceLock: (type: string, resourceId: string) => void;
  releaseAllUserLocks: (userId: string) => void;
  getResourceLock: (type: string, resourceId: string) => ResourceLock | null;
  isResourceLockedByOther: (type: string, resourceId: string, currentUserId: string) => boolean;
  
  // Computed getters
  getActiveUsers: () => CollaborationUser[];
  getUsersByLayer: (layerId: string) => CollaborationUser[];
  getLockedResources: (type: string) => string[];
  getNotificationsByType: (type: ActivityNotification['type']) => ActivityNotification[];
  isUserOnline: (userId: string) => boolean;
  canEditResource: (type: string, resourceId: string, userId: string) => boolean;
}

export const useCollaborationPresenceStore = create<CollaborationPresenceState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    users: {},
    resourceLocks: {},
    isConnected: false,
    currentUserId: null,
    currentUserColor: '#3b82f6',
    currentUserAvatarUrl: null,
    notifications: [],
    selectedUsers: [],
    
    // Basic state setters
    setUsers: (users) => set({ users }),
    
    updateUser: (userId, updates) => set((state) => ({
      users: {
        ...state.users,
        [userId]: { ...state.users[userId], ...updates }
      }
    })),
    
    removeUser: (userId) => set((state) => {
      const { [userId]: removed, ...remainingUsers } = state.users;
      
      // Note: We intentionally do NOT remove locks here.
      // Locks should only be removed by:
      // 1. Explicit releaseLock broadcast (when user switches layers or closes tab)
      // 2. Lock expiration (1 hour safety fallback)
      // This prevents transient presence leave events from clearing valid locks.
      
      return {
        users: remainingUsers
      };
    }),
    
    // Unified resource lock management
    acquireResourceLock: (type, resourceId, userId) => set((state) => {
      const key = getResourceLockKey(type, resourceId);
      const lock: ResourceLock = {
        resource_type: type,
        resource_id: resourceId,
        user_id: userId,
        acquired_at: Date.now(),
        expires_at: Date.now() + 3600000 // 1 hour safety fallback
      };
      
      return {
        resourceLocks: {
          ...state.resourceLocks,
          [key]: lock
        }
      };
    }),
    
    releaseResourceLock: (type, resourceId) => set((state) => {
      const key = getResourceLockKey(type, resourceId);
      const { [key]: removed, ...remainingLocks } = state.resourceLocks;
      return { resourceLocks: remainingLocks };
    }),
    
    releaseAllUserLocks: (userId) => set((state) => {
      const remainingLocks: Record<string, ResourceLock> = {};
      Object.entries(state.resourceLocks).forEach(([key, lock]) => {
        if (lock.user_id !== userId) {
          remainingLocks[key] = lock;
        }
      });
      return { resourceLocks: remainingLocks };
    }),
    
    getResourceLock: (type, resourceId) => {
      const key = getResourceLockKey(type, resourceId);
      const { resourceLocks } = get();
      const lock = resourceLocks[key];
      if (!lock || Date.now() > lock.expires_at) return null;
      return lock;
    },
    
    isResourceLockedByOther: (type, resourceId, currentUserId) => {
      const key = getResourceLockKey(type, resourceId);
      const { resourceLocks } = get();
      const lock = resourceLocks[key];
      if (!lock) return false;
      if (Date.now() > lock.expires_at) return false;
      return lock.user_id !== currentUserId;
    },
    
    setConnectionStatus: (connected) => set({ isConnected: connected }),
    
    setCurrentUser: (userId, email, avatarUrl) => set({
      currentUserId: userId,
      currentUserColor: generateUserColor(userId),
      currentUserAvatarUrl: avatarUrl || null
    }),
    
    // Notification management
    addNotification: (notification) => set((state) => ({
      notifications: [
        ...state.notifications,
        {
          ...notification,
          id: generateNotificationId()
        }
      ]
    })),
    
    removeNotification: (notificationId) => set((state) => ({
      notifications: state.notifications.filter(n => n.id !== notificationId)
    })),
    
    clearNotifications: () => set({ notifications: [] }),
    
    // User selection
    selectUser: (userId) => set((state) => ({
      selectedUsers: [...state.selectedUsers, userId]
    })),
    
    deselectUser: (userId) => set((state) => ({
      selectedUsers: state.selectedUsers.filter(id => id !== userId)
    })),
    
    clearSelection: () => set({ selectedUsers: [] }),
    
    // Computed getters
    getActiveUsers: () => {
      const { users } = get();
      return Object.values(users).filter(user => 
        getUserStatus(user) === 'active'
      );
    },
    
    getUsersByLayer: (layerId) => {
      const { users } = get();
      return Object.values(users).filter(user => 
        user.selected_layer_id === layerId
      );
    },
    
    getLockedResources: (type) => {
      const { resourceLocks } = get();
      const prefix = `${type}:`;
      return Object.entries(resourceLocks)
        .filter(([key, lock]) => 
          key.startsWith(prefix) && Date.now() <= lock.expires_at
        )
        .map(([key]) => key.replace(prefix, ''));
    },
    
    getNotificationsByType: (type) => {
      const { notifications } = get();
      return notifications.filter(n => n.type === type);
    },
    
    isUserOnline: (userId) => {
      const { users } = get();
      return userId in users;
    },
    
    canEditResource: (type, resourceId, userId) => {
      const { resourceLocks } = get();
      const key = getResourceLockKey(type, resourceId);
      const lock = resourceLocks[key];
      if (!lock) return true;
      if (Date.now() > lock.expires_at) return true;
      return lock.user_id === userId;
    }
  }))
);

// Subscribe to lock expiration
let lockCheckInterval: NodeJS.Timeout | null = null;

export const startLockExpirationCheck = () => {
  if (lockCheckInterval) return;
  
  lockCheckInterval = setInterval(() => {
    const { resourceLocks, releaseResourceLock } = useCollaborationPresenceStore.getState();
    const now = Date.now();
    
    // Check all resource locks for expiration
    Object.entries(resourceLocks).forEach(([key, lock]) => {
      if (now > lock.expires_at) {
        releaseResourceLock(lock.resource_type, lock.resource_id);
      }
    });
  }, 1000); // Check every second
};

export const stopLockExpirationCheck = () => {
  if (lockCheckInterval) {
    clearInterval(lockCheckInterval);
    lockCheckInterval = null;
  }
};

// Auto-cleanup notifications after 30 seconds
export const startNotificationCleanup = () => {
  setInterval(() => {
    const { notifications, removeNotification } = useCollaborationPresenceStore.getState();
    const now = Date.now();
    const maxAge = 30000; // 30 seconds
    
    notifications.forEach(notification => {
      if (now - notification.timestamp > maxAge) {
        removeNotification(notification.id);
      }
    });
  }, 5000); // Check every 5 seconds
};
