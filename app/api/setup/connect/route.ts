import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { testSupabaseConnection } from '@/lib/supabase-server';
import { noCache } from '@/lib/api-response';

/**
 * POST /api/setup/connect
 * 
 * Test and store Supabase credentials
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, anon_key, service_role_key, db_password } = body;

    // Validate required fields (including db_password for migrations)
    if (!url || !anon_key || !service_role_key || !db_password) {
      return noCache(
        { error: 'Missing required fields. All fields are required.' },
        400
      );
    }

    // Test connection
    const testResult = await testSupabaseConnection(url, service_role_key);

    if (!testResult.success) {
      return noCache(
        { error: testResult.error || 'Connection test failed' },
        400
      );
    }

    // Store credentials in file storage
    await storage.set('supabase_config', {
      url,
      anonKey: anon_key,
      serviceRoleKey: service_role_key,
      dbPassword: db_password,
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

