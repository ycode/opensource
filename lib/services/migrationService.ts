import { getKnexClient, closeKnexClient, testKnexConnection } from '../knex-client';
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
    const canConnect = await testKnexConnection();
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

