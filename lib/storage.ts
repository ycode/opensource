/**
 * Storage for Supabase credentials.
 * Uses environment variables on Vercel, file-based storage locally.
 */

import fs from 'fs/promises';
import path from 'path';

const STORAGE_FILE = path.join(process.cwd(), '.credentials.json');
const IS_VERCEL = process.env.VERCEL === '1';

interface StorageData {
  [key: string]: any;
}

/**
 * Get a value from storage
 * Uses environment variables on Vercel, file-based storage locally
 */
export async function get<T = any>(key: string): Promise<T | null> {
  try {
    console.log(`[Storage] Getting key "${key}" (Vercel: ${IS_VERCEL})`);
    
    // On Vercel, use environment variables
    if (IS_VERCEL && key === 'supabase_config') {
      const url = process.env.SUPABASE_URL;
      const anonKey = process.env.SUPABASE_ANON_KEY;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const dbPassword = process.env.SUPABASE_DB_PASSWORD;
      
      if (url && anonKey && serviceRoleKey && dbPassword) {
        console.log('[Storage] Using environment variables (Vercel)');
        return {
          url,
          anonKey,
          serviceRoleKey,
          db_password: dbPassword,
        } as T;
      }
      
      console.log('[Storage] Environment variables not set or incomplete');
      return null;
    }
    
    // Locally, use file-based storage
    console.log(`[Storage] Using file storage: ${STORAGE_FILE}`);
    const data = await readStorage();
    const value = data[key] as T || null;
    console.log(`[Storage] Key "${key}" ${value ? 'found' : 'not found'}`);
    return value;
  } catch (error) {
    console.error(`[Storage] Error getting key "${key}":`, error);
    return null;
  }
}

/**
 * Set a value in storage
 * On Vercel, throws error directing users to set environment variables
 */
export async function set(key: string, value: any): Promise<void> {
  // On Vercel, we can't write to filesystem
  if (IS_VERCEL) {
    throw new Error(
      'Cannot write to file system on Vercel. Please set environment variables instead:\n' +
      '1. Go to Vercel Dashboard → Project Settings → Environment Variables\n' +
      '2. Add: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_PASSWORD\n' +
      '3. Redeploy your application'
    );
  }
  
  console.log(`[Storage] Setting key "${key}" in ${STORAGE_FILE}`);
  const data = await readStorage();
  data[key] = value;
  await writeStorage(data);
  console.log(`[Storage] Key "${key}" saved successfully`);
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

