import { getSupabaseAdmin } from '../supabase-server';
import type { CollectionImport, CollectionImportStatus } from '@/types';

/**
 * Collection Import Repository
 *
 * Handles CRUD operations for CSV import jobs.
 * Supports background processing with status tracking.
 */

export interface CreateImportData {
  collection_id: string;
  column_mapping: Record<string, string>;
  csv_data: Record<string, string>[];
  total_rows: number;
}

/**
 * Create a new import job
 */
export async function createImport(data: CreateImportData): Promise<CollectionImport> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data: result, error } = await client
    .from('collection_imports')
    .insert({
      collection_id: data.collection_id,
      column_mapping: data.column_mapping,
      csv_data: data.csv_data,
      total_rows: data.total_rows,
      status: 'pending',
      processed_rows: 0,
      failed_rows: 0,
      errors: [],
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create import: ${error.message}`);
  }

  return result;
}

/**
 * Get import by ID
 */
export async function getImportById(id: string): Promise<CollectionImport | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('collection_imports')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch import: ${error.message}`);
  }

  return data;
}

/**
 * Get pending or processing imports (for background processing)
 */
export async function getPendingImports(limit: number = 5): Promise<CollectionImport[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('collection_imports')
    .select('*')
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch pending imports: ${error.message}`);
  }

  return data || [];
}

/**
 * Update import status
 */
export async function updateImportStatus(
  id: string,
  status: CollectionImportStatus
): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await client
    .from('collection_imports')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update import status: ${error.message}`);
  }
}

/**
 * Update import progress
 */
export async function updateImportProgress(
  id: string,
  processedRows: number,
  failedRows: number,
  errors: string[] | null = null
): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const updateData: Record<string, unknown> = {
    processed_rows: processedRows,
    failed_rows: failedRows,
    updated_at: new Date().toISOString(),
  };

  if (errors !== null) {
    updateData.errors = errors;
  }

  const { error } = await client
    .from('collection_imports')
    .update(updateData)
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update import progress: ${error.message}`);
  }
}

/**
 * Mark import as completed
 */
export async function completeImport(
  id: string,
  processedRows: number,
  failedRows: number,
  errors: string[]
): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const status: CollectionImportStatus = failedRows > 0 && processedRows === 0 ? 'failed' : 'completed';

  const { error } = await client
    .from('collection_imports')
    .update({
      status,
      processed_rows: processedRows,
      failed_rows: failedRows,
      errors: errors.length > 0 ? errors : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to complete import: ${error.message}`);
  }
}

/**
 * Delete import job
 */
export async function deleteImport(id: string): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await client
    .from('collection_imports')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete import: ${error.message}`);
  }
}

/**
 * Get imports for a collection
 */
export async function getImportsByCollectionId(collectionId: string): Promise<CollectionImport[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('collection_imports')
    .select('*')
    .eq('collection_id', collectionId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch imports: ${error.message}`);
  }

  return data || [];
}
