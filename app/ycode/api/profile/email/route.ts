import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { storage } from '@/lib/storage';
import { parseSupabaseConfig } from '@/lib/supabase-config-parser';
import { noCache } from '@/lib/api-response';

import type { CookieOptions } from '@supabase/ssr';
import type { SupabaseConfig } from '@/types';

/**
 * PUT /ycode/api/profile/email
 *
 * Update user's email address (requires password confirmation)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || typeof email !== 'string') {
      return noCache({ error: 'Email is required' }, 400);
    }

    if (!password || typeof password !== 'string') {
      return noCache({ error: 'Password is required to change email' }, 400);
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

    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (signInError) {
      return noCache({ error: 'Incorrect password' }, 400);
    }

    // Update email
    const { data, error } = await supabase.auth.updateUser({
      email: email.trim(),
    });

    if (error) {
      return noCache({ error: error.message }, 400);
    }

    return noCache({
      data: {
        user: data.user,
        message: 'Email update initiated. Check your new email for confirmation.',
      },
    });
  } catch (error) {
    console.error('Failed to update email:', error);
    return noCache({ error: 'Failed to update email' }, 500);
  }
}
