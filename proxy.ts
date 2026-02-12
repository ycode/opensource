import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Public API routes that skip authentication.
 */
const PUBLIC_API_PREFIXES = [
  '/ycode/api/setup/',    // Setup wizard — needed before any user exists
  '/ycode/api/supabase/', // Supabase config — needed for browser client init
  '/ycode/api/auth/',     // Auth callbacks and session checks
  '/ycode/api/v1/',       // Public API — has own API key auth
];

const PUBLIC_API_EXACT = [
  '/ycode/api/revalidate', // Cache revalidation — has own secret token auth
];

/**
 * Derive the Supabase project URL and anon key from environment variables.
 * Returns null if env vars are not set (pre-setup or local dev without .env.local).
 */
function getSupabaseEnvConfig(): { url: string; anonKey: string } | null {
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_ANON_KEY;
  const connectionUrl = process.env.SUPABASE_CONNECTION_URL;

  if (!anonKey || !connectionUrl) return null;

  // Extract project ID from connection URL
  // e.g. "postgresql://postgres.abc123:..." → "abc123"
  const match = connectionUrl.match(/\/\/postgres\.([a-z0-9]+):/);
  if (!match) return null;

  return {
    url: `https://${match[1]}.supabase.co`,
    anonKey,
  };
}

function isPublicApiRoute(pathname: string, method: string): boolean {
  // POST to form-submissions is public (website visitors submitting forms)
  if (pathname === '/ycode/api/form-submissions' && method === 'POST') {
    return true;
  }

  if (PUBLIC_API_EXACT.includes(pathname)) return true;
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;

  return false;
}

/**
 * Verify Supabase session for protected API routes.
 * Returns a 401 response if not authenticated, or null to continue.
 */
async function verifyApiAuth(request: NextRequest): Promise<NextResponse | null> {
  if (isPublicApiRoute(request.nextUrl.pathname, request.method)) {
    return null;
  }

  const config = getSupabaseEnvConfig();

  // If env vars aren't set (pre-setup or local dev without .env.local), let through
  if (!config) return null;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  return null;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect API routes with auth
  if (pathname.startsWith('/ycode/api')) {
    const authResponse = await verifyApiAuth(request);
    if (authResponse) return authResponse;
  }

  // Create response
  const response = NextResponse.next();

  // Add pathname header for layout to determine dark mode
  response.headers.set('x-pathname', pathname);

  // Handle public pages (apply cache control)
  const isApiRoute = pathname.startsWith('/ycode/api');
  const isNextRoute = pathname.startsWith('/_next');
  const isLoginRoute = pathname.startsWith('/login');
  const isWelcomeRoute = pathname.startsWith('/ycode/welcome');
  const isYCodeRoute = pathname.startsWith('/ycode');
  const isPublicPage = !isApiRoute && !isNextRoute && !isLoginRoute && !isWelcomeRoute && !isYCodeRoute;

  if (isPublicPage) {
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=31536000, stale-while-revalidate=31536000'
    );
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
