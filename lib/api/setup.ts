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
    }),
  });

  return response.json();
}

/**
 * Get list of available migrations
 */
export async function getMigrationSQL(): Promise<
  ApiResponse<{ sql: string; instructions: string }>
> {
  const response = await fetch('/api/setup/migrate');

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  
  // Extract SQL from migration objects and combine
  const sqlContent = data.migrations
    ?.map((m: { filename: string; sql: string }) => {
      return `-- ${m.filename}\n${m.sql}\n`;
    })
    .join('\n') || '';
  
  // Return in expected format
  return {
    data: {
      sql: sqlContent,
      instructions: `Found ${data.count || 0} migration files`,
    },
  };
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


