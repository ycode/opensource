/**
 * Supabase Browser Client
 * 
 * Client-side Supabase client for authentication and real-time features
 * Uses @supabase/ssr for proper Next.js 15 cookie handling
 */

import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;
let configPromise: Promise<{ url: string; anonKey: string }> | null = null;

/**
 * Get config from API endpoint
 * Cached to avoid multiple requests
 */
async function getSupabaseConfig(): Promise<{ url: string; anonKey: string }> {
  if (!configPromise) {
    configPromise = fetch('/api/supabase/config')
      .then(async (res) => {
        if (!res.ok) {
          const error = await res.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Failed to get Supabase config:', res.status, error);
          throw new Error(error.error || `Failed to get Supabase config (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        if (!data.data) {
          console.error('Invalid response from /api/supabase/config:', data);
          throw new Error('Invalid config response');
        }
        return data.data;
      })
      .catch((error) => {
        console.error('Error getting Supabase config:', error);
        // Reset promise so it can be retried
        configPromise = null;
        throw error;
      });
  }
  
  return configPromise;
}

/**
 * Get or create browser Supabase client
 * Fetches config from API on first call
 */
export async function createBrowserClient(): Promise<SupabaseClient> {
  if (browserClient) {
    return browserClient;
  }

  // Get config from API
  const config = await getSupabaseConfig();

  browserClient = createSupabaseBrowserClient(config.url, config.anonKey);

  return browserClient;
}

