/**
 * useResourceLock Hook
 * 
 * Generic hook for locking any type of resource (layers, collection items, etc.)
 * Handles lock acquisition, release, and real-time broadcasting.
 * 
 * This is the unified locking system - all collaboration locks run through here.
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useCollaborationPresenceStore, getResourceLockKey } from '@/stores/useCollaborationPresenceStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { createClient } from '@/lib/supabase/client';

export interface UseResourceLockOptions {
  resourceType: string; // e.g., 'layer', 'collection_item'
  channelName: string; // Supabase channel name for broadcasting
}

export interface UseResourceLockReturn {
  acquireLock: (resourceId: string) => Promise<boolean>;
  releaseLock: (resourceId: string) => Promise<void>;
  releaseAllLocks: () => Promise<void>;
  isLocked: (resourceId: string) => boolean;
  isLockedByOther: (resourceId: string) => boolean;
  getLockOwner: (resourceId: string) => string | null;
}

export function useResourceLock({
  resourceType,
  channelName,
}: UseResourceLockOptions): UseResourceLockReturn {
  const { user } = useAuthStore();
  const currentUserId = useCollaborationPresenceStore((state) => state.currentUserId);
  const currentUserColor = useCollaborationPresenceStore((state) => state.currentUserColor);
  const storeAcquireLock = useCollaborationPresenceStore((state) => state.acquireResourceLock);
  const storeReleaseLock = useCollaborationPresenceStore((state) => state.releaseResourceLock);
  const updateUser = useCollaborationPresenceStore((state) => state.updateUser);
  
  const channelRef = useRef<any>(null);
  const myLocksRef = useRef<Set<string>>(new Set());
  
  // Refs to avoid stale closures in channel handlers
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;
  const userRef = useRef(user);
  userRef.current = user;

  // Track if user is available (for effect dependency)
  const hasUser = !!user;
  
  // Initialize Supabase channel for lock broadcasting
  useEffect(() => {
    // Use ref for user data but still depend on hasUser for triggering
    const currentUser = userRef.current;
    if (!channelName || !currentUser) {
      return;
    }
    
    const initializeChannel = async () => {
      try {
        const supabase = await createClient();
        const channel = supabase.channel(channelName);
        
        // Listen for lock changes from other users
        channel.on('broadcast', { event: `${resourceType}_lock_acquired` }, (payload) => {
          const { resourceId, userId, userEmail, userColor } = payload.payload;
          // Use ref to get latest currentUserId (avoid stale closure)
          if (userId !== currentUserIdRef.current) {
            storeAcquireLock(resourceType, resourceId, userId);
            // Store user info for badge display
            if (userEmail) {
              updateUser(userId, {
                user_id: userId,
                email: userEmail,
                color: userColor || '#3b82f6',
                last_active: Date.now()
              });
            }
          }
        });
        
        channel.on('broadcast', { event: `${resourceType}_lock_released` }, (payload) => {
          const { resourceId, userId } = payload.payload;
          // Use ref to get latest currentUserId (avoid stale closure)
          if (userId !== currentUserIdRef.current) {
            storeReleaseLock(resourceType, resourceId);
          }
        });
        
        // Handle lock synchronization requests from newly joined users
        channel.on('broadcast', { event: `${resourceType}_request_locks` }, async () => {
          const myUserId = currentUserIdRef.current;
          if (!myUserId) return;
          
          // Respond with my current locks
          const { resourceLocks, currentUserColor: myColor } = useCollaborationPresenceStore.getState();
          const myLocks = Object.entries(resourceLocks)
            .filter(([key, lock]) => 
              key.startsWith(`${resourceType}:`) && 
              lock.user_id === myUserId &&
              Date.now() <= lock.expires_at
            );
          
          for (const [key] of myLocks) {
            const resourceId = key.replace(`${resourceType}:`, '');
            await channel.send({
              type: 'broadcast',
              event: `${resourceType}_lock_acquired`,
              payload: {
                resourceId,
                userId: myUserId,
                userEmail: userRef.current?.email,
                userColor: myColor,
                timestamp: Date.now()
              }
            });
          }
        });
        
        await channel.subscribe();
        channelRef.current = channel;
        
        const myUserId = currentUserIdRef.current;
        
        // Request current locks from all connected users
        await channel.send({
          type: 'broadcast',
          event: `${resourceType}_request_locks`,
          payload: { userId: myUserId }
        });
        
        // Re-broadcast any locks this user currently holds
        // This handles the race condition where locks were acquired before channel was ready
        if (myUserId) {
          const { resourceLocks, currentUserColor: myColor } = useCollaborationPresenceStore.getState();
          const myLocks = Object.entries(resourceLocks)
            .filter(([key, lock]) => 
              key.startsWith(`${resourceType}:`) && 
              lock.user_id === myUserId &&
              Date.now() <= lock.expires_at
            );
          
          for (const [key] of myLocks) {
            const resourceId = key.replace(`${resourceType}:`, '');
            await channel.send({
              type: 'broadcast',
              event: `${resourceType}_lock_acquired`,
              payload: {
                resourceId,
                userId: myUserId,
                userEmail: userRef.current?.email,
                userColor: myColor,
                timestamp: Date.now()
              }
            });
          }
        }
      } catch (error) {
        console.error(`Failed to initialize ${resourceType} lock channel:`, error);
      }
    };
    
    initializeChannel();
    
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  // Note: We use hasUser (boolean) instead of user (object) to avoid reinit on object reference changes.
  // The handlers use refs to get the latest values.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, hasUser, resourceType]);

  // Broadcast lock change
  const broadcastLockChange = useCallback(async (action: 'acquire' | 'release', resourceId: string) => {
    if (!channelRef.current || !currentUserId) {
      return;
    }
    
    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: action === 'acquire' ? `${resourceType}_lock_acquired` : `${resourceType}_lock_released`,
        payload: {
          resourceId,
          userId: currentUserId,
          userEmail: user?.email,
          userColor: currentUserColor,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error(`Failed to broadcast ${resourceType} lock change:`, error);
    }
  }, [currentUserId, user?.email, currentUserColor, resourceType]);

  const acquireLock = useCallback(async (resourceId: string): Promise<boolean> => {
    if (!currentUserId) {
      return false;
    }
    
    // Check if already locked by another user
    const { resourceLocks } = useCollaborationPresenceStore.getState();
    const key = getResourceLockKey(resourceType, resourceId);
    const existingLock = resourceLocks[key];
    
    if (existingLock && existingLock.user_id !== currentUserId && Date.now() <= existingLock.expires_at) {
      return false; // Cannot acquire - locked by another user
    }
    
    // Acquire the lock
    storeAcquireLock(resourceType, resourceId, currentUserId);
    myLocksRef.current.add(resourceId);
    
    // Broadcast to other users
    await broadcastLockChange('acquire', resourceId);
    
    return true;
  }, [currentUserId, resourceType, storeAcquireLock, broadcastLockChange]);

  const releaseLock = useCallback(async (resourceId: string) => {
    if (!currentUserId) {
      return;
    }
    
    storeReleaseLock(resourceType, resourceId);
    myLocksRef.current.delete(resourceId);
    
    // Broadcast to other users
    await broadcastLockChange('release', resourceId);
  }, [currentUserId, resourceType, storeReleaseLock, broadcastLockChange]);

  const releaseAllLocks = useCallback(async () => {
    if (!currentUserId) return;
    
    const locks = Array.from(myLocksRef.current);
    for (const resourceId of locks) {
      await releaseLock(resourceId);
    }
  }, [currentUserId, releaseLock]);

  const isLocked = useCallback((resourceId: string): boolean => {
    const { resourceLocks } = useCollaborationPresenceStore.getState();
    const key = getResourceLockKey(resourceType, resourceId);
    const lock = resourceLocks[key];
    return !!(lock && Date.now() <= lock.expires_at);
  }, [resourceType]);

  const isLockedByOther = useCallback((resourceId: string): boolean => {
    if (!currentUserId) return false;
    return useCollaborationPresenceStore.getState().isResourceLockedByOther(resourceType, resourceId, currentUserId);
  }, [resourceType, currentUserId]);

  const getLockOwner = useCallback((resourceId: string): string | null => {
    const lock = useCollaborationPresenceStore.getState().getResourceLock(resourceType, resourceId);
    return lock?.user_id || null;
  }, [resourceType]);

  // Cleanup on page unload only (not on component remount)
  // This ensures locks are released when user actually leaves the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      const locks = Array.from(myLocksRef.current);
      if (locks.length > 0) {
        locks.forEach(resourceId => {
          storeReleaseLock(resourceType, resourceId);
        });
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [resourceType, storeReleaseLock]);

  return {
    acquireLock,
    releaseLock,
    releaseAllLocks,
    isLocked,
    isLockedByOther,
    getLockOwner,
  };
}
