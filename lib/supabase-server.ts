import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { storage } from './storage';
import { parseSupabaseConfig } from './supabase-config-parser';
import type { SupabaseConfig, SupabaseCredentials } from '@/types';

/**
 * Supabase Server Client
 *
 * Creates authenticated Supabase clients for server-side operations
 * Credentials are fetched from file-based storage or environment variables
 */

/**
 * Get Supabase credentials from storage
 * Parses the stored config to extract all necessary details
 */
async function getSupabaseCredentials(): Promise<SupabaseCredentials | null> {
  const config = await storage.get<SupabaseConfig>('supabase_config');

  if (!config) {
    return null;
  }

  try {
    return parseSupabaseConfig(config);
  } catch (error) {
    console.error('[getSupabaseCredentials] Failed to parse config:', error);
    return null;
  }
}

/**
 * Get Supabase configuration (exported for use in knex-client)
 * Alias for getSupabaseCredentials
 */
export const getSupabaseConfig = getSupabaseCredentials;

let cachedClient: SupabaseClient | null = null;
let cachedCredentials: string | null = null;

/**
 * Get Supabase client with service role key (admin access)
 */
export async function getSupabaseAdmin(tenantId?: string): Promise<SupabaseClient | null> {
  const credentials = await getSupabaseCredentials();

  if (!credentials) {
    console.error('[getSupabaseAdmin] No credentials returned!');
    return null;
  }

  // Cache client if credentials haven't changed
  const credKey = `${credentials.projectUrl}:${credentials.serviceRoleKey}`;
  if (cachedClient && cachedCredentials === credKey) {
    return cachedClient;
  }

  // Create new client
  cachedClient = createClient(credentials.projectUrl, credentials.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  cachedCredentials = credKey;

  return cachedClient;
}

/**
 * Test Supabase connection with full config
 */
export async function testSupabaseConnection(
  config: SupabaseConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    // Parse the config to get the API URL
    const credentials = parseSupabaseConfig(config);

    const client = createClient(credentials.projectUrl, credentials.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Test connection by trying to list users (requires service role key)
    // This verifies both connection and authentication
    const { error } = await client.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Get tenant ID from request headers.
 *
 * Opensource: always returns null (single-tenant, no tenant scoping needed).
 * Cloud overlay: overridden to read x-tenant-id header set by middleware.
 */
export async function getTenantIdFromHeaders(): Promise<string | null> {
  return null;
}

/**
 * Execute raw SQL query
 */
export async function executeSql(sql: string): Promise<{ success: boolean; error?: string }> {
  const client = await getSupabaseAdmin();

  if (!client) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { error } = await client.rpc('exec_sql', { sql });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'SQL execution failed',
    };
  }
}
