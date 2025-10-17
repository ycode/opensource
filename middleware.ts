import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check route types
  const isYCodeRoute = pathname.startsWith('/ycode');
  const isLoginRoute = pathname.startsWith('/login');
  const isWelcomeRoute = pathname.startsWith('/welcome');
  const isApiRoute = pathname.startsWith('/api');
  const isNextRoute = pathname.startsWith('/_next');

  // Note: Auth protection is handled at the page component level
  // using useEffect + useAuthStore, not in middleware
  // This avoids Edge Runtime limitations with file system access

  // Handle public pages (apply cache control)
  const isPublicPage = !isApiRoute && !isNextRoute && !isLoginRoute && !isWelcomeRoute && !isYCodeRoute;

  if (isPublicPage) {
    const response = NextResponse.next();
    
    // Set cache control headers
    // In production, this will be respected by Vercel's CDN
    // In development, it helps with browser caching
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=60, stale-while-revalidate=120, max-age=0, must-revalidate'
    );
    
    // Add Vary header to ensure proper cache behavior
    response.headers.set('Vary', 'Accept-Encoding');
    
    return response;
  }

  return NextResponse.next();
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


