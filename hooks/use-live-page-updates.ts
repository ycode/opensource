'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { usePagesStore } from '../stores/usePagesStore';
import { useCollaborationPresenceStore } from '../stores/useCollaborationPresenceStore';
import { createClient } from '../lib/supabase/client';
import { debounce } from '../lib/collaboration-utils';
import type { Page } from '../types';

interface PageUpdate {
  page_id: string;
  user_id: string;
  changes: Partial<Page>;
  timestamp: number;
}

interface UseLivePageUpdatesReturn {
  broadcastPageUpdate: (pageId: string, changes: Partial<Page>) => void;
  broadcastPageCreate: (page: Page) => void;
  broadcastPageDelete: (pageId: string) => void;
  isReceivingUpdates: boolean;
  lastUpdateTime: number | null;
}

export function useLivePageUpdates(): UseLivePageUpdatesReturn {
  const { user } = useAuthStore();
  const { 
    loadPages, 
    addPage, 
    updatePage, 
    removePage 
  } = usePagesStore();
  const { 
    addNotification, 
    updateUser, 
    currentUserId 
  } = useCollaborationPresenceStore();
  
  const channelRef = useRef<any>(null);
  const isReceivingUpdates = useRef(false);
  const lastUpdateTime = useRef<number | null>(null);
  const updateQueue = useRef<PageUpdate[]>([]);
  
  // Debounced broadcast function for page updates
  const debouncedBroadcast = useRef(
    debounce((pageId: string, changes: Partial<Page>) => {
      // Get fresh values from refs and store
      const channel = channelRef.current;
      const userId = useCollaborationPresenceStore.getState().currentUserId;
      
      if (!channel || !userId) {
        return;
      }
      
      const update: PageUpdate = {
        page_id: pageId,
        user_id: userId,
        changes,
        timestamp: Date.now()
      };
      
      channel.send({
        type: 'broadcast',
        event: 'page_update',
        payload: update
      });
    }, 200) // 200ms debounce
  );
  
  // Initialize Supabase channel for page updates
  useEffect(() => {
    if (!user) {
      return;
    }
    
    const initializeChannel = async () => {
      try {
        const supabase = await createClient();
        const channel = supabase.channel('pages:updates');
        
        // Listen for page updates
        channel.on('broadcast', { event: 'page_update' }, (payload) => {
          handleIncomingPageUpdate(payload.payload);
        });
        
        // Listen for page creation
        channel.on('broadcast', { event: 'page_created' }, (payload) => {
          handleIncomingPageCreate(payload.payload);
        });
        
        // Listen for page deletion
        channel.on('broadcast', { event: 'page_deleted' }, (payload) => {
          handleIncomingPageDelete(payload.payload);
        });
        
        await channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            isReceivingUpdates.current = true;
          }
        });
        
        channelRef.current = channel;
      } catch (error) {
        console.error('Failed to initialize page updates:', error);
      }
    };
    
    initializeChannel();
    
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      isReceivingUpdates.current = false;
    };
  }, [user]);
  
  const handleIncomingPageUpdate = useCallback((update: PageUpdate) => {
    // Get fresh current user ID from store
    const freshCurrentUserId = useCollaborationPresenceStore.getState().currentUserId;
    
    if (!freshCurrentUserId || update.user_id === freshCurrentUserId) {
      return;
    }
    
    // Add to update queue
    updateQueue.current.push(update);
    
    // Process updates in order
    processUpdateQueue();
    
    // Update last update time
    lastUpdateTime.current = Date.now();
  }, []);
  
  const handleIncomingPageCreate = useCallback((page: Page) => {
    // Get fresh current user ID from store
    const freshCurrentUserId = useCollaborationPresenceStore.getState().currentUserId;
    
    if (!freshCurrentUserId) {
      return;
    }
    
    // Add the new page to the store
    addPage(page);
    
    // Show notification
    addNotification({
      type: 'page_created',
      user_id: freshCurrentUserId,
      user_name: 'User',
      page_id: page.id,
      timestamp: Date.now(),
      message: `New page "${page.title}" was created`
    });
  }, [addPage, addNotification]);
  
  const handleIncomingPageDelete = useCallback((pageId: string) => {
    // Get fresh current user ID from store
    const freshCurrentUserId = useCollaborationPresenceStore.getState().currentUserId;
    
    if (!freshCurrentUserId) {
      return;
    }
    
    // Remove the page from the store
    removePage(pageId);
    
    // Show notification
    addNotification({
      type: 'page_deleted',
      user_id: freshCurrentUserId,
      user_name: 'User',
      page_id: pageId,
      timestamp: Date.now(),
      message: `Page was deleted`
    });
  }, [removePage, addNotification]);
  
  const processUpdateQueue = useCallback(() => {
    if (updateQueue.current.length === 0) {
      return;
    }
    
    const update = updateQueue.current.shift();
    if (!update) return;
    
    // Get fresh state from store
    const { pages: freshPages, updatePage: freshUpdatePage } = usePagesStore.getState();
    const currentPage = freshPages.find(p => p.id === update.page_id);
    
    if (!currentPage) {
      return;
    }
    
    // Apply the update to the store (without broadcasting back)
    try {
      freshUpdatePage(update.page_id, update.changes);
    } catch (error) {
      console.error(`[LIVE-PAGE-UPDATES] Error applying update:`, error);
    }
    
    // Process next update
    if (updateQueue.current.length > 0) {
      setTimeout(processUpdateQueue, 50); // Small delay to prevent overwhelming
    }
  }, []);
  
  const broadcastPageUpdate = useCallback((pageId: string, changes: Partial<Page>) => {
    if (!channelRef.current || !currentUserId) {
      return;
    }
    
    // Don't update local state - that's already done by the caller
    // Just broadcast the update to others
    
    // Broadcast the update
    debouncedBroadcast.current(pageId, changes);
    
    // Update user activity
    updateUser(currentUserId, {
      last_active: Date.now(),
      is_editing: false
    });
  }, [currentUserId, updateUser]);
  
  const broadcastPageCreate = useCallback((page: Page) => {
    if (!channelRef.current || !currentUserId) {
      return;
    }
    
    // Broadcast the page creation
    channelRef.current.send({
      type: 'broadcast',
      event: 'page_created',
      payload: page
    });
    
    // Update user activity
    updateUser(currentUserId, {
      last_active: Date.now(),
      is_editing: false
    });
  }, [currentUserId, updateUser]);
  
  const broadcastPageDelete = useCallback((pageId: string) => {
    if (!channelRef.current || !currentUserId) {
      return;
    }
    
    // Broadcast the page deletion
    channelRef.current.send({
      type: 'broadcast',
      event: 'page_deleted',
      payload: { pageId }
    });
    
    // Update user activity
    updateUser(currentUserId, {
      last_active: Date.now(),
      is_editing: false
    });
  }, [currentUserId, updateUser]);
  
  return {
    broadcastPageUpdate,
    broadcastPageCreate,
    broadcastPageDelete,
    isReceivingUpdates: isReceivingUpdates.current,
    lastUpdateTime: lastUpdateTime.current,
  };
}
