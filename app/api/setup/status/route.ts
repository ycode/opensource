import { storage } from '@/lib/storage';
import { noCache } from '@/lib/api-response';
import { validateConnectionUrl } from '@/lib/supabase-config-parser';
import type { SupabaseConfig } from '@/types';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/setup/status
 *
 * Check if Supabase is configured and detect environment
 * Also validates URL format to catch configuration errors early
 */
export async function GET() {
  try {
    const config = await storage.get<SupabaseConfig>('supabase_config');
    const isVercel = process.env.VERCEL === '1';

    // If no config, return not configured
    if (!config) {
      return noCache({
        is_configured: false,
        is_vercel: isVercel,
      });
    }

    // Validate the connection URL format
    try {
      validateConnectionUrl(config.connectionUrl, config.dbPassword);
    } catch (validationError) {
      console.error('Invalid connection URL format:', validationError);

      return noCache({
        is_configured: false,
        is_vercel: isVercel,
        error: validationError instanceof Error
          ? validationError.message
          : 'Invalid SUPABASE_CONNECTION_URL format. Expected: postgresql://postgres.[PROJECT-ID]:[YOUR-PASSWORD]@aws-x-xx-xxxx-x.pooler.supabase.com:6543/postgres',
      });
    }

    return noCache({
      is_configured: true,
      is_vercel: isVercel,
    });
  } catch (error) {
    console.error('Setup status check failed:', error);

    return noCache(
      { error: 'Failed to check setup status' },
      500
    );
  }
}

