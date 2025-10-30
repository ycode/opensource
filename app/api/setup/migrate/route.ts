import { NextResponse } from 'next/server';
import { runMigrations, getMigrationStatus, getPendingMigrations } from '@/lib/services/migrationService';
import { noCache } from '@/lib/api-response';

/**
 * POST /api/setup/migrate
 *
 * Run Supabase migrations using Knex
 */
export async function POST() {
  try {
    console.log('[setup/migrate] Starting migrations...');
    const result = await runMigrations();

    if (!result.success) {
      console.error('[setup/migrate] Migration failed:', result.error);
      return noCache(
        {
          error: result.error || 'Migration failed',
          executed: result.executed,
          failed: result.failed,
        },
        500
      );
    }

    console.log('[setup/migrate] Migrations completed successfully');
    return noCache({
      success: true,
      executed: result.executed,
      message: result.executed.length > 0
        ? `Successfully executed ${result.executed.length} migration(s)`
        : 'All migrations already up to date',
    });
  } catch (error) {
    console.error('[setup/migrate] Migration error:', error);

    return noCache(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      500
    );
  }
}

/**
 * GET /api/setup/migrate
 *
 * Get migration status (completed and pending)
 */
export async function GET() {
  try {
    const [completed, pending] = await Promise.all([
      getMigrationStatus(),
      getPendingMigrations(),
    ]);

    return noCache({
      completed,
      pending,
      completedCount: completed.length,
      pendingCount: pending.length,
    });
  } catch (error) {
    console.error('[setup/migrate] Failed to get migration status:', error);

    return noCache(
      { error: 'Failed to retrieve migration status' },
      500
    );
  }
}

