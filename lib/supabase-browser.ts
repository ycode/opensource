/**
 * Supabase Browser Client
 * 
 * Client-side Supabase client for authentication and real-time features
 * Uses @supabase/ssr for proper Next.js 15 cookie handling
 */

import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;
let configPromise: Promise<{ url: string; anonKey: string } | null> | null = null;

/**
 * Get config from API endpoint
 * Cached to avoid multiple requests
 * Returns null if Supabase is not configured (404)
 */
async function getSupabaseConfig(): Promise<{ url: string; anonKey: string } | null> {
  if (!configPromise) {
    configPromise = fetch('/ycode/api/supabase/config')
      .then(async (res) => {
        if (!res.ok) {
          // Handle 404 (not configured) gracefully - don't log, this is expected during setup
          if (res.status === 404) {
            // Silently return null - Supabase not configured yet
            return null;
          }
          
          // For other errors (500, etc.), log but don't throw
          const error = await res.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Failed to get Supabase config:', res.status, error);
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data || !data.data) {
          return null;
        }
        return data.data;
      })
      .catch((error) => {
        console.error('Error getting Supabase config:', error);
        // Reset promise so it can be retried
        configPromise = null;
        return null;
      });
  }
  
  return configPromise;
}

/**
 * Get or create browser Supabase client
 * Fetches config from API on first call
 * Returns null if Supabase is not configured
 */
export async function createBrowserClient(): Promise<SupabaseClient | null> {
  if (browserClient) {
    return browserClient;
  }

  // Get config from API
  const config = await getSupabaseConfig();

  // If config is missing, return null (expected during setup)
  if (!config) {
    return null;
  }

  browserClient = createSupabaseBrowserClient(config.url, config.anonKey);

  return browserClient;
}
