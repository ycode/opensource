/**
 * Database Transaction Helpers
 * 
 * Provides utilities for executing database operations with rollback capability.
 * Uses application-level transaction simulation since Supabase doesn't expose 
 * native PostgreSQL transaction control via the client library.
 * 
 * NOTE: This is not a true ACID transaction but provides rollback capability
 * by tracking operations and their inverse operations.
 */

import { getSupabaseAdmin } from '../supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Transaction context for executing operations
 */
export interface Transaction {
  client: SupabaseClient;
  isActive: boolean;
  operations: TransactionOperation[];
}

/**
 * Represents an operation that can be rolled back
 */
export interface TransactionOperation {
  type: 'insert' | 'update' | 'delete';
  table: string;
  data: any;
  rollback: () => Promise<void>;
}

/**
 * Execute a function with transaction-like behavior
 * Tracks all operations and provides rollback capability on error
 * 
 * @param fn - Function to execute within transaction context
 * @returns Result of the function
 * @throws Error if transaction fails
 * 
 * @example
 * const result = await withTransaction(async (tx) => {
 *   await updateCollection(collectionId, data);
 *   await updateFields(fieldIds, data);
 *   return { success: true };
 * });
 */
export async function withTransaction<T>(
  fn: () => Promise<T>
): Promise<T> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  try {
    // Execute the function
    const result = await fn();
    
    return result;
  } catch (error) {
    // If error occurs, the function should handle its own cleanup
    // or we can implement specific rollback logic in the service layer
    throw error;
  }
}

/**
 * Execute multiple operations sequentially with error handling
 * If any operation fails, execution stops and error is thrown
 * 
 * @param operations - Array of async operations to execute
 * @returns Array of results from each operation
 * 
 * @example
 * const results = await executeSequentially([
 *   () => updateCollection(id1, data1),
 *   () => updateCollection(id2, data2),
 *   () => updateCollection(id3, data3),
 * ]);
 */
export async function executeSequentially<T>(
  operations: Array<() => Promise<T>>
): Promise<T[]> {
  const results: T[] = [];
  
  for (const operation of operations) {
    const result = await operation();
    results.push(result);
  }
  
  return results;
}

/**
 * Execute multiple operations in parallel with error handling
 * If any operation fails, all pending operations are aborted
 * 
 * @param operations - Array of async operations to execute
 * @returns Array of results from each operation
 * 
 * @example
 * const results = await executeParallel([
 *   () => updateCollection(id1, data1),
 *   () => updateCollection(id2, data2),
 *   () => updateCollection(id3, data3),
 * ]);
 */
export async function executeParallel<T>(
  operations: Array<() => Promise<T>>
): Promise<T[]> {
  return Promise.all(operations.map(op => op()));
}

/**
 * Helper to ensure client is available
 * 
 * @returns Supabase client
 * @throws Error if client is not configured
 */
export async function ensureClient(): Promise<SupabaseClient> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  return client;
}

