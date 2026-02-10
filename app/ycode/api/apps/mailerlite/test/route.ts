import { NextRequest } from 'next/server';
import { testApiKey } from '@/lib/apps/mailerlite';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /ycode/api/apps/mailerlite/test
 * Test a MailerLite API key
 *
 * Body: { api_key: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { api_key } = body;

    if (!api_key || typeof api_key !== 'string') {
      return noCache({ error: 'API key is required' }, 400);
    }

    const result = await testApiKey(api_key);

    return noCache({ data: result });
  } catch (error) {
    console.error('Error testing MailerLite API key:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to test API key' },
      500
    );
  }
}
