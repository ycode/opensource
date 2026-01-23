import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { storage } from '@/lib/storage';
import { parseSupabaseConfig } from '@/lib/supabase-config-parser';
import { noCache } from '@/lib/api-response';
import { getSupabaseAdmin } from '@/lib/supabase-server';

import type { CookieOptions } from '@supabase/ssr';
import type { SupabaseConfig } from '@/types';

/**
 * DELETE /api/profile
 *
 * Delete user's profile and account
 */
export async function DELETE(request: NextRequest) {
  try {
    // Get Supabase config
    const config = await storage.get<SupabaseConfig>('supabase_config');

    if (!config) {
      return noCache({ error: 'Supabase not configured' }, 500);
    }

    const credentials = parseSupabaseConfig(config);
    const cookieStore = await cookies();

    // Create Supabase client to get current user
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

    // Use admin client to delete user
    const adminClient = await getSupabaseAdmin();

    if (!adminClient) {
      return noCache({ error: 'Server configuration error' }, 500);
    }

    // Delete user using admin client
    const { error } = await adminClient.auth.admin.deleteUser(user.id);

    if (error) {
      console.error('Failed to delete user:', error);
      return noCache({ error: error.message }, 400);
    }

    // Sign out the user
    await supabase.auth.signOut();

    return noCache({
      data: {
        success: true,
        message: 'Profile deleted successfully',
      },
    });
  } catch (error) {
    console.error('Failed to delete profile:', error);
    return noCache({ error: 'Failed to delete profile' }, 500);
  }
}
