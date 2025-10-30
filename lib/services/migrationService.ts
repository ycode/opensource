import { getKnexClient, closeKnexClient, testConnection } from '../knex-client';
import { getSupabaseAdmin } from '../supabase-server';
import { migrations } from '../migrations-loader';

/**
 * Migration Service
 *
 * Runs database migrations programmatically using manually loaded migrations
 * This avoids Next.js webpack bundling issues with dynamic file loading
 */

export interface MigrationResult {
  success: boolean;
  executed: string[];
  failed?: string;
  error?: string;
}

export interface MigrationStatus {
  name: string;
  batch: number;
  migration_time: Date;
}

/**
 * Ensure migrations table exists
 */
async function ensureMigrationsTable(knex: any): Promise<void> {
  const hasTable = await knex.schema.hasTable('migrations');

  if (!hasTable) {
    await knex.schema.createTable('migrations', (table: any) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.integer('batch').notNullable();
      table.timestamp('migration_time').defaultTo(knex.fn.now());
    });
  }
}

/**
 * Get completed migrations from database
 */
async function getCompletedMigrations(knex: any): Promise<Set<string>> {
  await ensureMigrationsTable(knex);

  const completed = await knex('migrations')
    .select('name')
    .orderBy('id', 'asc');

  return new Set(completed.map((m: any) => m.name));
}

/**
 * Get next batch number
 */
async function getNextBatch(knex: any): Promise<number> {
  const result = await knex('migrations')
    .max('batch as maxBatch')
    .first();

  return (result?.maxBatch || 0) + 1;
}

/**
 * Run pending migrations manually
 */
export async function runMigrations(): Promise<MigrationResult> {
  try {
    console.log('[runMigrations] Starting migration process...');

    // Test connection first
    const canConnect = await testConnection();
    if (!canConnect) {
      return {
        success: false,
        executed: [],
        error: 'Cannot connect to database. Please check your database password is configured correctly.',
      };
    }

    const knex = await getKnexClient();
    const completed = await getCompletedMigrations(knex);
    const batch = await getNextBatch(knex);
    const executed: string[] = [];

    // Run each pending migration
    for (const migration of migrations) {
      if (!completed.has(migration.name)) {
        console.log(`[runMigrations] Running migration: ${migration.name}`);

        try {
          // Run migration in a transaction
          await knex.transaction(async (trx: any) => {
            await migration.up(trx);

            // Record migration
            await trx('migrations').insert({
              name: migration.name,
              batch,
            });
          });

          executed.push(migration.name);
          console.log(`[runMigrations] ✓ ${migration.name} completed`);
        } catch (error) {
          console.error(`[runMigrations] ✗ ${migration.name} failed:`, error);
          await closeKnexClient();

          return {
            success: false,
            executed,
            failed: migration.name,
            error: error instanceof Error ? error.message : 'Migration failed',
          };
        }
      }
    }

    console.log('[runMigrations] All migrations completed:', executed);

    // Close connection
    await closeKnexClient();

    return {
      success: true,
      executed,
    };
  } catch (error) {
    console.error('[runMigrations] Migration failed:', error);

    // Make sure to close connection on error
    try {
      await closeKnexClient();
    } catch (closeError) {
      console.error('[runMigrations] Error closing connection:', closeError);
    }

    return {
      success: false,
      executed: [],
      error: error instanceof Error ? error.message : 'Migration failed',
    };
  }
}

/**
 * Rollback last batch of migrations
 */
export async function rollbackMigrations(): Promise<MigrationResult> {
  try {
    console.log('[rollbackMigrations] Starting rollback...');

    const knex = await getKnexClient();

    // Get last batch number
    const lastBatch = await knex('migrations')
      .max('batch as maxBatch')
      .first();

    if (!lastBatch?.maxBatch) {
      await closeKnexClient();
      return {
        success: true,
        executed: [],
      };
    }

    // Get migrations in last batch
    const toRollback = await knex('migrations')
      .where('batch', lastBatch.maxBatch)
      .orderBy('id', 'desc');

    const executed: string[] = [];

    // Rollback each migration
    for (const record of toRollback) {
      const migration = migrations.find(m => m.name === record.name);

      if (migration) {
        console.log(`[rollbackMigrations] Rolling back: ${migration.name}`);

        try {
          await knex.transaction(async (trx: any) => {
            await migration.down(trx);

            // Remove migration record
            await trx('migrations')
              .where('name', migration.name)
              .delete();
          });

          executed.push(migration.name);
          console.log(`[rollbackMigrations] ✓ ${migration.name} rolled back`);
        } catch (error) {
          console.error(`[rollbackMigrations] ✗ ${migration.name} failed:`, error);
          await closeKnexClient();

          return {
            success: false,
            executed,
            failed: migration.name,
            error: error instanceof Error ? error.message : 'Rollback failed',
          };
        }
      }
    }

    await closeKnexClient();

    return {
      success: true,
      executed,
    };
  } catch (error) {
    console.error('[rollbackMigrations] Rollback failed:', error);

    try {
      await closeKnexClient();
    } catch (closeError) {
      console.error('[rollbackMigrations] Error closing connection:', closeError);
    }

    return {
      success: false,
      executed: [],
      error: error instanceof Error ? error.message : 'Rollback failed',
    };
  }
}

/**
 * Get migration status (which migrations have been run)
 */
export async function getMigrationStatus(): Promise<MigrationStatus[]> {
  try {
    const knex = await getKnexClient();
    await ensureMigrationsTable(knex);

    const completed = await knex('migrations')
      .select('*')
      .orderBy('id', 'asc');

    await closeKnexClient();

    return completed.map((m: any) => ({
      name: m.name,
      batch: m.batch,
      migration_time: m.migration_time,
    }));
  } catch (error) {
    console.error('[getMigrationStatus] Failed to get status:', error);
    try {
      await closeKnexClient();
    } catch (closeError) {
      console.error('[getMigrationStatus] Error closing connection:', closeError);
    }
    return [];
  }
}

/**
 * Verify migrations have been run by checking if tables exist
 */
export async function verifyMigrations(): Promise<MigrationResult> {
  const supabaseClient = await getSupabaseAdmin();

  if (!supabaseClient) {
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
      const { error } = await supabaseClient.from(table).select('id').limit(1);

      if (error) {
        // Check if error is "table doesn't exist" vs other errors
        if (error.message.includes('does not exist') || error.message.includes('relation')) {
          return {
            success: false,
            executed: verified,
            failed: table,
            error: `Table '${table}' does not exist. Please run migrations.`,
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
    const { data: buckets, error } = await supabaseClient.storage.listBuckets();

    if (error) {
      console.warn('Could not verify storage buckets:', error.message);
    } else {
      const assetsBucket = buckets?.find((b) => b.id === 'assets');
      if (!assetsBucket) {
        return {
          success: false,
          executed: verified,
          failed: 'assets storage bucket',
          error: 'Storage bucket "assets" does not exist. Please run migrations.',
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
 * Get list of pending migrations (not yet run)
 */
export async function getPendingMigrations(): Promise<string[]> {
  try {
    const knex = await getKnexClient();
    const completed = await getCompletedMigrations(knex);
    await closeKnexClient();

    // Return migrations not in completed set
    return migrations
      .filter(m => !completed.has(m.name))
      .map(m => m.name);
  } catch (error) {
    console.error('[getPendingMigrations] Failed to get pending migrations:', error);
    try {
      await closeKnexClient();
    } catch (closeError) {
      console.error('[getPendingMigrations] Error closing connection:', closeError);
    }
    return [];
  }
}
