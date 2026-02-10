import { NextRequest } from 'next/server';
import {
  getAppSettings,
  setAppSetting,
  deleteAllAppSettings,
} from '@/lib/repositories/appSettingsRepository';
import { getAppById } from '@/lib/apps/registry';
import { noCache } from '@/lib/api-response';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /ycode/api/apps/[appId]/settings
 * Get all settings for a specific app
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params;

    const app = getAppById(appId);
    if (!app) {
      return noCache({ error: 'App not found' }, 404);
    }

    const settings = await getAppSettings(appId);

    // Convert to a key-value map for easier consumption
    const settingsMap: Record<string, unknown> = {};
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }

    return noCache({ data: settingsMap });
  } catch (error) {
    console.error('Error fetching app settings:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch app settings' },
      500
    );
  }
}

/**
 * PUT /ycode/api/apps/[appId]/settings
 * Update settings for a specific app
 *
 * Body: { [key]: value, ... }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params;

    const app = getAppById(appId);
    if (!app) {
      return noCache({ error: 'App not found' }, 404);
    }

    const body = await request.json();

    // Update each setting
    for (const [key, value] of Object.entries(body)) {
      await setAppSetting(appId, key, value);
    }

    // Return updated settings
    const settings = await getAppSettings(appId);
    const settingsMap: Record<string, unknown> = {};
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }

    return noCache({ data: settingsMap });
  } catch (error) {
    console.error('Error updating app settings:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to update app settings' },
      500
    );
  }
}

/**
 * DELETE /ycode/api/apps/[appId]/settings
 * Delete all settings for a specific app (disconnect)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params;

    const app = getAppById(appId);
    if (!app) {
      return noCache({ error: 'App not found' }, 404);
    }

    await deleteAllAppSettings(appId);

    return noCache({ message: 'App disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting app:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to disconnect app' },
      500
    );
  }
}
