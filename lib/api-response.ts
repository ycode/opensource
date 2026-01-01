import { NextResponse } from 'next/server';

/**
 * Create a JSON response with aggressive no-cache headers
 * 
 * This ensures that API responses are NEVER cached by:
 * - Next.js cache
 * - Vercel CDN
 * - Browser cache
 * - Any intermediate proxy
 * 
 * @param data - The data to return
 * @param status - HTTP status code (default: 200)
 */
export function noCache<T = Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      // Standard HTTP cache prevention
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      
      // Vercel-specific cache prevention
      'CDN-Cache-Control': 'no-store',
      'Vercel-CDN-Cache-Control': 'no-store',
      
      // Additional surrogate control
      'Surrogate-Control': 'no-store',
    },
  });
}
