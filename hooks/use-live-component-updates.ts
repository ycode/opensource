'use client';

/**
 * Live Component Updates Hook
 * 
 * Manages real-time synchronization of component changes using Supabase Realtime
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useComponentsStore } from '../stores/useComponentsStore';
import { useCollaborationPresenceStore } from '../stores/useCollaborationPresenceStore';
import { usePagesStore } from '../stores/usePagesStore';
import { createClient } from '../lib/supabase/client';
import type { Component, Layer } from '../types';

// Types for component updates
interface ComponentUpdate {
  component_id: string;
  user_id: string;
  changes: Partial<Component>;
  timestamp: number;
}

export interface UseLiveComponentUpdatesReturn {
  broadcastComponentCreate: (component: Component) => void;
  broadcastComponentUpdate: (componentId: string, changes: Partial<Component>) => void;
  broadcastComponentDelete: (componentId: string) => void;
  broadcastComponentLayersUpdate: (componentId: string, layers: Layer[]) => void;
  isConnected: boolean;
}

export function useLiveComponentUpdates(): UseLiveComponentUpdatesReturn {
  const { user } = useAuthStore();
  const updateUser = useCollaborationPresenceStore((state) => state.updateUser);
  const currentUserId = useCollaborationPresenceStore((state) => state.currentUserId);
  
  const channelRef = useRef<ReturnType<Awaited<ReturnType<typeof createClient>>['channel']> | null>(null);
  const isConnectedRef = useRef(false);
  
  // Initialize Supabase channel for component updates
  useEffect(() => {
    if (!user) {
      return;
    }
    
    const initializeChannel = async () => {
      try {
        const supabase = await createClient();
        const channel = supabase.channel('components:updates');
        
        // Listen for component events
        channel.on('broadcast', { event: 'component_created' }, (payload) => {
          handleIncomingComponentCreate(payload.payload);
        });
        
        channel.on('broadcast', { event: 'component_updated' }, (payload) => {
          handleIncomingComponentUpdate(payload.payload);
        });
        
        channel.on('broadcast', { event: 'component_deleted' }, (payload) => {
          handleIncomingComponentDelete(payload.payload);
        });
        
        channel.on('broadcast', { event: 'component_layers_updated' }, (payload) => {
          handleIncomingComponentLayersUpdate(payload.payload);
        });
        
        await channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            isConnectedRef.current = true;
          } else {
            isConnectedRef.current = false;
          }
        });
        
        channelRef.current = channel;
      } catch (error) {
        console.error('[LIVE-COMPONENT] Failed to initialize:', error);
      }
    };
    
    initializeChannel();
    
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      isConnectedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
  
  // === INCOMING HANDLERS ===
  
  const handleIncomingComponentCreate = useCallback((payload: { component: Component; user_id: string }) => {
    const freshCurrentUserId = useCollaborationPresenceStore.getState().currentUserId;
    
    // Ignore own broadcasts
    if (!freshCurrentUserId || payload.user_id === freshCurrentUserId) {
      return;
    }
    
    // Add the component to the store
    const { components } = useComponentsStore.getState();
    
    // Check if already exists (avoid duplicates)
    if (components.some(c => c.id === payload.component.id)) {
      return;
    }
    
    useComponentsStore.setState(state => ({
      components: [payload.component, ...state.components],
    }));
  }, []);
  
  const handleIncomingComponentUpdate = useCallback((payload: ComponentUpdate) => {
    const freshCurrentUserId = useCollaborationPresenceStore.getState().currentUserId;
    
    if (!freshCurrentUserId || payload.user_id === freshCurrentUserId) {
      return;
    }
    
    // Update the component in the store
    useComponentsStore.setState(state => ({
      components: state.components.map(c => 
        c.id === payload.component_id 
          ? { ...c, ...payload.changes }
          : c
      ),
    }));
  }, []);
  
  const handleIncomingComponentDelete = useCallback((payload: { component_id: string; user_id: string }) => {
    const freshCurrentUserId = useCollaborationPresenceStore.getState().currentUserId;
    
    if (!freshCurrentUserId || payload.user_id === freshCurrentUserId) {
      return;
    }
    
    // Remove the component from the store
    useComponentsStore.setState(state => ({
      components: state.components.filter(c => c.id !== payload.component_id),
    }));
  }, []);
  
  const handleIncomingComponentLayersUpdate = useCallback((payload: { 
    component_id: string; 
    layers: Layer[]; 
    user_id: string 
  }) => {
    const freshCurrentUserId = useCollaborationPresenceStore.getState().currentUserId;
    
    if (!freshCurrentUserId || payload.user_id === freshCurrentUserId) {
      return;
    }
    
    // Update the component's layers in the store
    useComponentsStore.setState(state => ({
      components: state.components.map(c => 
        c.id === payload.component_id 
          ? { ...c, layers: payload.layers }
          : c
      ),
    }));
    
    // Also update all instances of this component across all pages
    const { updateComponentOnLayers } = usePagesStore.getState();
    updateComponentOnLayers(payload.component_id, payload.layers);
  }, []);
  
  // === BROADCAST FUNCTIONS ===
  
  const broadcastComponentCreate = useCallback((component: Component) => {
    if (!channelRef.current || !currentUserId) {
      console.warn('[LIVE-COMPONENT] Cannot broadcast - channel not ready');
      return;
    }
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'component_created',
      payload: {
        component,
        user_id: currentUserId,
        timestamp: Date.now(),
      },
    });
    
    updateUser(currentUserId, { last_active: Date.now() });
  }, [currentUserId, updateUser]);
  
  const broadcastComponentUpdate = useCallback((componentId: string, changes: Partial<Component>) => {
    if (!channelRef.current || !currentUserId) {
      return;
    }
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'component_updated',
      payload: {
        component_id: componentId,
        changes,
        user_id: currentUserId,
        timestamp: Date.now(),
      },
    });
    
    updateUser(currentUserId, { last_active: Date.now() });
  }, [currentUserId, updateUser]);
  
  const broadcastComponentDelete = useCallback((componentId: string) => {
    if (!channelRef.current || !currentUserId) {
      return;
    }
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'component_deleted',
      payload: {
        component_id: componentId,
        user_id: currentUserId,
        timestamp: Date.now(),
      },
    });
    
    updateUser(currentUserId, { last_active: Date.now() });
  }, [currentUserId, updateUser]);
  
  const broadcastComponentLayersUpdate = useCallback((componentId: string, layers: Layer[]) => {
    if (!channelRef.current || !currentUserId) {
      return;
    }
    
    channelRef.current.send({
      type: 'broadcast',
      event: 'component_layers_updated',
      payload: {
        component_id: componentId,
        layers,
        user_id: currentUserId,
        timestamp: Date.now(),
      },
    });
    
    updateUser(currentUserId, { last_active: Date.now() });
  }, [currentUserId, updateUser]);
  
  return {
    broadcastComponentCreate,
    broadcastComponentUpdate,
    broadcastComponentDelete,
    broadcastComponentLayersUpdate,
    isConnected: isConnectedRef.current,
  };
}
