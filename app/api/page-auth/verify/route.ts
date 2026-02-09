import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { noCache } from '@/lib/api-response';
import { parseAuthCookie, buildAuthCookieValue, PAGE_AUTH_COOKIE_NAME } from '@/lib/page-auth';

/**
 * Constant-time string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Still do a comparison to maintain constant time
    return timingSafeEqual(bufA, bufA) && false;
  }
  return timingSafeEqual(bufA, bufB);
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Simple in-memory rate limiter for password attempts
 * Tracks failed attempts by IP address
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): { allowed: boolean; remainingAttempts: number } {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  // Clean up expired entries periodically
  if (rateLimitStore.size > 10000) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!record || now > record.resetTime) {
    // No record or expired - allow and start fresh
    rateLimitStore.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    // Rate limited
    return { allowed: false, remainingAttempts: 0 };
  }

  // Increment count
  record.count++;
  return { allowed: true, remainingAttempts: RATE_LIMIT_MAX_ATTEMPTS - record.count };
}

function resetRateLimit(ip: string): void {
  rateLimitStore.delete(ip);
}

interface VerifyRequest {
  pageId?: string;
  folderId?: string;
  password: string;
  redirectUrl: string;
  isPublished?: boolean;
}

/**
 * POST /api/page-auth/verify
 *
 * Verify a password for a protected page or folder.
 * On success, sets a session cookie to track the unlocked item.
 */
export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || request.headers.get('x-real-ip') 
      || 'unknown';

    // Check rate limit
    const { allowed, remainingAttempts } = checkRateLimit(ip);
    if (!allowed) {
      return noCache({ 
        error: 'Too many password attempts. Please try again in a minute.' 
      }, 429);
    }

    const body = await request.json() as VerifyRequest;
    const { pageId, folderId, password, redirectUrl, isPublished = true } = body;

    // Validation
    if (!password || typeof password !== 'string') {
      return noCache({ error: 'Password is required' }, 400);
    }

    if (!pageId && !folderId) {
      return noCache({ error: 'Either pageId or folderId is required' }, 400);
    }

    if (!redirectUrl || typeof redirectUrl !== 'string') {
      return noCache({ error: 'Redirect URL is required' }, 400);
    }

    // Validate redirectUrl is a safe relative path (prevent open redirect attacks)
    if (!redirectUrl.startsWith('/') || redirectUrl.startsWith('//') || redirectUrl.includes('://')) {
      return noCache({ error: 'Invalid redirect URL' }, 400);
    }

    // Get Supabase client
    const supabase = await getSupabaseAdmin();
    if (!supabase) {
      return noCache({ error: 'Database not configured' }, 500);
    }

    let expectedPassword: string | null = null;
    let unlockType: 'page' | 'folder' = 'page';
    let unlockId: string = '';

    if (pageId) {
      // Fetch the page to get its password
      const { data: pages, error } = await supabase
        .from('pages')
        .select('id, settings')
        .eq('id', pageId)
        .eq('is_published', isPublished)
        .is('deleted_at', null)
        .limit(1);

      if (error) {
        return noCache({ error: 'Page not found' }, 404);
      }

      const page = pages?.[0];
      if (!page) {
        return noCache({ error: 'Page not found' }, 404);
      }

      // Handle settings - may be JSON string or object depending on database
      const settings = typeof page.settings === 'string' 
        ? JSON.parse(page.settings) 
        : page.settings;
      
      if (settings?.auth?.enabled && settings.auth.password) {
        expectedPassword = settings.auth.password;
        unlockType = 'page';
        unlockId = pageId;
      }
    }

    if (folderId && !expectedPassword) {
      // Fetch the folder to get its password
      const { data: folders, error } = await supabase
        .from('page_folders')
        .select('id, settings')
        .eq('id', folderId)
        .eq('is_published', isPublished)
        .is('deleted_at', null)
        .limit(1);

      if (error) {
        return noCache({ error: 'Folder not found' }, 404);
      }

      const folder = folders?.[0];
      if (!folder) {
        return noCache({ error: 'Folder not found' }, 404);
      }

      // Handle settings - may be JSON string or object depending on database
      const settings = typeof folder.settings === 'string' 
        ? JSON.parse(folder.settings) 
        : folder.settings;
      
      if (settings?.auth?.enabled && settings.auth.password) {
        expectedPassword = settings.auth.password;
        unlockType = 'folder';
        unlockId = folderId;
      }
    }

    if (!expectedPassword) {
      return noCache({ error: 'This item is not password protected' }, 400);
    }

    // Verify password using constant-time comparison to prevent timing attacks
    if (!safeCompare(password, expectedPassword)) {
      return noCache({ error: 'Incorrect password' }, 401);
    }

    // Password correct - update the auth cookie
    const existingCookie = await parseAuthCookie();
    const payload = existingCookie || { pages: [], folders: [] };

    if (unlockType === 'page') {
      if (!payload.pages.includes(unlockId)) {
        payload.pages.push(unlockId);
      }
    } else {
      if (!payload.folders.includes(unlockId)) {
        payload.folders.push(unlockId);
      }
    }

    // Build the signed cookie value
    const cookieValue = buildAuthCookieValue(payload);

    // Reset rate limit on successful login
    resetRateLimit(ip);

    // Create response with redirect URL
    const response = NextResponse.json({
      success: true,
      redirectUrl,
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });

    // Set the cookie on the response
    response.cookies.set(PAGE_AUTH_COOKIE_NAME, cookieValue, {
      httpOnly: false, // Needs client-side access for SPA navigation
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      // Session cookie - no maxAge, expires when browser closes
    });

    return response;
  } catch {
    return noCache({ error: 'Verification failed' }, 500);
  }
}
