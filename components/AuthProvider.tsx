'use client';

/**
 * Auth Provider
 * 
 * Initializes authentication state on app mount
 */

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <>{children}</>;
}

