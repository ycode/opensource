/**
 * Simple file-based storage for Supabase credentials.
 * Stores credentials in a JSON file that's gitignored.
 */

import fs from 'fs/promises';
import path from 'path';

const STORAGE_FILE = path.join(process.cwd(), '.credentials.json');

interface StorageData {
  [key: string]: any;
}

/**
 * Get a value from storage
 */
export async function get<T = any>(key: string): Promise<T | null> {
  try {
    console.log(`[Storage] Getting key "${key}" from ${STORAGE_FILE}`);
    const data = await readStorage();
    const value = data[key] as T || null;
    console.log(`[Storage] Key "${key}" ${value ? 'found' : 'not found'}`);
    return value;
  } catch (error) {
    console.error(`[Storage] Error getting key "${key}":`, error);
    // File doesn't exist yet
    return null;
  }
}

/**
 * Set a value in storage
 */
export async function set(key: string, value: any): Promise<void> {
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

