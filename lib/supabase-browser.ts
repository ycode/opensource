/**
 * Supabase Browser Client
 *
 * Client-side Supabase client for authentication and real-time features.
 * Uses @supabase/ssr for proper Next.js 15 cookie handling.
 *
 * Two exports:
 * - createBrowserClient() — returns null if not configured (safe for setup flow)
 * - createClient() — throws if not configured (for features that require Supabase)
 */

import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;
let configPromise: Promise<{ url: string; anonKey: string } | null> | null = null;

/**
 * Get config from API endpoint.
 * Cached to avoid multiple requests. Returns null if not configured (404).
 */
async function getSupabaseConfig(): Promise<{ url: string; anonKey: string } | null> {
  if (!configPromise) {
    configPromise = fetch('/ycode/api/supabase/config')
      .then(async (res) => {
        if (!res.ok) {
          // Handle 404 (not configured) gracefully - expected during setup
          if (res.status === 404) {
            return null;
          }

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

/** Build or return the cached SupabaseClient instance. */
async function getOrCreateClient(): Promise<SupabaseClient | null> {
  if (browserClient) return browserClient;

  const config = await getSupabaseConfig();
  if (!config) return null;

  browserClient = createSupabaseBrowserClient(config.url, config.anonKey);
  return browserClient;
}

/**
 * Get browser Supabase client (null-safe).
 * Returns null if Supabase is not configured — use during setup flow.
 */
export async function createBrowserClient(): Promise<SupabaseClient | null> {
  return getOrCreateClient();
}

/**
 * Get browser Supabase client (throws if not configured).
 * Use for features that require a working Supabase connection (realtime, auth, etc).
 */
export async function createClient(): Promise<SupabaseClient> {
  const client = await getOrCreateClient();

  if (!client) {
    throw new Error('Supabase is not configured');
  }

  return client;
}
