import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { storage } from '@/lib/storage';
import { cookies } from 'next/headers';

/**
 * GET /api/auth/session
 * 
 * Get current user session
 */
export async function GET(request: NextRequest) {
  try {
    // Get Supabase config
    const config = await storage.get<{
      url: string;
      anonKey: string;
      serviceRoleKey: string;
    }>('supabase_config');

    if (!config) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();

    // Create Supabase client
    const supabase = createServerClient(
      config.url,
      config.anonKey,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    // Get session
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }

    return NextResponse.json({
      data: {
        session,
        user: session?.user || null,
      },
    });
  } catch (error) {
    console.error('Session check failed:', error);
    
    return NextResponse.json(
      { error: 'Session check failed' },
      { status: 500 }
    );
  }
}

