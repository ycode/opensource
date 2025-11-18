/**
 * Storage for Supabase credentials.
 * Uses environment variables on Vercel, file-based storage locally.
 */

import fs from 'fs/promises';
import path from 'path';
import type { SupabaseConfig } from '@/types';

const STORAGE_FILE = path.join(process.cwd(), '.credentials.json');
const IS_VERCEL = process.env.VERCEL === '1';

interface StorageData {
  [key: string]: unknown;
}

/**
 * Get Supabase config from environment variables
 */
function getSupabaseConfigFromEnv(): SupabaseConfig | null {
  const { SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_CONNECTION_URL, SUPABASE_DB_PASSWORD } = process.env;

  if (SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY && SUPABASE_CONNECTION_URL && SUPABASE_DB_PASSWORD) {
    return {
      anonKey: SUPABASE_ANON_KEY,
      serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
      connectionUrl: SUPABASE_CONNECTION_URL,
      dbPassword: SUPABASE_DB_PASSWORD,
    };
  }

  console.error('[Storage] ✗ Missing required environment variables');
  return null;
}

/**
 * Get a value from storage
 * Uses environment variables on Vercel, file-based storage locally
 */
export async function get<T = unknown>(key: string): Promise<T | null> {
  try {
    // On Vercel, use environment variables for Supabase config
    if (IS_VERCEL && key === 'supabase_config') {
      return getSupabaseConfigFromEnv() as T;
    }

    // Locally, use file-based storage
    const data = await readStorage();
    const value = data[key];

    return (value as T) || null;
  } catch (error) {
    console.error(`[Storage] Error getting key "${key}":`, error);
    return null;
  }
}

/**
 * Set a value in storage
 * On Vercel, throws error directing users to set environment variables
 */
export async function set(key: string, value: unknown): Promise<void> {
  // On Vercel, we can't write to filesystem
  if (IS_VERCEL) {
    throw new Error(
      'Cannot write to file system on Vercel. Please set environment variables instead:\n' +
      '1. Go to Vercel Dashboard → Project Settings → Environment Variables\n' +
      '2. Add: SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_CONNECTION_URL, SUPABASE_DB_PASSWORD\n' +
      '3. Redeploy your application'
    );
  }

  const data = await readStorage();
  data[key] = value;
  await writeStorage(data);
}

/**
 * Delete a value from storage
 */
export async function del(key: string): Promise<void> {
  const data = await readStorage();
  delete data[key];
  await writeStorage(data);
}

/**
 * Check if storage file exists
 */
export async function exists(): Promise<boolean> {
  try {
    await fs.access(STORAGE_FILE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the entire storage file
 */
async function readStorage(): Promise<StorageData> {
  try {
    const content = await fs.readFile(STORAGE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // File doesn't exist or is invalid, return empty object
    return {};
  }
}

/**
 * Write to the storage file
 */
async function writeStorage(data: StorageData): Promise<void> {
  await fs.writeFile(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Export a storage object that mimics Vercel KV API
 */
export const storage = {
  get,
  set,
  del,
  exists,
};
