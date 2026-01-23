import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { storage } from '@/lib/storage';
import { parseSupabaseConfig } from '@/lib/supabase-config-parser';
import { noCache } from '@/lib/api-response';

import type { CookieOptions } from '@supabase/ssr';
import type { SupabaseConfig } from '@/types';

/**
 * PUT /api/profile/name
 *
 * Update user's display name
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return noCache({ error: 'Name is required' }, 400);
    }

    // Get Supabase config
    const config = await storage.get<SupabaseConfig>('supabase_config');

    if (!config) {
      return noCache({ error: 'Supabase not configured' }, 500);
    }

    const credentials = parseSupabaseConfig(config);
    const cookieStore = await cookies();

    // Create Supabase client
    const supabase = createServerClient(credentials.projectUrl, credentials.anonKey, {
      cookies: {
        get(cookieName: string) {
          return cookieStore.get(cookieName)?.value;
        },
        set(cookieName: string, value: string, options: CookieOptions) {
          cookieStore.set({ name: cookieName, value, ...options });
        },
        remove(cookieName: string, options: CookieOptions) {
          cookieStore.set({ name: cookieName, value: '', ...options });
        },
      },
    });

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return noCache({ error: 'Not authenticated' }, 401);
    }

    // Update user metadata
    const { data, error } = await supabase.auth.updateUser({
      data: {
        display_name: name.trim(),
        full_name: name.trim(),
      },
    });

    if (error) {
      return noCache({ error: error.message }, 400);
    }

    return noCache({
      data: {
        user: data.user,
      },
    });
  } catch (error) {
    console.error('Failed to update name:', error);
    return noCache({ error: 'Failed to update name' }, 500);
  }
}
