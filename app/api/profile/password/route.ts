import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { storage } from '@/lib/storage';
import { parseSupabaseConfig } from '@/lib/supabase-config-parser';
import { noCache } from '@/lib/api-response';

import type { CookieOptions } from '@supabase/ssr';
import type { SupabaseConfig } from '@/types';

/**
 * PUT /api/profile/password
 *
 * Update user's password (requires current password)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || typeof currentPassword !== 'string') {
      return noCache({ error: 'Current password is required' }, 400);
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return noCache({ error: 'New password is required' }, 400);
    }

    if (newPassword.length < 6) {
      return noCache({ error: 'New password must be at least 6 characters' }, 400);
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
      password: currentPassword,
    });

    if (signInError) {
      return noCache({ error: 'Current password is incorrect' }, 400);
    }

    // Update password
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      console.error('Failed to update password:', error);
      return noCache({ error: `Failed to update password: ${error.message}` }, 400);
    }

    if (!data.user) {
      return noCache({ error: 'Password update failed - no user returned' }, 500);
    }

    return noCache({
      data: {
        success: true,
        message: 'Password updated successfully',
      },
    });
  } catch (error) {
    console.error('Failed to update password:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return noCache({ error: `Failed to update password: ${message}` }, 500);
  }
}
