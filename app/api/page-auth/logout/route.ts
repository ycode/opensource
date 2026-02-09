import { NextResponse } from 'next/server';
import { PAGE_AUTH_COOKIE_NAME } from '@/lib/page-auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/page-auth/logout
 *
 * Clear the page auth cookie, logging out of all protected pages/folders.
 */
export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });

  // Clear the cookie by setting maxAge to 0
  response.cookies.set(PAGE_AUTH_COOKIE_NAME, '', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
