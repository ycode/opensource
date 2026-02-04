import { NextRequest, NextResponse } from 'next/server';
import { fetchErrorPage } from '@/lib/page-fetcher';
import { getSettingByKey } from '@/lib/repositories/settingsRepository';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /ycode/api/error-page
 * 
 * Fetch error page data by error code
 * Query params: code (404, 401, 500), published (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const published = searchParams.get('published') === 'true';

    if (!code) {
      return NextResponse.json(
        { error: 'Error code is required' },
        { status: 400 }
      );
    }

    const errorCode = parseInt(code, 10);
    if (![401, 404, 500].includes(errorCode)) {
      return NextResponse.json(
        { error: 'Invalid error code. Must be 401, 404, or 500' },
        { status: 400 }
      );
    }

    // Fetch error page
    const pageData = await fetchErrorPage(errorCode, published);

    if (!pageData) {
      return NextResponse.json(
        { error: 'Error page not found' },
        { status: 404 }
      );
    }

    // Load CSS based on published state
    const cssKey = published ? 'published_css' : 'draft_css';
    const css = await getSettingByKey(cssKey);

    return NextResponse.json({
      pageData,
      css,
    });
  } catch (error) {
    console.error('Failed to fetch error page:', error);
    return NextResponse.json(
      { error: 'Failed to fetch error page' },
      { status: 500 }
    );
  }
}
