import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check route types
  const isYCodeRoute = pathname.startsWith('/ycode');
  const isLoginRoute = pathname.startsWith('/login');
  const isWelcomeRoute = pathname.startsWith('/welcome');
  const isApiRoute = pathname.startsWith('/api');
  const isNextRoute = pathname.startsWith('/_next');

  // Note: Auth protection is handled at the page component level
  // using useEffect + useAuthStore, not in proxy
  // This avoids Edge Runtime limitations with file system access

  // Create response
  const response = NextResponse.next();

  // Add pathname header for layout to determine dark mode
  response.headers.set('x-pathname', pathname);

  // Handle public pages (apply cache control)
  const isPublicPage = !isApiRoute && !isNextRoute && !isLoginRoute && !isWelcomeRoute && !isYCodeRoute;

  if (isPublicPage) {
    // Set cache control headers
    // In production, this will be respected by Vercel's CDN
    // In development, it helps with browser caching
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=0, stale-while-revalidate=0, max-age=0, must-revalidate'
    );

    // Add Vary header to ensure proper cache behavior
    response.headers.set('Vary', 'Accept-Encoding');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
