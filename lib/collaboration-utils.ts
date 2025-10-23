/**
 * Collaboration Utility Functions
 * 
 * Helper functions for real-time collaboration features
 */

import type { CollaborationUser } from '../types';

/**
 * Generate a consistent color for a user based on their ID
 */
export function generateUserColor(userId: string): string {
  // Use a simple hash to generate consistent colors
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Convert to HSL for better color distribution
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
}

/**
 * Generate user initials from email or name
 */
export function getUserInitials(email?: string, displayName?: string): string {
  if (displayName) {
    return displayName
      .split(' ')
      .map(name => name.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  
  if (!email) {
    return 'U'; // Default fallback
  }
  
  return email
    .split('@')[0]
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Get display name from email
 */
export function getDisplayName(email?: string): string {
  if (!email) {
    return 'User';
  }
  return email.split('@')[0];
}

/**
 * Throttle function using requestAnimationFrame for smooth performance
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T,
  delay: number = 16
): T {
  let rafId: number | null = null;
  let lastExecTime = 0;
  
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastExecTime >= delay) {
      lastExecTime = now;
      return func(...args);
    }
    
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
    
    rafId = requestAnimationFrame(() => {
      lastExecTime = Date.now();
      func(...args);
    });
  }) as T;
}

/**
 * Debounce function for reducing network calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  let timeoutId: NodeJS.Timeout;
  
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T;
}

/**
 * Check if a layer is locked by another user
 */
export function isLayerLocked(
  layerId: string,
  locks: Record<string, { user_id: string; expires_at: number }>,
  currentUserId: string
): { isLocked: boolean; lockedBy?: string } {
  const lock = locks[layerId];
  
  if (!lock) {
    return { isLocked: false };
  }
  
  // Check if lock has expired
  if (Date.now() > lock.expires_at) {
    return { isLocked: false };
  }
  
  // Check if current user owns the lock
  if (lock.user_id === currentUserId) {
    return { isLocked: false };
  }
  
  return { isLocked: true, lockedBy: lock.user_id };
}

/**
 * Generate a unique notification ID
 */
export function generateNotificationId(): string {
  return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format time ago for notifications
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 1000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return `${Math.floor(diff / 86400000)}d ago`;
}

/**
 * Check if user is idle (no activity for specified time)
 */
export function isUserIdle(lastActive: number, idleThreshold: number = 30000): boolean {
  return Date.now() - lastActive > idleThreshold;
}

/**
 * Get user status based on activity
 */
export function getUserStatus(user: CollaborationUser): 'active' | 'idle' | 'away' {
  const now = Date.now();
  const timeSinceActive = now - user.last_active;
  
  if (timeSinceActive < 10000) return 'active';
  if (timeSinceActive < 30000) return 'idle';
  return 'away';
}

/**
 * Compress presence data to minimize network traffic
 */
export function compressPresenceData(user: CollaborationUser): Partial<CollaborationUser> {
  return {
    user_id: user.user_id,
    cursor: user.cursor,
    selected_layer_id: user.selected_layer_id,
    locked_layer_id: user.locked_layer_id,
    is_editing: user.is_editing,
    last_active: user.last_active,
  };
}

/**
 * Merge incoming presence data with existing data
 */
export function mergePresenceData(
  existing: Record<string, CollaborationUser>,
  incoming: Record<string, Partial<CollaborationUser>>
): Record<string, CollaborationUser> {
  const merged = { ...existing };
  
  Object.entries(incoming).forEach(([userId, userData]) => {
    if (merged[userId]) {
      merged[userId] = { ...merged[userId], ...userData };
    } else {
      // New user - we need full data
      merged[userId] = userData as CollaborationUser;
    }
  });
  
  return merged;
}
