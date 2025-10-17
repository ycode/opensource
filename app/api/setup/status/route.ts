import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';

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

    return NextResponse.json({
      is_configured: configured,
      is_vercel: isVercel,
    });
  } catch (error) {
    console.error('Setup status check failed:', error);
    
    return NextResponse.json(
      { error: 'Failed to check setup status' },
      { status: 500 }
    );
  }
}

