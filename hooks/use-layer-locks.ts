/**
 * Layer Locking Hook
 * 
 * Manages layer locks for conflict prevention in real-time collaboration
 */

import { useCallback, useEffect, useRef } from 'react';
import { useCollaborationPresenceStore } from '../stores/useCollaborationPresenceStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useEditorStore } from '../stores/useEditorStore';
import { createClient } from '../lib/supabase/client';
import type { LayerLock } from '../types';

interface UseLayerLocksReturn {
  acquireLock: (layerId: string) => Promise<boolean>;
  releaseLock: (layerId: string) => Promise<void>;
  isLayerLocked: (layerId: string) => boolean;
  getLockOwner: (layerId: string) => string | null;
  canEditLayer: (layerId: string) => boolean;
  requestLockRelease: (layerId: string) => void;
  isLockExpired: (layerId: string) => boolean;
}

export function useLayerLocks(): UseLayerLocksReturn {
  const { user } = useAuthStore();
  const { selectedLayerId, setSelectedLayerId, currentPageId } = useEditorStore();
  const {
    locks,
    currentUserId,
    acquireLock: storeAcquireLock,
    releaseLock: storeReleaseLock,
    canEditLayer,
    updateUser
  } = useCollaborationPresenceStore();
  
  const lockTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const lastActivity = useRef<number>(Date.now());
  const channelRef = useRef<any>(null);
  
  // Note: Layer selection and deselection is handled by the main editor
  // This hook only provides the locking functionality
  
  // Update activity timestamp (throttled to prevent excessive updates)
  useEffect(() => {
    if (!currentUserId) return;
    
    let timeoutId: NodeJS.Timeout;
    const updateActivity = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lastActivity.current = Date.now();
        updateUser(currentUserId, { last_active: Date.now() });
      }, 1000); // Throttle to once per second
    };
    
    // Update activity on mouse move, key press, etc.
    document.addEventListener('mousemove', updateActivity);
    document.addEventListener('keydown', updateActivity);
    document.addEventListener('click', updateActivity);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousemove', updateActivity);
      document.removeEventListener('keydown', updateActivity);
      document.removeEventListener('click', updateActivity);
    };
  }, [currentUserId, updateUser]);
  
  // Initialize Supabase channel for lock broadcasting
  useEffect(() => {
    if (!currentPageId || !user) return;
    
    const initializeChannel = async () => {
      try {
        const supabase = await createClient();
        const channel = supabase.channel(`page:${currentPageId}:locks`);
        
        // Listen for lock changes from other users
        channel.on('broadcast', { event: 'lock_acquired' }, (payload) => {
          const { layerId, userId, timestamp } = payload.payload;
          console.log(`[DEBUG] Received lock_acquired event for layer ${layerId} from user ${userId}`);
          if (userId !== currentUserId) {
            // Update local lock state
            storeAcquireLock(layerId, userId);
            console.log(`[DEBUG] Applied remote lock for layer ${layerId}`);
          }
        });
        
        channel.on('broadcast', { event: 'lock_released' }, (payload) => {
          const { layerId, userId } = payload.payload;
          console.log(`[DEBUG] Received lock_released event for layer ${layerId} from user ${userId}`);
          if (userId !== currentUserId) {
            // Update local lock state
            storeReleaseLock(layerId);
            console.log(`[DEBUG] Released remote lock for layer ${layerId}`);
          }
        });
        
        // Handle lock synchronization requests
        channel.on('broadcast', { event: 'request_locks' }, (payload) => {
          // Respond with my current locks using fresh state
          if (currentUserId) {
            const currentLocks = useCollaborationPresenceStore.getState().locks;
            const myLocks = Object.entries(currentLocks).filter(([_, lock]) => lock.user_id === currentUserId);
            console.log('[DEBUG] Responding to lock request with:', myLocks);
            channel.send({
              type: 'broadcast',
              event: 'locks_response',
              payload: { locks: myLocks, userId: currentUserId }
            });
          }
        });
        
        channel.on('broadcast', { event: 'locks_response' }, (payload) => {
          // Receive locks from other users
          const { locks: remoteLocks, userId } = payload.payload;
          console.log(`[DEBUG] Received locks_response from user ${userId}:`, remoteLocks);
          if (userId !== currentUserId) {
            remoteLocks.forEach(([layerId, lock]: [string, any]) => {
              storeAcquireLock(layerId, lock.user_id);
              console.log(`[DEBUG] Synced lock for layer ${layerId} from user ${lock.user_id}`);
            });
          }
        });
        
        await channel.subscribe();
        channelRef.current = channel;
        
        console.log(`[DEBUG] Subscribed to lock updates for page ${currentPageId}`);
        console.log(`[DEBUG] Channel status:`, channel.state);
        
        // Request current locks from all connected users
        await channel.send({
          type: 'broadcast',
          event: 'request_locks',
          payload: { userId: currentUserId }
        });
      } catch (error) {
        console.error('Failed to initialize lock channel:', error);
      }
    };
    
    initializeChannel();
    
      return () => {
        if (channelRef.current) {
          console.log(`[DEBUG] Unsubscribing from lock updates for page ${currentPageId}`);
          channelRef.current.unsubscribe();
          channelRef.current = null;
        }
      };
  }, [currentPageId, user, currentUserId, storeAcquireLock, storeReleaseLock]);
  
  // Broadcast lock changes to other users
  const broadcastLockChange = useCallback(async (action: 'acquire' | 'release', layerId: string) => {
    if (!channelRef.current || !currentUserId) {
      console.warn(`[DEBUG] Cannot broadcast ${action} - channel: ${!!channelRef.current}, userId: ${currentUserId}`);
      return;
    }
    
    console.log(`[DEBUG] Broadcasting ${action} for layer ${layerId} to other users`);
    console.log(`[DEBUG] Channel state:`, channelRef.current.state);
    
    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: action === 'acquire' ? 'lock_acquired' : 'lock_released',
        payload: {
          layerId,
          userId: currentUserId,
          timestamp: Date.now()
        }
      });
      console.log(`[DEBUG] Successfully broadcasted ${action} for layer ${layerId}`);
    } catch (error) {
      console.error('Failed to broadcast lock change:', error);
    }
  }, [currentUserId]);
  
  
  const acquireLock = useCallback(async (layerId: string): Promise<boolean> => {
    console.log(`[DEBUG] acquireLock called for layer ${layerId}`);
    
    if (!currentUserId) {
      console.warn(`[DEBUG] No current user ID, cannot acquire lock`);
      return false;
    }
    
    // Get fresh lock state from store
    const currentLocks = useCollaborationPresenceStore.getState().locks;
    const existingLock = currentLocks[layerId];
    console.log(`[DEBUG] Existing lock for ${layerId}:`, existingLock);
    
    if (existingLock && existingLock.user_id === currentUserId) {
      console.log(`[DEBUG] Already have lock for ${layerId}`);
      return true; // Already have the lock
    }
    
    // Check if locked by another user
    if (existingLock && existingLock.user_id !== currentUserId) {
      console.log(`[DEBUG] Layer ${layerId} is locked by another user: ${existingLock.user_id}`);
      return false; // Cannot acquire lock
    }
    
    console.log(`[DEBUG] Acquiring lock for ${layerId}`);
    
    // Acquire the lock
    storeAcquireLock(layerId, currentUserId);
    
    // Broadcast lock acquisition to other users
    await broadcastLockChange('acquire', layerId);
    
    // Set up auto-release timeout
    const timeout = setTimeout(async () => {
      console.log(`[DEBUG] Auto-releasing lock for ${layerId} after 30 seconds`);
      const freshLocks = useCollaborationPresenceStore.getState().locks;
      if (freshLocks[layerId]?.user_id === currentUserId) {
        storeReleaseLock(layerId);
        await broadcastLockChange('release', layerId);
        updateUser(currentUserId, { 
          selected_layer_id: null,
          locked_layer_id: null 
        });
      }
    }, 30000); // 30 seconds
    
    lockTimeouts.current[layerId] = timeout;
    
    console.log(`[DEBUG] Successfully acquired lock for ${layerId}`);
    return true;
  }, [currentUserId, storeAcquireLock, storeReleaseLock, updateUser, broadcastLockChange]);
  
  const releaseLock = useCallback(async (layerId: string) => {
    if (!currentUserId) return;
    
    // Clear timeout if exists
    if (lockTimeouts.current[layerId]) {
      clearTimeout(lockTimeouts.current[layerId]);
      delete lockTimeouts.current[layerId];
    }
    
    // Release the lock
    storeReleaseLock(layerId);
    
    // Broadcast lock release to other users
    await broadcastLockChange('release', layerId);
    
    // Update user state
    updateUser(currentUserId, { 
      selected_layer_id: null,
      locked_layer_id: null 
    });
  }, [currentUserId, storeReleaseLock, updateUser, broadcastLockChange]);
  
  const releaseAllLocks = useCallback(async () => {
    if (!currentUserId) return;
    
    Object.keys(lockTimeouts.current).forEach(layerId => {
      clearTimeout(lockTimeouts.current[layerId]);
    });
    lockTimeouts.current = {};
    
    // Release all locks for current user and broadcast
    const releasePromises = Object.entries(locks).map(async ([layerId, lock]) => {
      if (lock.user_id === currentUserId) {
        storeReleaseLock(layerId);
        await broadcastLockChange('release', layerId);
      }
    });
    
    await Promise.all(releasePromises);
    
    // Update user state
    updateUser(currentUserId, { 
      selected_layer_id: null,
      locked_layer_id: null 
    });
  }, [currentUserId, storeReleaseLock, updateUser, broadcastLockChange]);
  
  const isLayerLocked = useCallback((layerId: string): boolean => {
    const { locks: currentLocks } = useCollaborationPresenceStore.getState();
    const lock = currentLocks[layerId];
    if (!lock) return false;
    
    // Check if lock has expired
    if (Date.now() > lock.expires_at) {
      storeReleaseLock(layerId);
      return false;
    }
    
    return true;
  }, [storeReleaseLock]);
  
  const getLockOwner = useCallback((layerId: string): string | null => {
    const { locks: currentLocks } = useCollaborationPresenceStore.getState();
    const lock = currentLocks[layerId];
    if (!lock || Date.now() > lock.expires_at) return null;
    return lock.user_id;
  }, []);
  
  const canEditLayerLayer = useCallback((layerId: string): boolean => {
    if (!currentUserId) return false;
    return useCollaborationPresenceStore.getState().canEditLayer(layerId, currentUserId);
  }, [currentUserId]);
  
  const requestLockRelease = useCallback((layerId: string) => {
    // This would typically send a message to the lock owner
    // For now, we'll just log it
    console.log(`Requesting lock release for layer ${layerId}`);
    
    // In a real implementation, you might:
    // 1. Send a notification to the lock owner
    // 2. Show a toast to the lock owner
    // 3. Add to activity feed
  }, []);
  
  const isLockExpired = useCallback((layerId: string): boolean => {
    const lock = locks[layerId];
    if (!lock) return true;
    return Date.now() > lock.expires_at;
  }, [locks]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(lockTimeouts.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);
  
  return {
    acquireLock,
    releaseLock,
    isLayerLocked,
    getLockOwner,
    canEditLayer: canEditLayerLayer,
    requestLockRelease,
    isLockExpired
  };
}
