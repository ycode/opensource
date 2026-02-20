/**
 * Storage Utilities
 *
 * Shared helpers for managing files in Supabase Storage.
 */

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { SUPABASE_QUERY_LIMIT, SUPABASE_WRITE_BATCH_SIZE } from '@/lib/supabase-constants';
import { STORAGE_BUCKET } from '@/lib/asset-constants';

/**
 * Delete files from Supabase Storage in batches.
 * Best-effort: logs errors but does not throw.
 */
export async function deleteStorageFiles(paths: string[]): Promise<number> {
  if (paths.length === 0) return 0;

  const client = await getSupabaseAdmin();
  if (!client) return 0;

  let deletedCount = 0;
  for (let i = 0; i < paths.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batch = paths.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
    const { error } = await client.storage.from(STORAGE_BUCKET).remove(batch);

    if (error) {
      console.error(`Failed to delete ${batch.length} files from storage:`, error.message);
    } else {
      deletedCount += batch.length;
    }
  }

  return deletedCount;
}

/**
 * Delete storage files only if their storage_path is no longer referenced
 * by any row in the given table (neither draft nor published).
 * Safe to call after deleting DB rows — verifies before removing files.
 */
export async function cleanupOrphanedStorageFiles(
  tableName: string,
  storagePaths: string[]
): Promise<number> {
  if (storagePaths.length === 0) return 0;

  const client = await getSupabaseAdmin();
  if (!client) return 0;

  // Find which paths are still referenced by any row in the table
  const { data: existingRows } = await client
    .from(tableName)
    .select('storage_path')
    .in('storage_path', storagePaths)
    .limit(SUPABASE_QUERY_LIMIT);

  const stillReferenced = new Set(
    (existingRows || []).map(r => (r as Record<string, unknown>).storage_path as string)
  );

  const orphanedPaths = storagePaths.filter(p => !stillReferenced.has(p));

  return deleteStorageFiles(orphanedPaths);
}
