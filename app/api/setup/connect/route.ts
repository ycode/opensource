import { NextRequest } from 'next/server';
import { storage } from '@/lib/storage';
import { testSupabaseConnection } from '@/lib/supabase-server';
import { testConnectionWithString } from '@/lib/knex-client';
import { noCache } from '@/lib/api-response';

/**
 * POST /api/setup/connect
 *
 * Test and store Supabase credentials
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, anon_key, service_role_key, db_password, pooler_server } = body;

    // Validate required fields
    if (!url || !anon_key || !service_role_key || !db_password || !pooler_server) {
      return noCache(
        { error: 'Missing required fields. All fields are required.' },
        400
      );
    }

    // Test Supabase API connection
    const supabaseTestResult = await testSupabaseConnection(url, service_role_key);

    if (!supabaseTestResult.success) {
      return noCache(
        { error: supabaseTestResult.error || 'Supabase API connection test failed' },
        400
      );
    }

    // Extract project ID from URL (format: https://xxxxx.supabase.co)
    const projectId = url.replace('https://', '').replace('.supabase.co', '');

    // Construct the connection string (pooler server format: "aws-x-xx-xxxx-x.pooler.supabase.com")
    const connectionString = `postgresql://postgres.${projectId}:${encodeURIComponent(db_password)}@${pooler_server}:6543/postgres`;

    // Test database connection with Knex
    const dbTestResult = await testConnectionWithString(connectionString);

    if (!dbTestResult.success) {
      return noCache(
        { error: `Database connection failed. Please verify the database password and pooler server name.` },
        400
      );
    }

    // Store credentials in file storage
    await storage.set('supabase_config', {
      url,
      anonKey: anon_key,
      serviceRoleKey: service_role_key,
      dbPassword: db_password,
      poolerServer: pooler_server,
    });

    return noCache({
      success: true,
      message: 'Supabase connected successfully',
    });
  } catch (error) {
    console.error('Supabase connection failed:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Connection failed' },
      500
    );
  }
}

