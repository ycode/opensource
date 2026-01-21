import { getSupabaseAdmin } from '../supabase-server';
import type { Version, CreateVersionData, VersionEntityType, VersionHistoryItem } from '@/types';

/**
 * Version Repository
 *
 * Handles CRUD operations for version history (undo/redo functionality)
 * Uses JSON Patch format for optimized diff storage
 */

export const SNAPSHOT_INTERVAL = 10; // Store full snapshot every N versions
export const MAX_VERSIONS_PER_ENTITY = 50; // Maximum versions to keep per entity

/**
 * Create a new version entry
 * Automatically deletes oldest versions if limit is reached
 */
export async function createVersion(data: CreateVersionData): Promise<Version> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  // Enforce version limit (keep only MAX_VERSIONS_PER_ENTITY - 1 to make room for new version)
  const deleted = await enforceVersionLimit(data.entity_type, data.entity_id, MAX_VERSIONS_PER_ENTITY - 1);
  if (deleted > 0) {
  }

  // Insert new version
  const { data: result, error } = await client
    .from('versions')
    .insert({
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      action_type: data.action_type,
      description: data.description || null,
      redo: data.redo,
      undo: data.undo || null,
      snapshot: data.snapshot || null,
      previous_hash: data.previous_hash || null,
      current_hash: data.current_hash,
      session_id: data.session_id || null,
      metadata: data.metadata || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create version: ${error.message}`);
  }

  return result;
}

/**
 * Get version history for an entity
 */
export async function getVersionHistory(
  entityType: VersionEntityType,
  entityId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Version[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('versions')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch version history: ${error.message}`);
  }

  return data || [];
}

/**
 * Get version history summary (without redo/undo patch data)
 */
export async function getVersionHistorySummary(
  entityType: VersionEntityType,
  entityId: string,
  limit: number = 50
): Promise<VersionHistoryItem[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('versions')
    .select('id, action_type, description, created_at')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch version history summary: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a specific version by ID
 */
export async function getVersionById(id: string): Promise<Version | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('versions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch version: ${error.message}`);
  }

  return data;
}

/**
 * Get the latest version for an entity
 */
export async function getLatestVersion(
  entityType: VersionEntityType,
  entityId: string
): Promise<Version | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('versions')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch latest version: ${error.message}`);
  }

  return data;
}

/**
 * Get the version count for an entity (for determining when to store snapshots)
 */
export async function getVersionCount(
  entityType: VersionEntityType,
  entityId: string
): Promise<number> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { count, error } = await client
    .from('versions')
    .select('*', { count: 'exact', head: true })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  if (error) {
    throw new Error(`Failed to count versions: ${error.message}`);
  }

  return count || 0;
}

/**
 * Check if we should store a full snapshot (every N versions)
 */
export async function shouldStoreSnapshot(
  entityType: VersionEntityType,
  entityId: string
): Promise<boolean> {
  const count = await getVersionCount(entityType, entityId);
  return count > 0 && count % SNAPSHOT_INTERVAL === 0;
}

/**
 * Get the most recent snapshot for an entity
 */
export async function getLatestSnapshot(
  entityType: VersionEntityType,
  entityId: string
): Promise<{ version: Version; snapshot: object } | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('versions')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .not('snapshot', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to fetch latest snapshot: ${error.message}`);
  }

  return data?.snapshot ? { version: data, snapshot: data.snapshot as object } : null;
}

/**
 * Enforce version limit for a specific entity or all entities
 * Deletes oldest versions beyond MAX_VERSIONS_PER_ENTITY
 */
export async function enforceVersionLimit(
  entityType?: VersionEntityType,
  entityId?: string,
  maxVersions: number = MAX_VERSIONS_PER_ENTITY
): Promise<number> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  let totalDeleted = 0;

  // If specific entity provided, cleanup only that entity
  if (entityType && entityId) {
    const { data: allVersions } = await client
      .from('versions')
      .select('id')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (allVersions && allVersions.length > maxVersions) {
      const idsToDelete = allVersions.slice(maxVersions).map(v => v.id);
      const { error: deleteError } = await client
        .from('versions')
        .delete()
        .in('id', idsToDelete);

      if (!deleteError) {
        totalDeleted = idsToDelete.length;
      }
    }

    return totalDeleted;
  }

  // Otherwise, cleanup all entities
  const { data: entities } = await client
    .from('versions')
    .select('entity_type, entity_id');

  if (!entities) {
    return 0;
  }

  // Group by entity
  const entityMap = new Map<string, { entity_type: string; entity_id: string }>();
  for (const entity of entities) {
    const key = `${entity.entity_type}:${entity.entity_id}`;
    entityMap.set(key, entity);
  }

  // Cleanup each entity
  for (const { entity_type, entity_id } of entityMap.values()) {
    const deleted = await enforceVersionLimit(entity_type as VersionEntityType, entity_id, maxVersions);
    totalDeleted += deleted;
  }

  return totalDeleted;
}

/**
 * Hard delete versions older than a certain date
 * Also enforces the MAX_VERSIONS_PER_ENTITY limit for all entities
 */
export async function cleanupOldVersions(
  olderThanDays: number = 30
): Promise<number> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  let totalDeleted = 0;

  // 1. Delete versions older than cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const { data: oldVersions, error: oldError } = await client
    .from('versions')
    .delete()
    .lt('created_at', cutoffDate.toISOString())
    .select('id');

  if (oldError) {
    console.error('Failed to cleanup old versions:', oldError);
  } else {
    totalDeleted += oldVersions?.length || 0;
  }

  // 2. Enforce MAX_VERSIONS_PER_ENTITY limit for all entities
  const limitDeleted = await enforceVersionLimit();
  totalDeleted += limitDeleted;

  return totalDeleted;
}

/**
 * Get versions by session ID (for grouped operations)
 */
export async function getVersionsBySession(sessionId: string): Promise<Version[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('versions')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch versions by session: ${error.message}`);
  }

  return data || [];
}

/**
 * Delete all versions for an entity (hard delete)
 * Used when an entity is permanently deleted
 */
export async function deleteVersionsForEntity(
  entityType: VersionEntityType,
  entityId: string
): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { error } = await client
    .from('versions')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  if (error) {
    throw new Error(`Failed to delete versions: ${error.message}`);
  }
}
