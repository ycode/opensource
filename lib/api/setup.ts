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
  const response = await fetch('/ycode/api/setup/status');

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Connect Supabase credentials (4 fields)
 */
export async function connectSupabase(
  config: SupabaseConfig
): Promise<ApiResponse<void>> {
  const response = await fetch('/ycode/api/setup/connect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      anon_key: config.anonKey,
      service_role_key: config.serviceRoleKey,
      connection_url: config.connectionUrl,
      db_password: config.dbPassword,
    }),
  });

  return response.json();
}

/**
 * Run Supabase migrations (checks and runs if needed)
 */
export async function runMigrations(): Promise<ApiResponse<void>> {
  const response = await fetch('/ycode/api/setup/migrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  return response.json();
}

/**
 * Complete setup (no-op now, kept for compatibility)
 */
export async function completeSetup(): Promise<ApiResponse<{ redirect_url: string }>> {
  return {
    data: {
      redirect_url: '/ycode',
    },
  };
}
