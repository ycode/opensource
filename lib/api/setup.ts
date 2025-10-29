/**
 * Setup API Client
 * 
 * Handles communication with Next.js setup API routes
 */

import type { ApiResponse, SupabaseConfig } from '@/types';

/**
 * Check if setup is complete
 */
export async function checkSetupStatus(): Promise<{
  is_configured: boolean;
}> {
  const response = await fetch('/api/setup/status');

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Connect Supabase credentials
 */
export async function connectSupabase(
  config: SupabaseConfig
): Promise<ApiResponse<void>> {
  const response = await fetch('/api/setup/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: config.url,
      anon_key: config.publishable_key,
      service_role_key: config.secret_key,
      db_password: config.db_password,
    }),
  });

  return response.json();
}

/**
 * Get migration status (completed and pending)
 */
export async function getMigrationStatus(): Promise<
  ApiResponse<{
    completed: Array<{ name: string; batch: number; migration_time: Date }>;
    pending: string[];
    completedCount: number;
    pendingCount: number;
  }>
> {
  const response = await fetch('/api/setup/migrate');

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Run Supabase migrations
 */
export async function runMigrations(): Promise<ApiResponse<void>> {
  const response = await fetch('/api/setup/migrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  return response.json();
}

/**
 * Complete setup (no-op now, kept for compatibility)
 */
export async function completeSetup(): Promise<
  ApiResponse<{ redirect_url: string }>
> {
  return {
    data: {
      redirect_url: '/ycode',
    },
  };
}


