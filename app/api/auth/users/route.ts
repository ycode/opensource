import { NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { noCache } from '@/lib/api-response';

/**
 * GET /api/auth/users
 *
 * List all users with their status (active or pending invite)
 */
export async function GET(request: NextRequest) {
  try {
    const client = await getSupabaseAdmin();

    if (!client) {
      return noCache(
        { error: 'Supabase not configured' },
        500
      );
    }

    // Fetch all users from Supabase Auth
    const { data, error } = await client.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      console.error('[users] Error listing users:', error);
      return noCache(
        { error: error.message },
        500
      );
    }

    // Separate users into active and pending
    const activeUsers: Array<{
      id: string;
      email: string;
      display_name: string | null;
      avatar_url: string | null;
      created_at: string;
      last_sign_in_at: string | null;
      email_confirmed_at: string | null;
    }> = [];

    const pendingInvites: Array<{
      id: string;
      email: string;
      invited_at: string;
    }> = [];

    for (const user of data.users) {
      // A user is "pending" if they were invited but haven't confirmed/set password
      // Check if user has confirmed their email or has ever signed in
      const hasConfirmed = user.email_confirmed_at !== null;
      const hasSignedIn = user.last_sign_in_at !== null;

      if (hasConfirmed || hasSignedIn) {
        // Get metadata - check both user_metadata and raw_user_meta_data
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userAny = user as any;
        const metadata = user.user_metadata || userAny.raw_user_meta_data || {};

        activeUsers.push({
          id: user.id,
          email: user.email || '',
          display_name: metadata.display_name || metadata.full_name || null,
          avatar_url: metadata.avatar_url || null,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at || null,
          email_confirmed_at: user.email_confirmed_at || null,
        });
      } else {
        // User was invited but hasn't completed setup
        pendingInvites.push({
          id: user.id,
          email: user.email || '',
          invited_at: user.created_at,
        });
      }
    }

    return noCache({
      data: {
        activeUsers,
        pendingInvites,
      },
    });
  } catch (error) {
    console.error('[users] Unexpected error:', error);
    return noCache(
      { error: 'Failed to fetch users' },
      500
    );
  }
}

/**
 * DELETE /api/auth/users
 *
 * Delete a user or cancel a pending invite
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return noCache(
        { error: 'User ID is required' },
        400
      );
    }

    const client = await getSupabaseAdmin();

    if (!client) {
      return noCache(
        { error: 'Supabase not configured' },
        500
      );
    }

    const { error } = await client.auth.admin.deleteUser(userId);

    if (error) {
      console.error('[users] Error deleting user:', error);
      return noCache(
        { error: error.message },
        400
      );
    }

    return noCache({
      data: { success: true },
    });
  } catch (error) {
    console.error('[users] Unexpected error:', error);
    return noCache(
      { error: 'Failed to delete user' },
      500
    );
  }
}
