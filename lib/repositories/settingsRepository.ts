/**
 * Settings Repository
 *
 * Data access layer for application settings stored in the database
 */

import { getSupabaseAdmin } from '../supabase-server';
import type { Setting } from '@/types';

/**
 * Get all settings
 *
 * @returns Promise resolving to all settings
 */
export async function getAllSettings(): Promise<Setting[]> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { data, error } = await client
    .from('settings')
    .select('*')
    .order('key', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch settings: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a setting by key
 *
 * @param key - The setting key
 * @returns Promise resolving to the setting value or null if not found
 */
export async function getSettingByKey(key: string): Promise<any | null> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { data, error } = await client
    .from('settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    throw new Error(`Failed to fetch setting: ${error.message}`);
  }

  return data?.value || null;
}

/**
 * Set a setting value (insert or update)
 *
 * @param key - The setting key
 * @param value - The value to store
 * @returns Promise resolving to the created/updated setting
 */
export async function setSetting(key: string, value: any): Promise<Setting> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { data, error } = await client
    .from('settings')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'key',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to set setting: ${error.message}`);
  }

  return data;
}
