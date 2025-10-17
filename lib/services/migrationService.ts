import { executeSql } from '../supabase-server';
import fs from 'fs';
import path from 'path';

/**
 * Migration Service
 * 
 * Reads and executes SQL migration files on Supabase
 */

export interface MigrationResult {
  success: boolean;
  executed: string[];
  failed?: string;
  error?: string;
}

/**
 * Get all migration files
 */
function getMigrationFiles(): string[] {
  const migrationsDir = path.join(process.cwd(), 'database', 'supabase');
  
  try {
    const files = fs.readdirSync(migrationsDir);
    return files
      .filter((file) => file.endsWith('.sql'))
      .sort(); // Execute in alphabetical order
  } catch (error) {
    console.error('Failed to read migrations directory:', error);
    return [];
  }
}

/**
 * Read migration file content
 */
function readMigrationFile(filename: string): string {
  const migrationsDir = path.join(process.cwd(), 'database', 'supabase');
  const filePath = path.join(migrationsDir, filename);
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Verify migrations have been run by checking if tables exist
 */
export async function verifyMigrations(): Promise<MigrationResult> {
  const { getSupabaseAdmin } = await import('../supabase-server');
  const client = await getSupabaseAdmin();
  
  if (!client) {
    return {
      success: false,
      executed: [],
      error: 'Supabase not configured',
    };
  }

  const requiredTables = ['pages', 'page_versions', 'assets', 'settings'];
  const verified: string[] = [];

  // Check tables
  for (const table of requiredTables) {
    try {
      // Try to query the table - if it exists, this will succeed (even with 0 rows)
      const { error } = await client.from(table).select('id').limit(1);
      
      if (error) {
        // Check if error is "table doesn't exist" vs other errors
        if (error.message.includes('does not exist') || error.message.includes('relation')) {
          return {
            success: false,
            executed: verified,
            failed: table,
            error: `Table '${table}' does not exist. Please run the migrations in Supabase SQL Editor.`,
          };
        }
        // Other errors might be permission-related, which is okay
      }
      
      verified.push(table);
    } catch (error) {
      return {
        success: false,
        executed: verified,
        failed: table,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Check storage bucket
  try {
    const { data: buckets, error } = await client.storage.listBuckets();
    
    if (error) {
      console.warn('Could not verify storage buckets:', error.message);
    } else {
      const assetsBucket = buckets?.find((b) => b.id === 'assets');
      if (!assetsBucket) {
        return {
          success: false,
          executed: verified,
          failed: 'assets storage bucket',
          error: 'Storage bucket "assets" does not exist. Please run the migrations in Supabase SQL Editor.',
        };
      }
      verified.push('assets_bucket');
    }
  } catch (error) {
    console.warn('Could not verify storage buckets:', error);
    // Don't fail if we can't check buckets
  }

  return {
    success: true,
    executed: verified,
  };
}

/**
 * @deprecated Use verifyMigrations() instead
 */
export async function runMigrations(): Promise<MigrationResult> {
  return verifyMigrations();
}

/**
 * Get list of available migrations
 */
export function getAvailableMigrations(): string[] {
  return getMigrationFiles();
}

/**
 * Get migration SQL content for display/manual execution
 */
export function getMigrationSQL(): Array<{ filename: string; sql: string }> {
  const migrationFiles = getMigrationFiles();
  
  return migrationFiles.map((filename) => ({
    filename,
    sql: readMigrationFile(filename),
  }));
}

