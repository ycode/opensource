/**
 * Sync Utilities
 *
 * Shared logic for publishing (draft → published) and reverting (published → draft).
 * Both operations follow the same pattern with inverted is_published values.
 */

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { SUPABASE_QUERY_LIMIT, SUPABASE_WRITE_BATCH_SIZE } from '@/lib/supabase-constants';

/** Direction of the sync operation */
export type SyncDirection = 'publish' | 'revert';

/** Returns the source/target is_published flags for a given direction */
export function getSyncFlags(direction: SyncDirection) {
  return {
    source: direction === 'publish' ? false : true,
    target: direction === 'publish' ? true : false,
  } as const;
}

/**
 * Sync rows from source to target for a given table.
 * Copies all active (non-soft-deleted) rows from source side to target side
 * using upsert with the (id, is_published) composite key.
 *
 * @returns Number of rows synced
 */
export async function syncTableRows(
  tableName: string,
  direction: SyncDirection,
  options?: { ids?: string[]; excludeColumns?: string[] }
): Promise<number> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { source, target } = getSyncFlags(direction);

  let query = client
    .from(tableName)
    .select('*')
    .eq('is_published', source)
    .is('deleted_at', null)
    .limit(SUPABASE_QUERY_LIMIT);

  if (options?.ids && options.ids.length > 0) {
    query = query.in('id', options.ids);
  }

  const { data: sourceRows, error: fetchError } = await query;

  if (fetchError) {
    throw new Error(`Failed to fetch ${tableName} rows: ${fetchError.message}`);
  }

  if (!sourceRows || sourceRows.length === 0) {
    return 0;
  }

  const now = new Date().toISOString();
  const exclude = new Set(options?.excludeColumns || []);
  const targetRows = sourceRows.map(row => {
    const mapped = { ...row, is_published: target, updated_at: now };
    for (const col of exclude) delete (mapped as Record<string, unknown>)[col];
    return mapped;
  });

  for (let i = 0; i < targetRows.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batch = targetRows.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
    const { error: upsertError } = await client
      .from(tableName)
      .upsert(batch, { onConflict: 'id,is_published' });

    if (upsertError) {
      throw new Error(`Failed to sync ${tableName}: ${upsertError.message}`);
    }
  }

  return targetRows.length;
}

export interface CleanupResult {
  deleted: number;
  preservedIds: string[];
  /** Values collected from orphaned rows for the columns specified in options.collectColumns */
  collected: Record<string, string[]>;
}

/**
 * Remove orphaned rows on the target side that have no counterpart on the source side.
 * For revert: deletes draft-only rows (never published).
 * For publish: deletes published-only rows (draft was deleted).
 *
 * @param options.preserveFilter - Protect orphan rows where column equals value; their IDs are returned in preservedIds.
 * @param options.excludeByColumn - Protect orphan rows where the given column's value is in the provided Set.
 * @param options.collectColumns - Column names to collect from orphaned rows before deletion (e.g. ['storage_path']).
 * @returns Deleted count, preserved orphan IDs, and collected column values
 */
export async function cleanupOrphanedRows(
  tableName: string,
  direction: SyncDirection,
  options?: {
    preserveFilter?: { column: string; value: unknown };
    excludeByColumn?: { column: string; ids: Set<string> };
    collectColumns?: string[];
  }
): Promise<CleanupResult> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { source, target } = getSyncFlags(direction);

  // Get all source IDs
  const { data: sourceRows, error: sourceError } = await client
    .from(tableName)
    .select('id')
    .eq('is_published', source)
    .is('deleted_at', null)
    .limit(SUPABASE_QUERY_LIMIT);

  if (sourceError) {
    throw new Error(`Failed to fetch source ${tableName} IDs: ${sourceError.message}`);
  }

  const sourceIds = new Set((sourceRows || []).map(r => r.id));

  // Get all target rows
  const { data: targetRows, error: targetError } = await client
    .from(tableName)
    .select('*')
    .eq('is_published', target)
    .limit(SUPABASE_QUERY_LIMIT);

  if (targetError) {
    throw new Error(`Failed to fetch target ${tableName} IDs: ${targetError.message}`);
  }

  const orphanedIds: string[] = [];
  const preservedIds: string[] = [];
  const collected: Record<string, string[]> = {};
  const { preserveFilter, excludeByColumn, collectColumns } = options || {};

  if (collectColumns) {
    for (const col of collectColumns) collected[col] = [];
  }

  for (const row of targetRows || []) {
    const r = row as Record<string, unknown>;
    const id = r.id as string;

    if (sourceIds.has(id)) continue;

    if (excludeByColumn && excludeByColumn.ids.has(r[excludeByColumn.column] as string)) {
      continue;
    }

    if (preserveFilter && r[preserveFilter.column] === preserveFilter.value) {
      preservedIds.push(id);
    } else {
      orphanedIds.push(id);
      if (collectColumns) {
        for (const col of collectColumns) {
          const val = r[col];
          if (typeof val === 'string' && val) collected[col].push(val);
        }
      }
    }
  }

  if (orphanedIds.length === 0) {
    return { deleted: 0, preservedIds, collected };
  }

  // Delete orphaned rows in batches
  let deletedCount = 0;
  for (let i = 0; i < orphanedIds.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batch = orphanedIds.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
    const { error: deleteError } = await client
      .from(tableName)
      .delete()
      .eq('is_published', target)
      .in('id', batch);

    if (deleteError) {
      throw new Error(`Failed to cleanup orphaned ${tableName}: ${deleteError.message}`);
    }

    deletedCount += batch.length;
  }

  return { deleted: deletedCount, preservedIds, collected };
}

/**
 * Sync rows filtered by a parent foreign key instead of by row ID.
 * Used for tables like page_layers and collection_item_values
 * where we sync based on a parent entity.
 *
 * @param parentColumn - The FK column to filter on (e.g. 'page_id', 'item_id')
 * @param parentIds - The parent IDs to sync for
 * @returns Number of rows synced
 */
export async function syncTableRowsByParent(
  tableName: string,
  direction: SyncDirection,
  parentColumn: string,
  parentIds: string[]
): Promise<number> {
  if (parentIds.length === 0) return 0;

  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { source, target } = getSyncFlags(direction);
  const now = new Date().toISOString();
  let totalSynced = 0;

  for (let i = 0; i < parentIds.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batchIds = parentIds.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);

    const { data: sourceRows, error: fetchError } = await client
      .from(tableName)
      .select('*')
      .eq('is_published', source)
      .is('deleted_at', null)
      .in(parentColumn, batchIds);

    if (fetchError) {
      throw new Error(`Failed to fetch ${tableName} by ${parentColumn}: ${fetchError.message}`);
    }

    if (!sourceRows || sourceRows.length === 0) continue;

    const targetRows = sourceRows.map(row => ({
      ...row,
      is_published: target,
      updated_at: now,
    }));

    for (let j = 0; j < targetRows.length; j += SUPABASE_WRITE_BATCH_SIZE) {
      const batch = targetRows.slice(j, j + SUPABASE_WRITE_BATCH_SIZE);
      const { error: upsertError } = await client
        .from(tableName)
        .upsert(batch, { onConflict: 'id,is_published' });

      if (upsertError) {
        throw new Error(`Failed to sync ${tableName} by ${parentColumn}: ${upsertError.message}`);
      }
    }

    totalSynced += targetRows.length;
  }

  return totalSynced;
}

/**
 * Remove orphaned child rows on the target side by parent FK.
 * Used after syncTableRowsByParent to clean up children whose parents were removed.
 */
export async function cleanupOrphanedChildRows(
  tableName: string,
  direction: SyncDirection,
  parentColumn: string,
  parentTable: string
): Promise<number> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { source, target } = getSyncFlags(direction);

  // Get all source parent IDs (active parents)
  const { data: sourceParents } = await client
    .from(parentTable)
    .select('id')
    .eq('is_published', source)
    .is('deleted_at', null)
    .limit(SUPABASE_QUERY_LIMIT);

  const sourceParentIds = new Set((sourceParents || []).map(r => r.id));

  // Get target child rows and find ones with orphaned parents
  const { data: targetChildren } = await client
    .from(tableName)
    .select('*')
    .eq('is_published', target)
    .limit(SUPABASE_QUERY_LIMIT);

  const orphanedIds = (targetChildren || [])
    .filter(row => !sourceParentIds.has((row as Record<string, unknown>)[parentColumn] as string))
    .map(row => (row as Record<string, unknown>).id as string);

  if (orphanedIds.length === 0) return 0;

  let deletedCount = 0;
  for (let i = 0; i < orphanedIds.length; i += SUPABASE_WRITE_BATCH_SIZE) {
    const batch = orphanedIds.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);
    const { error } = await client
      .from(tableName)
      .delete()
      .eq('is_published', target)
      .in('id', batch);

    if (error) {
      throw new Error(`Failed to cleanup orphaned ${tableName}: ${error.message}`);
    }
    deletedCount += batch.length;
  }

  return deletedCount;
}

/**
 * Count soft-deleted draft rows that still have a published counterpart.
 * Works for any table with (id, is_published, deleted_at) columns.
 */
export async function getDeletedDraftCount(tableName: string): Promise<number> {
  const client = await getSupabaseAdmin();
  if (!client) throw new Error('Supabase not configured');

  const { data: deletedDrafts, error: draftError } = await client
    .from(tableName)
    .select('id')
    .eq('is_published', false)
    .not('deleted_at', 'is', null)
    .limit(SUPABASE_QUERY_LIMIT);

  if (draftError) {
    throw new Error(`Failed to fetch deleted drafts from ${tableName}: ${draftError.message}`);
  }

  if (!deletedDrafts || deletedDrafts.length === 0) return 0;

  const { count, error: pubError } = await client
    .from(tableName)
    .select('id', { count: 'exact', head: true })
    .in('id', deletedDrafts.map(d => d.id))
    .eq('is_published', true);

  if (pubError) {
    throw new Error(`Failed to count published rows pending deletion in ${tableName}: ${pubError.message}`);
  }

  return count ?? 0;
}
