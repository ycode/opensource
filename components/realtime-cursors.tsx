'use client'

import { Cursor } from '@/components/cursor'
import { useRealtimeCursors } from '@/hooks/use-realtime-cursors'

// Faster updates for snappier feel
const THROTTLE_MS = 30

export const RealtimeCursors = ({ roomName, username }: { roomName: string; username: string }) => {
  const { cursors } = useRealtimeCursors({ roomName, username, throttleMs: THROTTLE_MS })

  return (
    <div>
      {Object.keys(cursors).map((id) => {
        const cursor = cursors[id];
        // Don't render cursors that are off-screen (mouse left window)
        if (cursor.position.x < 0 || cursor.position.y < 0) return null;
        
        return (
          <Cursor
            key={id}
            className="fixed z-50"
            style={{
              top: 0,
              left: 0,
              transform: `translate(${cursor.position.x}px, ${cursor.position.y}px)`,
              // No transition for instant updates
            }}
            color={cursor.color}
            name={cursor.user.name}
          />
        );
      })}
    </div>
  )
}
