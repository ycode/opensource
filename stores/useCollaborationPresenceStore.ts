/**
 * Enhanced Collaboration Presence Store
 * 
 * Manages real-time collaboration state including users, locks, and notifications
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { 
  CollaborationUser, 
  LayerLock, 
  CollaborationState, 
  ActivityNotification 
} from '../types';
import { 
  generateUserColor, 
  getDisplayName, 
  isLayerLocked, 
  generateNotificationId,
  formatTimeAgo,
  getUserStatus,
  compressPresenceData,
  mergePresenceData
} from '../lib/collaboration-utils';

interface CollaborationPresenceState extends CollaborationState {
  notifications: ActivityNotification[];
  selectedUsers: string[]; // Users currently selected in UI
  
  // Actions
  setUsers: (users: Record<string, CollaborationUser>) => void;
  updateUser: (userId: string, updates: Partial<CollaborationUser>) => void;
  removeUser: (userId: string) => void;
  setLocks: (locks: Record<string, LayerLock>) => void;
  acquireLock: (layerId: string, userId: string) => void;
  releaseLock: (layerId: string) => void;
  setConnectionStatus: (connected: boolean) => void;
  setCurrentUser: (userId: string, email: string) => void;
  addNotification: (notification: Omit<ActivityNotification, 'id'>) => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;
  selectUser: (userId: string) => void;
  deselectUser: (userId: string) => void;
  clearSelection: () => void;
  
  // Computed getters
  getActiveUsers: () => CollaborationUser[];
  getUsersByLayer: (layerId: string) => CollaborationUser[];
  getLockedLayers: () => string[];
  getNotificationsByType: (type: ActivityNotification['type']) => ActivityNotification[];
  isUserOnline: (userId: string) => boolean;
  canEditLayer: (layerId: string, userId: string) => boolean;
}

export const useCollaborationPresenceStore = create<CollaborationPresenceState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    users: {},
    locks: {},
    isConnected: false,
    currentUserId: null,
    currentUserColor: '#3b82f6',
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
      const { [userId]: removedLock, ...remainingLocks } = state.locks;
      
      return {
        users: remainingUsers,
        locks: remainingLocks
      };
    }),
    
    setLocks: (locks) => set({ locks }),
    
    // Lock management
    acquireLock: (layerId, userId) => set((state) => {
      const lock: LayerLock = {
        layer_id: layerId,
        user_id: userId,
        acquired_at: Date.now(),
        expires_at: Date.now() + 30000 // 30 seconds
      };
      
      const newLocks = {
        ...state.locks,
        [layerId]: lock
      };
      
      return {
        locks: newLocks
      };
    }),
    
    releaseLock: (layerId) => set((state) => {
      const { [layerId]: removed, ...remainingLocks } = state.locks;
      return { locks: remainingLocks };
    }),
    
    setConnectionStatus: (connected) => set({ isConnected: connected }),
    
    setCurrentUser: (userId, email) => set({
      currentUserId: userId,
      currentUserColor: generateUserColor(userId)
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
    
    getLockedLayers: () => {
      const { locks } = get();
      return Object.keys(locks);
    },
    
    getNotificationsByType: (type) => {
      const { notifications } = get();
      return notifications.filter(n => n.type === type);
    },
    
    isUserOnline: (userId) => {
      const { users } = get();
      return userId in users;
    },
    
    canEditLayer: (layerId, userId) => {
      const { locks, currentUserId } = get();
      const lockInfo = isLayerLocked(layerId, locks, userId);
      return !lockInfo.isLocked;
    }
  }))
);

// Subscribe to lock expiration
let lockCheckInterval: NodeJS.Timeout | null = null;

export const startLockExpirationCheck = () => {
  if (lockCheckInterval) return;
  
  lockCheckInterval = setInterval(() => {
    const { locks, releaseLock } = useCollaborationPresenceStore.getState();
    const now = Date.now();
    
    Object.entries(locks).forEach(([layerId, lock]) => {
      if (now > lock.expires_at) {
        releaseLock(layerId);
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
