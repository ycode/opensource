/**
 * Knex Query Helpers
 *
 * Provides tenant-aware batch update and increment helpers for raw SQL queries.
 *
 * How tenant scoping works:
 * - These helpers import getTenantIdFromHeaders() from @/lib/supabase-server
 * - In opensource: that function returns null, so no tenant conditions are added
 * - In cloud: the path alias swaps in the cloud overlay, which reads x-tenant-id
 *   from the request headers, automatically adding tenant scoping to all queries
 *
 * This means the calling code (repositories, services) stays tenant-unaware,
 * and the cloud overlay doesn't need to modify these shared files at all.
 */

import type { Knex } from 'knex';
import { getTenantIdFromHeaders } from '@/lib/supabase-server';

/**
 * Resolve tenant-aware WHERE condition for a given table.
 * Returns empty clause/params in opensource (single-tenant) mode.
 */
async function resolveTenantCondition(
  knex: Knex,
  tableName: string
): Promise<{ clause: string; params: (string | number)[] }> {
  const tenantId = await getTenantIdFromHeaders();
  if (!tenantId) return { clause: '', params: [] };

  const hasColumn = await knex.schema.hasColumn(tableName, 'tenant_id');
  if (!hasColumn) return { clause: '', params: [] };

  return { clause: 'AND tenant_id = ?', params: [tenantId] };
}

/**
 * Batch update a column using CASE statements for efficiency.
 * Automatically adds tenant scoping in cloud mode.
 *
 * Generates: UPDATE table SET "column" = CASE WHEN id = ? THEN ? ... END, updated_at = NOW()
 *            WHERE id IN (?, ...) [extraWhereClause] [AND tenant_id = ?]
 *
 * @param knex - Knex instance
 * @param tableName - Table to update
 * @param column - Column to set via CASE
 * @param updates - Array of { id, value } pairs
 * @param options - Optional extra WHERE clause, params, and cast type
 */
export async function batchUpdateColumn(
  knex: Knex,
  tableName: string,
  column: string,
  updates: Array<{ id: string; value: string | number }>,
  options?: {
    extraWhereClause?: string;
    extraWhereParams?: (string | number)[];
    castType?: string;
  }
): Promise<void> {
  if (updates.length === 0) return;

  const { extraWhereClause = '', extraWhereParams = [], castType } = options || {};
  const tenant = await resolveTenantCondition(knex, tableName);

  const cast = castType ? `::${castType}` : '';
  const caseStatements = updates.map(() => `WHEN id = ? THEN ?${cast}`).join(' ');
  const values = updates.flatMap(u => [u.id, u.value]);
  const idPlaceholders = updates.map(() => '?').join(', ');

  await knex.raw(`
    UPDATE ${tableName}
    SET "${column}" = CASE ${caseStatements} END,
        updated_at = NOW()
    WHERE id IN (${idPlaceholders})
      ${extraWhereClause}
      ${tenant.clause}
  `, [...values, ...updates.map(u => u.id), ...extraWhereParams, ...tenant.params]);
}

/**
 * Increment a column for rows matching given conditions.
 * Automatically adds tenant scoping in cloud mode.
 *
 * Generates: UPDATE table SET "column" = "column" + 1 WHERE [whereClause] [AND tenant_id = ?]
 *
 * @param knex - Knex instance
 * @param tableName - Table to update
 * @param column - Column to increment
 * @param whereClause - WHERE conditions (without leading WHERE keyword)
 * @param whereParams - Parameters for the WHERE clause
 */
export async function incrementColumn(
  knex: Knex,
  tableName: string,
  column: string,
  whereClause: string,
  whereParams: (string | number)[]
): Promise<void> {
  const tenant = await resolveTenantCondition(knex, tableName);

  await knex.raw(`
    UPDATE ${tableName}
    SET "${column}" = "${column}" + 1
    WHERE ${whereClause}
      ${tenant.clause}
  `, [...whereParams, ...tenant.params]);
}

/**
 * Add tenant filtering to a Knex query builder.
 * No-op in opensource (single-tenant) mode.
 * Adds WHERE tenant_id = ? in cloud mode.
 *
 * @param knex - Knex instance (for schema introspection)
 * @param queryBuilder - The query builder to augment
 * @param tableName - Table name (to check for tenant_id column)
 * @returns The (possibly augmented) query builder
 */
export async function addTenantFilter(
  knex: Knex,
  queryBuilder: Knex.QueryBuilder,
  tableName: string
): Promise<Knex.QueryBuilder> {
  const tenantId = await getTenantIdFromHeaders();
  if (!tenantId) return queryBuilder;

  const hasColumn = await knex.schema.hasColumn(tableName, 'tenant_id');
  if (!hasColumn) return queryBuilder;

  return queryBuilder.where('tenant_id', tenantId);
}
