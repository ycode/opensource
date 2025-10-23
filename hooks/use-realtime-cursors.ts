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

const generateRandomColor = () => `hsl(${Math.floor(Math.random() * 360)}, 100%, 70%)`

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

    useEffect(() => {
        const initializeChannel = async () => {
            const supabaseClient = await getSupabaseClient();
            const channel = supabaseClient.channel(roomName)

        channel
        .on('presence', { event: 'sync' }, () => {
            const presenceState = channel.presenceState();

            const { acquireLock } = useCollaborationPresenceStore.getState();
            
            // Update collaboration store with current presence
            Object.values(presenceState).forEach((presences: unknown) => {
                if (Array.isArray(presences)) {
                    presences.forEach((presence: any) => {
                        if (presence.key !== userId && presence.lockedLayerId) {
                            // Acquire lock in the store for the remote user
                            acquireLock(presence.lockedLayerId, presence.key);
                            // Update user in collaboration store
                            updateUser(presence.key, {
                                selected_layer_id: presence.lockedLayerId,
                                locked_layer_id: presence.lockedLayerId
                            });
                        }
                    });
                }
            });
        })
            .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: any[] }) => {
                leftPresences.forEach(function (element: any) {
                    // Remove cursor when user leaves
                    setCursors((prev) => {
                        if (prev[element.key]) {
                            delete prev[element.key]
                        }

                        return { ...prev }
                    })
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
                const { user } = data.payload
                // Don't render your own cursor
                if (user.id === userId) return

                setCursors((prev) => {
                    if (prev[userId]) {
                        delete prev[userId]
                    }

                    return {
                        ...prev,
                        [user.id]: data.payload,
                    }
                })
            })
            .subscribe(async (status: any) => {
                if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
                    await channel.track({ 
                        key: userId,
                        lockedLayerId: selectedLayerId || null
                    })
                    channelRef.current = channel
                    setConnectionStatus(true)
                    
                    // Set current user in collaboration store
                    if (user && user.email) {
                        setCurrentUser(user.id, user.email)
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
    }, [roomName, userId, user, setConnectionStatus, setCurrentUser])

    // Update presence when selected layer changes
    useEffect(() => {
        if (channelRef.current && userId) {
            channelRef.current.track({
                key: userId,
                lockedLayerId: selectedLayerId || null
            });
        }
    }, [selectedLayerId, userId]);

    useEffect(() => {
        // Add event listener for mousemove
        window.addEventListener('mousemove', handleMouseMove)

        // Cleanup on unmount
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
        }
    }, [handleMouseMove])

    return { cursors }
}
