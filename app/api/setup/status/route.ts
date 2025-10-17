import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/setup/status
 * 
 * Check if Supabase is configured and detect environment
 */
export async function GET() {
  try {
    const config = await storage.get('supabase_config');
    const configured = !!config;
    const isVercel = process.env.VERCEL === '1';

    return noCache({
      is_configured: configured,
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

