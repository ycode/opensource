import { NextRequest } from 'next/server';
import { storage } from '@/lib/storage';
import { testSupabaseConnection } from '@/lib/supabase-server';
import { testSupabaseDirectConnection } from '@/lib/knex-client';
import { parseSupabaseConfig } from '@/lib/supabase-config-parser';
import { noCache } from '@/lib/api-response';
import type { SupabaseConfig } from '@/types';

/**
 * POST /api/setup/connect
 *
 * Test and store Supabase credentials (4 fields)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { anon_key, service_role_key, connection_url, db_password } = body;

    // Validate required fields
    if (!anon_key || !service_role_key || !connection_url || !db_password) {
      return noCache(
        { error: 'Missing required fields: anon_key, service_role_key, connection_url, db_password' },
        400
      );
    }

    // Create config object
    const config: SupabaseConfig = {
      anonKey: anon_key,
      serviceRoleKey: service_role_key,
      connectionUrl: connection_url,
      dbPassword: db_password,
    };

    // Parse and validate the config
    let credentials;
    try {
      credentials = parseSupabaseConfig(config);
    } catch (error) {
      return noCache(
        { error: error instanceof Error ? error.message : 'Invalid connection URL format' },
        400
      );
    }

    // Test Supabase API connection
    const supabaseTestResult = await testSupabaseConnection(config);
    if (!supabaseTestResult.success) {
      return noCache(
        { error: supabaseTestResult.error || 'Supabase API connection test failed' },
        400
      );
    }

    // Test database connection
    const dbTestResult = await testSupabaseDirectConnection({
      dbHost: credentials.dbHost,
      dbPort: credentials.dbPort,
      dbName: credentials.dbName,
      dbUser: credentials.dbUser,
      dbPassword: credentials.dbPassword,
    });
    if (!dbTestResult.success) {
      return noCache(
        { error: `Database connection failed: ${dbTestResult.error || 'Unknown error'}` },
        400
      );
    }

    // Store credentials
    await storage.set('supabase_config', config);

    return noCache({
      success: true,
      message: 'Supabase connected successfully',
    });
  } catch (error) {
    console.error('[Setup API] Connection failed:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Connection failed' },
      500
    );
  }
}
