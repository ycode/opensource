import { getGroups } from '@/lib/apps/mailerlite';
import { getAppSettingValue } from '@/lib/repositories/appSettingsRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /ycode/api/apps/mailerlite/groups
 * Fetch subscriber groups from MailerLite (proxied)
 */
export async function GET() {
  try {
    const apiKey = await getAppSettingValue<string>('mailerlite', 'api_key');

    if (!apiKey) {
      return noCache(
        { error: 'MailerLite API key not configured' },
        400
      );
    }

    const groups = await getGroups(apiKey);

    return noCache({ data: groups });
  } catch (error) {
    console.error('Error fetching MailerLite groups:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch groups' },
      500
    );
  }
}
