'use client';

/**
 * Live Collection Updates Hook
 *
 * Manages real-time synchronization of collection and item changes using Supabase Realtime
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/useAuthStore';
import { useCollectionsStore } from '../stores/useCollectionsStore';
import { useCollaborationPresenceStore } from '../stores/useCollaborationPresenceStore';
import { createClient } from '@/lib/supabase-browser';
import type { Collection, CollectionItemWithValues } from '../types';

// Types for collection updates
interface CollectionUpdate {
  collection_id: string;
  user_id: string;
  changes: Partial<Collection>;
  timestamp: number;
}

interface ItemUpdate {
  collection_id: string;
  item_id: string;
  user_id: string;
  changes: Partial<CollectionItemWithValues>;
  timestamp: number;
}

export interface UseLiveCollectionUpdatesReturn {
  // Collection broadcasts
  broadcastCollectionCreate: (collection: Collection) => void;
  broadcastCollectionUpdate: (collectionId: string, changes: Partial<Collection>) => void;
  broadcastCollectionDelete: (collectionId: string) => void;
  // Item broadcasts
  broadcastItemCreate: (collectionId: string, item: CollectionItemWithValues) => void;
  broadcastItemUpdate: (collectionId: string, itemId: string, changes: Partial<CollectionItemWithValues>) => void;
  broadcastItemDelete: (collectionId: string, itemId: string) => void;
  // Status
  isConnected: boolean;
}

export function useLiveCollectionUpdates(): UseLiveCollectionUpdatesReturn {
  const { user } = useAuthStore();
  const updateUser = useCollaborationPresenceStore((state) => state.updateUser);
  const currentUserId = useCollaborationPresenceStore((state) => state.currentUserId);

  const channelRef = useRef<any>(null);
  const isConnectedRef = useRef(false);

  // Initialize Supabase channel for collection updates
  useEffect(() => {
    if (!user) {
      return;
    }

    const initializeChannel = async () => {
      try {
        const supabase = await createClient();
        const channel = supabase.channel('collections:updates');

        // Listen for collection events
        channel.on('broadcast', { event: 'collection_created' }, (payload) => {
          handleIncomingCollectionCreate(payload.payload);
        });

        channel.on('broadcast', { event: 'collection_updated' }, (payload) => {
          handleIncomingCollectionUpdate(payload.payload);
        });

        channel.on('broadcast', { event: 'collection_deleted' }, (payload) => {
          handleIncomingCollectionDelete(payload.payload);
        });

        // Listen for item events
        channel.on('broadcast', { event: 'item_created' }, (payload) => {
          handleIncomingItemCreate(payload.payload);
        });

        channel.on('broadcast', { event: 'item_updated' }, (payload) => {
          handleIncomingItemUpdate(payload.payload);
        });

        channel.on('broadcast', { event: 'item_deleted' }, (payload) => {
          handleIncomingItemDelete(payload.payload);
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
        console.error('[LIVE-COLLECTION] Failed to initialize:', error);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers are stable refs, adding would cause reconnect loops
  }, [user]);

  // === INCOMING HANDLERS ===

  const handleIncomingCollectionCreate = useCallback((payload: { collection: Collection; user_id: string }) => {
    const freshCurrentUserId = useCollaborationPresenceStore.getState().currentUserId;

    // Ignore own broadcasts
    if (!freshCurrentUserId || payload.user_id === freshCurrentUserId) {
      return;
    }

    // Add the collection to the store
    const { collections } = useCollectionsStore.getState();

    // Check if already exists (avoid duplicates)
    if (collections.some(c => c.id === payload.collection.id)) {
      return;
    }

    useCollectionsStore.setState(state => ({
      collections: [...state.collections, payload.collection],
    }));
  }, []);

  const handleIncomingCollectionUpdate = useCallback((payload: CollectionUpdate) => {
    const freshCurrentUserId = useCollaborationPresenceStore.getState().currentUserId;

    if (!freshCurrentUserId || payload.user_id === freshCurrentUserId) {
      return;
    }

    // Update the collection in the store
    useCollectionsStore.setState(state => ({
      collections: state.collections.map(c =>
        c.id === payload.collection_id
          ? { ...c, ...payload.changes }
          : c
      ),
    }));
  }, []);

  const handleIncomingCollectionDelete = useCallback((payload: { collection_id: string; user_id: string }) => {
    const freshCurrentUserId = useCollaborationPresenceStore.getState().currentUserId;

    if (!freshCurrentUserId || payload.user_id === freshCurrentUserId) {
      return;
    }

    // Remove the collection from the store
    useCollectionsStore.setState(state => ({
      collections: state.collections.filter(c => c.id !== payload.collection_id),
      // Also clear selected if it was the deleted one
      selectedCollectionId: state.selectedCollectionId === payload.collection_id
        ? null
        : state.selectedCollectionId,
    }));
  }, []);

  const handleIncomingItemCreate = useCallback((payload: { collection_id: string; item: CollectionItemWithValues; user_id: string }) => {
    const freshCurrentUserId = useCollaborationPresenceStore.getState().currentUserId;

    if (!freshCurrentUserId || payload.user_id === freshCurrentUserId) {
      return;
    }

    // Add the item to the store
    const { items } = useCollectionsStore.getState();
    const existingItems = items[payload.collection_id] || [];

    // Check if already exists
    if (existingItems.some(i => i.id === payload.item.id)) {
      return;
    }

    useCollectionsStore.setState(state => ({
      items: {
        ...state.items,
        [payload.collection_id]: [...(state.items[payload.collection_id] || []), payload.item],
      },
      itemsTotalCount: {
        ...state.itemsTotalCount,
        [payload.collection_id]: (state.itemsTotalCount[payload.collection_id] || 0) + 1,
      },
    }));
  }, []);

  const handleIncomingItemUpdate = useCallback((payload: ItemUpdate) => {
    const freshCurrentUserId = useCollaborationPresenceStore.getState().currentUserId;

    if (!freshCurrentUserId || payload.user_id === freshCurrentUserId) {
      return;
    }

    // Update the item in the store
    useCollectionsStore.setState(state => ({
      items: {
        ...state.items,
        [payload.collection_id]: (state.items[payload.collection_id] || []).map(item =>
          item.id === payload.item_id
            ? { ...item, ...payload.changes }
            : item
        ),
      },
    }));
  }, []);

  const handleIncomingItemDelete = useCallback((payload: { collection_id: string; item_id: string; user_id: string }) => {
    const freshCurrentUserId = useCollaborationPresenceStore.getState().currentUserId;

    if (!freshCurrentUserId || payload.user_id === freshCurrentUserId) {
      return;
    }

    // Remove the item from the store
    useCollectionsStore.setState(state => ({
      items: {
        ...state.items,
        [payload.collection_id]: (state.items[payload.collection_id] || []).filter(
          item => item.id !== payload.item_id
        ),
      },
      itemsTotalCount: {
        ...state.itemsTotalCount,
        [payload.collection_id]: Math.max(0, (state.itemsTotalCount[payload.collection_id] || 0) - 1),
      },
    }));
  }, []);

  // === BROADCAST FUNCTIONS ===

  const broadcastCollectionCreate = useCallback((collection: Collection) => {
    if (!channelRef.current || !currentUserId) {
      console.warn('[LIVE-COLLECTION] Cannot broadcast - channel not ready');
      return;
    }

    channelRef.current.send({
      type: 'broadcast',
      event: 'collection_created',
      payload: {
        collection,
        user_id: currentUserId,
        timestamp: Date.now(),
      },
    });

    updateUser(currentUserId, { last_active: Date.now() });
  }, [currentUserId, updateUser]);

  const broadcastCollectionUpdate = useCallback((collectionId: string, changes: Partial<Collection>) => {
    if (!channelRef.current || !currentUserId) {
      return;
    }

    channelRef.current.send({
      type: 'broadcast',
      event: 'collection_updated',
      payload: {
        collection_id: collectionId,
        changes,
        user_id: currentUserId,
        timestamp: Date.now(),
      },
    });

    updateUser(currentUserId, { last_active: Date.now() });
  }, [currentUserId, updateUser]);

  const broadcastCollectionDelete = useCallback((collectionId: string) => {
    if (!channelRef.current || !currentUserId) {
      return;
    }

    channelRef.current.send({
      type: 'broadcast',
      event: 'collection_deleted',
      payload: {
        collection_id: collectionId,
        user_id: currentUserId,
        timestamp: Date.now(),
      },
    });

    updateUser(currentUserId, { last_active: Date.now() });
  }, [currentUserId, updateUser]);

  const broadcastItemCreate = useCallback((collectionId: string, item: CollectionItemWithValues) => {
    if (!channelRef.current || !currentUserId) {
      console.warn('[LIVE-COLLECTION] Cannot broadcast item - channel not ready');
      return;
    }

    channelRef.current.send({
      type: 'broadcast',
      event: 'item_created',
      payload: {
        collection_id: collectionId,
        item,
        user_id: currentUserId,
        timestamp: Date.now(),
      },
    });

    updateUser(currentUserId, { last_active: Date.now() });
  }, [currentUserId, updateUser]);

  const broadcastItemUpdate = useCallback((collectionId: string, itemId: string, changes: Partial<CollectionItemWithValues>) => {
    if (!channelRef.current || !currentUserId) {
      return;
    }

    channelRef.current.send({
      type: 'broadcast',
      event: 'item_updated',
      payload: {
        collection_id: collectionId,
        item_id: itemId,
        changes,
        user_id: currentUserId,
        timestamp: Date.now(),
      },
    });

    updateUser(currentUserId, { last_active: Date.now() });
  }, [currentUserId, updateUser]);

  const broadcastItemDelete = useCallback((collectionId: string, itemId: string) => {
    if (!channelRef.current || !currentUserId) {
      return;
    }

    channelRef.current.send({
      type: 'broadcast',
      event: 'item_deleted',
      payload: {
        collection_id: collectionId,
        item_id: itemId,
        user_id: currentUserId,
        timestamp: Date.now(),
      },
    });

    updateUser(currentUserId, { last_active: Date.now() });
  }, [currentUserId, updateUser]);

  return {
    broadcastCollectionCreate,
    broadcastCollectionUpdate,
    broadcastCollectionDelete,
    broadcastItemCreate,
    broadcastItemUpdate,
    broadcastItemDelete,
    isConnected: isConnectedRef.current,
  };
}
