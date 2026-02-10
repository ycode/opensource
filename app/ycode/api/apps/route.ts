import { getAllApps } from '@/lib/apps/registry';
import { getConnectedAppIds } from '@/lib/repositories/appSettingsRepository';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /ycode/api/apps
 * List all available apps with their connection status
 */
export async function GET() {
  try {
    const registeredApps = getAllApps();
    const connectedIds = await getConnectedAppIds();
    const connectedSet = new Set(connectedIds);

    const appsWithStatus = registeredApps.map((app) => ({
      ...app,
      connected: connectedSet.has(app.id),
    }));

    return noCache({ data: appsWithStatus });
  } catch (error) {
    console.error('Error fetching apps:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch apps' },
      500
    );
  }
}
