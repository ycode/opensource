import { getSupabaseAdmin } from '../supabase-server';

/**
 * App Settings Repository
 *
 * Generic key-value store for app integration settings.
 * Each app stores its configuration (API keys, connections, etc.) here.
 */

// =============================================================================
// Types
// =============================================================================

export interface AppSetting {
  id: string;
  app_id: string;
  key: string;
  value: unknown;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Read Operations
// =============================================================================

/**
 * Get all settings for a specific app
 */
export async function getAppSettings(appId: string): Promise<AppSetting[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('app_settings')
    .select('*')
    .eq('app_id', appId)
    .order('key', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch app settings: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a specific setting for an app
 */
export async function getAppSetting(
  appId: string,
  key: string
): Promise<AppSetting | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('app_settings')
    .select('*')
    .eq('app_id', appId)
    .eq('key', key)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch app setting: ${error.message}`);
  }

  return data;
}

/**
 * Get a setting value directly (convenience helper)
 */
export async function getAppSettingValue<T = unknown>(
  appId: string,
  key: string
): Promise<T | null> {
  const setting = await getAppSetting(appId, key);
  return setting ? (setting.value as T) : null;
}

/**
 * Check if an app has a specific setting configured
 */
export async function hasAppSetting(
  appId: string,
  key: string
): Promise<boolean> {
  const setting = await getAppSetting(appId, key);
  return setting !== null;
}

/**
 * Get all app IDs that have settings configured (i.e. connected apps)
 */
export async function getConnectedAppIds(): Promise<string[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('app_settings')
    .select('app_id')
    .order('app_id');

  if (error) {
    throw new Error(`Failed to fetch connected apps: ${error.message}`);
  }

  // Deduplicate app IDs
  const appIds = new Set((data || []).map((row: { app_id: string }) => row.app_id));
  return Array.from(appIds);
}

// =============================================================================
// Write Operations
// =============================================================================

/**
 * Set a setting value for an app (upsert)
 */
export async function setAppSetting(
  appId: string,
  key: string,
  value: unknown
): Promise<AppSetting> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('app_settings')
    .upsert(
      {
        app_id: appId,
        key,
        value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'app_id,key' }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to set app setting: ${error.message}`);
  }

  return data;
}

/**
 * Delete a specific setting for an app
 */
export async function deleteAppSetting(
  appId: string,
  key: string
): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await client
    .from('app_settings')
    .delete()
    .eq('app_id', appId)
    .eq('key', key);

  if (error) {
    throw new Error(`Failed to delete app setting: ${error.message}`);
  }
}

/**
 * Delete all settings for an app (disconnect)
 */
export async function deleteAllAppSettings(appId: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await client
    .from('app_settings')
    .delete()
    .eq('app_id', appId);

  if (error) {
    throw new Error(`Failed to delete app settings: ${error.message}`);
  }
}
