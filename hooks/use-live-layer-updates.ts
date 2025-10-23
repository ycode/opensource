/**
 * Live Layer Updates Hook
 * 
 * Manages real-time synchronization of layer changes using Supabase Realtime
 */

import { useCallback, useEffect, useRef } from 'react';
import { useCollaborationPresenceStore } from '../stores/useCollaborationPresenceStore';
import { useAuthStore } from '../stores/useAuthStore';
import { usePagesStore } from '../stores/usePagesStore';
import { useEditorStore } from '../stores/useEditorStore';
import { createClient } from '../lib/supabase/client';
import { debounce } from '../lib/collaboration-utils';
import type { Layer, LayerUpdate } from '../types';

// Helper function to find layer in draft
function findLayerInDraft(layers: Layer[], layerId: string): Layer | null {
  for (const layer of layers) {
    if (layer.id === layerId) return layer;
    if (layer.children) {
      const found = findLayerInDraft(layer.children, layerId);
      if (found) return found;
    }
  }
  return null;
}

interface UseLiveLayerUpdatesReturn {
  broadcastLayerUpdate: (layerId: string, changes: Partial<Layer>) => void;
  isReceivingUpdates: boolean;
  lastUpdateTime: number | null;
}

export function useLiveLayerUpdates(
  pageId: string | null
): UseLiveLayerUpdatesReturn {
  console.log(`[LIVE-UPDATES] useLiveLayerUpdates called with pageId: ${pageId}`);
  
  const { user } = useAuthStore();
  const { updateLayer, draftsByPageId } = usePagesStore();
  const { 
    addNotification, 
    updateUser, 
    currentUserId 
  } = useCollaborationPresenceStore();
  
  const channelRef = useRef<any>(null);
  const isReceivingUpdates = useRef(false);
  const lastUpdateTime = useRef<number | null>(null);
  const updateQueue = useRef<LayerUpdate[]>([]);
  
  // Debounced broadcast function
  const debouncedBroadcast = useRef(
    debounce((layerId: string, changes: Partial<Layer>) => {
      console.log(`[LIVE-UPDATES] debouncedBroadcast executing for layer ${layerId}`);
      
      // Get fresh values from refs and store
      const channel = channelRef.current;
      const userId = useCollaborationPresenceStore.getState().currentUserId;
      
      console.log(`[LIVE-UPDATES] debouncedBroadcast: channel=${!!channel}, userId=${userId}`);
      
      if (!channel || !userId) {
        console.warn(`[LIVE-UPDATES] debouncedBroadcast: channel or user missing`);
        return;
      }
      
      const update: LayerUpdate = {
        layer_id: layerId,
        user_id: userId,
        changes,
        timestamp: Date.now()
      };
      
      console.log(`[LIVE-UPDATES] Sending broadcast with update:`, update);
      
      channel.send({
        type: 'broadcast',
        event: 'layer_update',
        payload: update
      });
      
      console.log(`[LIVE-UPDATES] Broadcast sent successfully`);
    }, 200) // 200ms debounce
  );
  
  // Initialize Supabase channel
  useEffect(() => {
    console.log(`[LIVE-UPDATES] useEffect triggered - pageId: ${pageId}, user: ${!!user}`);
    if (!pageId || !user) {
      console.log(`[LIVE-UPDATES] Skipping channel initialization - pageId: ${pageId}, user: ${!!user}`);
      return;
    }
    
    const initializeChannel = async () => {
      try {
        const supabase = await createClient();
        const channel = supabase.channel(`page:${pageId}:updates`);
        
        console.log(`[LIVE-UPDATES] Initializing channel for page: ${pageId}`);
        
        // Listen for layer updates
        channel.on('broadcast', { event: 'layer_update' }, (payload) => {
          console.log(`[LIVE-UPDATES] Received layer_update broadcast:`, payload);
          handleIncomingUpdate(payload.payload);
        });
        
        // Listen for user activity
        channel.on('broadcast', { event: 'user_activity' }, (payload) => {
          handleUserActivity(payload.payload);
        });
        
        // Listen for lock changes
        channel.on('broadcast', { event: 'lock_change' }, (payload) => {
          handleLockChange(payload.payload);
        });
        
        await channel.subscribe((status) => {
          console.log(`[LIVE-UPDATES] Channel subscription status: ${status}`);
          if (status === 'SUBSCRIBED') {
            console.log(`[LIVE-UPDATES] Successfully subscribed to page:${pageId}:updates`);
            isReceivingUpdates.current = true;
          } else if (status === 'CHANNEL_ERROR') {
            console.error(`[LIVE-UPDATES] Channel subscription error`);
          } else if (status === 'TIMED_OUT') {
            console.error(`[LIVE-UPDATES] Channel subscription timed out`);
          } else if (status === 'CLOSED') {
            console.warn(`[LIVE-UPDATES] Channel closed`);
          }
        });
        
        channelRef.current = channel;
        
        console.log(`[LIVE-UPDATES] Channel reference set for page ${pageId}`);
        
        // Test broadcast to verify channel is working
        setTimeout(() => {
          if (channelRef.current) {
            console.log(`[LIVE-UPDATES] Sending test broadcast`);
            channelRef.current.send({
              type: 'broadcast',
              event: 'test',
              payload: { message: 'test from page ' + pageId, timestamp: Date.now() }
            });
          }
        }, 1000);
      } catch (error) {
        console.error('Failed to initialize live updates:', error);
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
  }, [pageId, user]);
  
  const handleIncomingUpdate = useCallback((update: LayerUpdate) => {
    console.log(`[LIVE-UPDATES] handleIncomingUpdate called:`, update);
    console.log(`[LIVE-UPDATES] Current user ID: ${currentUserId}, Update user ID: ${update.user_id}`);
    
    // Get fresh current user ID from store
    const freshCurrentUserId = useCollaborationPresenceStore.getState().currentUserId;
    console.log(`[LIVE-UPDATES] Fresh current user ID: ${freshCurrentUserId}`);
    
    if (!freshCurrentUserId || update.user_id === freshCurrentUserId) {
      console.log(`[LIVE-UPDATES] Ignoring update from self`);
      return;
    }
    
    console.log(`[LIVE-UPDATES] Adding update to queue`);
    // Add to update queue
    updateQueue.current.push(update);
    console.log(`[LIVE-UPDATES] Queue now has ${updateQueue.current.length} items`);
    
    // Process updates in order
    console.log(`[LIVE-UPDATES] Calling processUpdateQueue`);
    processUpdateQueue();
    
    // Update last update time
    lastUpdateTime.current = Date.now();
    
    // Only show notification for text content changes, not class changes
    const isTextContentChange = 'content' in update.changes;
    if (isTextContentChange) {
      addNotification({
        type: 'layer_edit_started',
        user_id: update.user_id,
        user_name: 'User', // Would get from user store
        layer_id: update.layer_id,
        timestamp: Date.now(),
        message: `User is editing text in layer ${update.layer_id}`
      });
    }
  }, [currentUserId, addNotification]);
  
  const handleUserActivity = useCallback((activity: any) => {
    if (!currentUserId || activity.user_id === currentUserId) return;
    
    // Update user activity
    updateUser(activity.user_id, {
      last_active: Date.now(),
      is_editing: activity.is_editing || false
    });
  }, [currentUserId, updateUser]);
  
  const handleLockChange = useCallback((lockChange: any) => {
    if (!currentUserId || lockChange.user_id === currentUserId) return;
    
    // Handle lock acquisition/release
    if (lockChange.action === 'acquire') {
      addNotification({
        type: 'layer_edit_started',
        user_id: lockChange.user_id,
        user_name: 'User',
        layer_id: lockChange.layer_id,
        timestamp: Date.now(),
        message: `User started editing layer ${lockChange.layer_id}`
      });
    } else if (lockChange.action === 'release') {
      addNotification({
        type: 'layer_edit_ended',
        user_id: lockChange.user_id,
        user_name: 'User',
        layer_id: lockChange.layer_id,
        timestamp: Date.now(),
        message: `User finished editing layer ${lockChange.layer_id}`
      });
    }
  }, [currentUserId, addNotification]);
  
  const processUpdateQueue = useCallback(() => {
    // Get fresh pageId from the hook parameter (this will be the current value)
    const currentPageId = pageId;
    console.log(`[LIVE-UPDATES] processUpdateQueue called with pageId: ${currentPageId}`);
    
    if (updateQueue.current.length === 0) {
      console.log(`[LIVE-UPDATES] processUpdateQueue: queue is empty`);
      return;
    }
    
    const update = updateQueue.current.shift();
    if (!update) return;
    
    console.log(`[LIVE-UPDATES] processUpdateQueue: processing update for layer ${update.layer_id}`, update.changes);
    
    // Get fresh state from store
    const { draftsByPageId: freshDrafts, updateLayer: freshUpdateLayer } = usePagesStore.getState();
    const currentDraft = freshDrafts[currentPageId || ''];
    
    if (!currentPageId) {
      console.warn(`[LIVE-UPDATES] No pageId provided to processUpdateQueue`);
      return;
    }
    
    if (!currentDraft) {
      console.warn(`[LIVE-UPDATES] No draft found for page ${currentPageId}`);
      return;
    }
    
    console.log(`[LIVE-UPDATES] Current draft has ${currentDraft.layers.length} layers`);
    
    // Apply the update to the store (without broadcasting back)
    if (currentPageId) {
      console.log(`[LIVE-UPDATES] Calling updateLayer for page ${currentPageId}, layer ${update.layer_id}`);
      console.log(`[LIVE-UPDATES] Changes to apply:`, update.changes);
      
      try {
        freshUpdateLayer(currentPageId, update.layer_id, update.changes);
        console.log(`[LIVE-UPDATES] Update applied successfully`);
        
        // Verify the update was applied by checking the store
        const updatedDraft = usePagesStore.getState().draftsByPageId[currentPageId];
        if (updatedDraft) {
          const updatedLayer = findLayerInDraft(updatedDraft.layers, update.layer_id);
          if (updatedLayer) {
            console.log(`[LIVE-UPDATES] Verified layer after update:`, updatedLayer);
          } else {
            console.warn(`[LIVE-UPDATES] Could not find updated layer in draft`);
          }
        }
      } catch (error) {
        console.error(`[LIVE-UPDATES] Error applying update:`, error);
      }
    }
    
    // Process next update
    if (updateQueue.current.length > 0) {
      console.log(`[LIVE-UPDATES] Processing next update in queue (${updateQueue.current.length} remaining)`);
      setTimeout(processUpdateQueue, 50); // Small delay to prevent overwhelming
    }
  }, [pageId]);
  
  const broadcastLayerUpdate = useCallback((layerId: string, changes: Partial<Layer>) => {
    console.log(`[LIVE-UPDATES] broadcastLayerUpdate called for layer ${layerId}`, changes);
    console.log(`[LIVE-UPDATES] Channel exists: ${!!channelRef.current}, User ID: ${currentUserId}`);
    
    if (!channelRef.current || !currentUserId) {
      console.warn(`[LIVE-UPDATES] Cannot broadcast - channel or user ID missing`);
      return;
    }
    
    // Don't update local state - that's already done by the caller
    // Just broadcast the update to others
    
    console.log(`[LIVE-UPDATES] Broadcasting update via debounced function`);
    // Broadcast the update
    debouncedBroadcast.current(layerId, changes);
    
    // Only set is_editing for text content changes, not class changes
    const isTextContentChange = 'content' in changes;
    
    // Update user activity
    updateUser(currentUserId, {
      last_active: Date.now(),
      is_editing: isTextContentChange
    });
    
    // Broadcast activity
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'user_activity',
        payload: {
          user_id: currentUserId,
          is_editing: isTextContentChange,
          timestamp: Date.now()
        }
      });
    }
  }, [currentUserId, updateUser]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
      }
    };
  }, []);
  
  return {
    broadcastLayerUpdate,
    isReceivingUpdates: isReceivingUpdates.current,
    lastUpdateTime: lastUpdateTime.current
  };
}
