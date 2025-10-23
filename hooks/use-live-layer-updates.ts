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

interface UseLiveLayerUpdatesReturn {
  broadcastLayerUpdate: (layerId: string, changes: Partial<Layer>) => void;
  isReceivingUpdates: boolean;
  lastUpdateTime: number | null;
}

export function useLiveLayerUpdates(
  pageId: string | null
): UseLiveLayerUpdatesReturn {
  const { user } = useAuthStore();
  const { currentPageId } = useEditorStore();
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
      if (!channelRef.current || !currentUserId) return;
      
      const update: LayerUpdate = {
        layer_id: layerId,
        user_id: currentUserId,
        changes,
        timestamp: Date.now()
      };
      
      channelRef.current.send({
        type: 'layer_update',
        payload: update
      });
    }, 200) // 200ms debounce
  );
  
  // Initialize Supabase channel
  useEffect(() => {
    if (!pageId || !user) return;
    
    const initializeChannel = async () => {
      try {
        const supabase = await createClient();
        const channel = supabase.channel(`page:${pageId}:updates`);
        
        // Listen for layer updates
        channel.on('broadcast', { event: 'layer_update' }, (payload) => {
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
        
        await channel.subscribe();
        channelRef.current = channel;
        isReceivingUpdates.current = true;
        
        console.log(`Subscribed to live updates for page ${pageId}`);
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
    if (!currentUserId || update.user_id === currentUserId) return;
    
    // Add to update queue
    updateQueue.current.push(update);
    
    // Process updates in order
    processUpdateQueue();
    
    // Update last update time
    lastUpdateTime.current = Date.now();
    
    // Show notification
    addNotification({
      type: 'layer_edit_started',
      user_id: update.user_id,
      user_name: 'User', // Would get from user store
      layer_id: update.layer_id,
      timestamp: Date.now(),
      message: `User updated layer ${update.layer_id}`
    });
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
    if (updateQueue.current.length === 0) return;
    
    const update = updateQueue.current.shift();
    if (!update) return;
    
    // Apply the update to local state
    const currentDraft = draftsByPageId[pageId || ''];
    if (!currentDraft) return;
    
    // Find and update the layer
    const updateLayerInTree = (layers: Layer[]): Layer[] => {
      return layers.map(layer => {
        if (layer.id === update.layer_id) {
          return { ...layer, ...update.changes };
        }
        if (layer.children) {
          return { ...layer, children: updateLayerInTree(layer.children) };
        }
        return layer;
      });
    };
    
    const updatedLayers = updateLayerInTree(currentDraft.layers);
    
    // Update the draft - this should be done differently
    // For now, we'll just log that we received an update
    console.log('Received layer update:', update);
    
    // Process next update
    setTimeout(processUpdateQueue, 50); // Small delay to prevent overwhelming
  }, [pageId, draftsByPageId, updateLayer]);
  
  const broadcastLayerUpdate = useCallback((layerId: string, changes: Partial<Layer>) => {
    if (!channelRef.current || !currentUserId) return;
    
    // Update local state first
    if (pageId) {
      updateLayer(pageId, layerId, changes);
    }
    
    // Broadcast the update
    debouncedBroadcast.current(layerId, changes);
    
    // Update user activity
    updateUser(currentUserId, {
      last_active: Date.now(),
      is_editing: true
    });
    
    // Broadcast activity
    if (channelRef.current) {
      channelRef.current.send({
        type: 'user_activity',
        payload: {
          user_id: currentUserId,
          is_editing: true,
          timestamp: Date.now()
        }
      });
    }
  }, [pageId, currentUserId, updateLayer, updateUser]);
  
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
