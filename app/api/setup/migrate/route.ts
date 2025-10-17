import { NextResponse } from 'next/server';
import { runMigrations, getMigrationSQL } from '@/lib/services/migrationService';
import { noCache } from '@/lib/api-response';

/**
 * POST /api/setup/migrate
 * 
 * Run Supabase migrations
 */
export async function POST() {
  try {
    const result = await runMigrations();

    if (!result.success) {
      return noCache(
        {
          error: `Migration failed at ${result.failed}: ${result.error}`,
          executed: result.executed,
        },
        500
      );
    }

    return noCache({
      success: true,
      executed: result.executed,
      message: `Successfully executed ${result.executed.length} migrations`,
    });
  } catch (error) {
    console.error('Migration error:', error);
    
    return noCache(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      500
    );
  }
}

/**
 * GET /api/setup/migrate
 * 
 * Get migration SQL content for manual execution
 */
export async function GET() {
  try {
    const migrations = getMigrationSQL();

    return noCache({
      migrations,
      count: migrations.length,
    });
  } catch (error) {
    console.error('Failed to get migrations:', error);
    
    return noCache(
      { error: 'Failed to retrieve migrations' },
      500
    );
  }
}

