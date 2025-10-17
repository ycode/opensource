import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';

/**
 * GET /api/supabase/config
 * 
 * Returns public Supabase configuration (URL and anon key only)
 * Used by browser client for authentication
 */
export async function GET() {
  try {
    console.log('GET /api/supabase/config - Fetching config from storage...');
    
    const config = await storage.get<{
      url: string;
      anonKey: string;
      serviceRoleKey: string;
    }>('supabase_config');

    console.log('Config from storage:', config ? 'Found' : 'Not found');

    if (!config) {
      console.error('Supabase config not found in storage');
      return NextResponse.json(
        { error: 'Supabase not configured. Please complete the setup wizard first.' },
        { status: 404 }
      );
    }

    console.log('Returning public config (url + anonKey)');
    
    // Only return public config (not service role key)
    return NextResponse.json({
      data: {
        url: config.url,
        anonKey: config.anonKey,
      },
    });
  } catch (error) {
    console.error('Failed to get Supabase config:', error);
    
    return NextResponse.json(
      { error: `Failed to get configuration: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

