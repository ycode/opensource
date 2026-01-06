/**
 * Collaboration Utility Functions
 * 
 * Helper functions for real-time collaboration features
 */

import type { CollaborationUser } from '../types';

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

/**
 * Generate a consistent color for a user based on their ID
 * Uses a curated palette that matches the project's design
 */
export function generateUserColor(userId: string): string {
  // Use a simple hash to get consistent index
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Pick from curated palette
  const index = Math.abs(hash) % COLLABORATION_COLORS.length;
  return COLLABORATION_COLORS[index];
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
