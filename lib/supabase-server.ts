import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { storage } from './storage';

/**
 * Supabase Server Client
 * 
 * Creates authenticated Supabase clients for server-side operations
 * Credentials are fetched from file-based storage
 */

interface SupabaseCredentials {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

/**
 * Get Supabase credentials from storage
 */
async function getSupabaseCredentials(): Promise<SupabaseCredentials | null> {
  return await storage.get<SupabaseCredentials>('supabase_config');
}

let cachedClient: SupabaseClient | null = null;
let cachedCredentials: string | null = null;

/**
 * Get Supabase client with service role key (admin access)
 */
export async function getSupabaseAdmin(): Promise<SupabaseClient | null> {
  console.log('[getSupabaseAdmin] Getting credentials...');
  const credentials = await getSupabaseCredentials();
  
  if (!credentials) {
    console.error('[getSupabaseAdmin] No credentials returned!');
    return null;
  }

  console.log('[getSupabaseAdmin] Got credentials:', {
    url: credentials.url ? '✓' : '✗',
    anonKey: credentials.anonKey ? '✓' : '✗',
    serviceRoleKey: credentials.serviceRoleKey ? '✓' : '✗',
  });

  // Cache client if credentials haven't changed
  const credKey = `${credentials.url}:${credentials.serviceRoleKey}`;
  if (cachedClient && cachedCredentials === credKey) {
    console.log('[getSupabaseAdmin] Using cached client');
    return cachedClient;
  }

  // Create new client
  console.log('[getSupabaseAdmin] Creating new Supabase client');
  cachedClient = createClient(credentials.url, credentials.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  
  cachedCredentials = credKey;
  
  return cachedClient;
}

/**
 * Test Supabase connection
 */
export async function testSupabaseConnection(
  url: string,
  serviceRoleKey: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    
    // Test connection by trying to list users (requires service role key)
    // This verifies both connection and authentication
    const { data, error } = await client.auth.admin.listUsers({
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

