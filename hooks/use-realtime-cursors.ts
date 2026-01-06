import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useCollaborationPresenceStore } from '../stores/useCollaborationPresenceStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useEditorStore } from '../stores/useEditorStore'

/**
 * Throttle a callback to a certain delay, It will only call the callback if the delay has passed, with the arguments
 * from the last call
 */
const useThrottleCallback = <Params extends unknown[], Return>(
  callback: (...args: Params) => Return,
  delay: number
) => {
  const lastCall = useRef(0)
  const timeout = useRef<NodeJS.Timeout | null>(null)

  return useCallback(
    (...args: Params) => {
      const now = Date.now()
      const remainingTime = delay - (now - lastCall.current)

      if (remainingTime <= 0) {
        if (timeout.current) {
          clearTimeout(timeout.current)
          timeout.current = null
        }
        lastCall.current = now
        callback(...args)
      } else if (!timeout.current) {
        timeout.current = setTimeout(() => {
          lastCall.current = Date.now()
          timeout.current = null
          callback(...args)
        }, remainingTime)
      }
    },
    [callback, delay]
  )
}

let supabase: any = null;

// Initialize supabase client
const getSupabaseClient = async () => {
  if (!supabase) {
    const { createClient } = await import('@/lib/supabase/client');
    supabase = await createClient();
  }
  return supabase;
};

// Curated collaboration colors that match the project's design system
const COLLABORATION_COLORS = [
  '#8b5cf6', // violet-500 (matches component purple)
  '#3b82f6', // blue-500 (matches primary/selection)
  '#14b8a6', // teal-500 (matches interactions)
  '#10b981', // emerald-500 (fresh green)
  '#f59e0b', // amber-500 (warm accent)
  '#ec4899', // pink-500 (vibrant contrast)
  '#06b6d4', // cyan-500 (cool blue)
  '#6366f1', // indigo-500 (deep purple-blue)
];

const generateRandomColor = () => COLLABORATION_COLORS[Math.floor(Math.random() * COLLABORATION_COLORS.length)]

// Use a more stable user ID based on email or user ID
const generateUserId = (username: string) => {
  return username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
}

const EVENT_NAME = 'realtime-cursor-move'

type CursorEventPayload = {
    position: {
        x: number
        y: number
    }
    user: {
        id: number
        name: string
        authId?: string // Actual auth user ID for lock comparison
    }
    color: string
    timestamp: number
    selectedLayerId?: string | null
    isEditing?: boolean
    lockedLayerId?: string | null
}

export const useRealtimeCursors = ({
  roomName,
  username,
  throttleMs,
}: {
    roomName: string
    username: string
    throttleMs: number
}) => {
  const [color] = useState(generateRandomColor())
  const [userId] = useState(generateUserId(username))
  const [cursors, setCursors] = useState<Record<string, CursorEventPayload>>({})
  const cursorPayload = useRef<CursorEventPayload | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)
    
  // Get collaboration state
  const { updateUser, setConnectionStatus, setCurrentUser } = useCollaborationPresenceStore()
  const { user } = useAuthStore()
  const { selectedLayerId } = useEditorStore()
  
  // Ref to avoid stale closures and prevent channel reinitialization on user object reference changes
  const userRef = useRef(user)
  userRef.current = user
  const hasUser = !!user

  const callback = useCallback(
    (event: MouseEvent) => {
      const { clientX, clientY } = event

      const payload: CursorEventPayload = {
        position: {
          x: clientX,
          y: clientY,
        },
        user: {
          id: userId,
          name: username,
          authId: user?.id, // Include actual auth ID for lock comparison
        },
        color: color,
        timestamp: new Date().getTime(),
        selectedLayerId: selectedLayerId,
        isEditing: false, // This would be set based on actual editing state
        lockedLayerId: selectedLayerId || null,
      }

      cursorPayload.current = payload

      // Update collaboration store
      if (user) {
        updateUser(user.id, {
          cursor: { x: clientX, y: clientY },
          selected_layer_id: selectedLayerId,
          last_active: Date.now()
        })
      }

      channelRef.current?.send({
        type: 'broadcast',
        event: EVENT_NAME,
        payload: payload,
      })
    },
    [color, userId, username, selectedLayerId, user, updateUser]
  )

  const handleMouseMove = useThrottleCallback(callback, throttleMs)

  // Clear cursors when room changes
  useEffect(() => {
    setCursors({});
  }, [roomName]);

  // Cleanup stale cursors - remove if not updated in 3 seconds
  useEffect(() => {
    const STALE_THRESHOLD_MS = 3000;
    
    const interval = setInterval(() => {
      const now = Date.now();
      setCursors((prev) => {
        const updated = { ...prev };
        let changed = false;
        
        Object.keys(updated).forEach((key) => {
          if (now - updated[key].timestamp > STALE_THRESHOLD_MS) {
            delete updated[key];
            changed = true;
          }
        });
        
        return changed ? updated : prev;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const initializeChannel = async () => {
      const supabaseClient = await getSupabaseClient();
      const channel = supabaseClient.channel(roomName)

      channel
        .on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();

          const { updateUser: storeUpdateUser } = useCollaborationPresenceStore.getState();
          const currentAuthId = userRef.current?.id;
            
          // Update collaboration store with user info from presence (but NOT locks - those are handled by use-layer-locks.ts)
          Object.values(presenceState).forEach((presences: unknown) => {
            if (Array.isArray(presences)) {
              presences.forEach((presence: any) => {
                const remoteAuthId = presence.authId;
                const isRemoteUser = remoteAuthId && remoteAuthId !== currentAuthId;
                
                if (isRemoteUser) {
                  // Store user info for lock indicator display (color, email, etc.)
                  storeUpdateUser(remoteAuthId, {
                    user_id: remoteAuthId,
                    email: presence.email || presence.name || 'Unknown',
                    color: presence.color || '#3b82f6',
                    last_active: Date.now()
                  });
                }
              });
            }
          });
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: any[] }) => {
          const { removeUser } = useCollaborationPresenceStore.getState();
          
          leftPresences.forEach(function (element: any) {
            // Remove cursor when user leaves
            setCursors((prev) => {
              if (prev[element.key]) {
                delete prev[element.key]
              }
              return { ...prev }
            })
            
            // Remove user from collaboration store (locks are handled by use-layer-locks.ts)
            if (element.authId) {
              removeUser(element.authId);
            }
          })
        })
        .on('presence', { event: 'join' }, () => {
          if (!cursorPayload.current) return

          // All cursors broadcast their position when a new cursor joins
          channelRef.current?.send({
            type: 'broadcast',
            event: EVENT_NAME,
            payload: cursorPayload.current,
          })
        })
        .on('broadcast', { event: EVENT_NAME }, (data: { payload: CursorEventPayload }) => {
          const { user: remoteUser, lockedLayerId, color: remoteColor } = data.payload
          // Don't render your own cursor
          if (remoteUser.id === userId) return

          // Update collaboration store with remote user info for lock indicator display
          // (Locks are handled by use-layer-locks.ts, not here)
          if (remoteUser.authId) {
            const { updateUser: storeUpdateUser } = useCollaborationPresenceStore.getState();
            storeUpdateUser(remoteUser.authId, {
              user_id: remoteUser.authId,
              email: remoteUser.name,
              color: remoteColor,
              last_active: Date.now()
            });
          }

          setCursors((prev) => {
            if (prev[userId]) {
              delete prev[userId]
            }

            return {
              ...prev,
              [remoteUser.id]: data.payload,
            }
          })
        })
        .subscribe(async (status: any) => {
          if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
            const currentUser = userRef.current;
            await channel.track({ 
              key: userId,
              authId: currentUser?.id, // Include auth ID for lock comparison
              email: currentUser?.email || username,
              name: username,
              color: color,
              lockedLayerId: selectedLayerId || null
            })
            channelRef.current = channel
            setConnectionStatus(true)
                    
            // Set current user in collaboration store
            if (currentUser && currentUser.email) {
              setCurrentUser(currentUser.id, currentUser.email)
            }
          } else {
            setCursors({})
            channelRef.current = null
            setConnectionStatus(false)
          }
        })

    };
        
    initializeChannel();
        
    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, userId, hasUser, setConnectionStatus, setCurrentUser])

  // Update presence when selected layer changes
  useEffect(() => {
    if (channelRef.current && userId) {
      channelRef.current.track({
        key: userId,
        authId: user?.id,
        email: user?.email || username,
        name: username,
        color: color,
        lockedLayerId: selectedLayerId || null
      });
    }
  }, [selectedLayerId, userId, user?.id, user?.email, username, color]);

  useEffect(() => {
    // Handle mouse leaving the window - broadcast off-screen position
    const handleMouseLeave = () => {
      if (channelRef.current && cursorPayload.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: EVENT_NAME,
          payload: {
            ...cursorPayload.current,
            position: { x: -1000, y: -1000 }, // Off-screen to hide cursor
            timestamp: Date.now(),
          },
        });
      }
    };

    // Add event listeners
    window.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)

    // Cleanup on unmount
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [handleMouseMove])

  return { cursors }
}
