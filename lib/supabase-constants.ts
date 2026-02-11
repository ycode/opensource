/**
 * Supabase Constants
 *
 * Centralized constants for Supabase operations to avoid
 * hitting query limits and URL length restrictions.
 */

/**
 * Default row limit for Supabase queries.
 * Supabase returns max 1000 rows by default.
 * Use pagination with this batch size to fetch all records.
 */
export const SUPABASE_QUERY_LIMIT = 1000;

/**
 * Batch size for insert/update/upsert operations.
 * Smaller to avoid Supabase URL length limits on write operations.
 */
export const SUPABASE_WRITE_BATCH_SIZE = 100;
