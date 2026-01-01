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
        console.log('Supabase config loaded successfully');
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
export async function createClient(): Promise<SupabaseClient> {
  if (browserClient) {
    return browserClient;
  }

  // Get config from API
  const config = await getSupabaseConfig();

  browserClient = createSupabaseBrowserClient(
    config.url,
    config.anonKey,
    {
      cookies: {
        get(name: string) {
          if (typeof document === 'undefined') return undefined;
          
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          
          if (parts.length === 2) {
            return parts.pop()?.split(';').shift();
          }
          
          return undefined;
        },
        set(name: string, value: string, options: any) {
          if (typeof document === 'undefined') return;
          
          let cookie = `${name}=${value}`;
          
          if (options.maxAge) {
            cookie += `; max-age=${options.maxAge}`;
          }
          if (options.path) {
            cookie += `; path=${options.path}`;
          }
          if (options.sameSite) {
            cookie += `; samesite=${options.sameSite}`;
          }
          if (options.secure) {
            cookie += '; secure';
          }
          
          document.cookie = cookie;
        },
        remove(name: string, options: any) {
          if (typeof document === 'undefined') return;
          
          this.set(name, '', { ...options, maxAge: 0 });
        },
      },
    }
  );

  return browserClient;
}
