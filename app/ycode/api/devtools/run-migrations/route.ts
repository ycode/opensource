import { NextResponse } from 'next/server';
import { runMigrations } from '@/lib/services/migrationService';
import { runSeeds } from '@/lib/services/seedService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /ycode/api/devtools/run-migrations
 *
 * Run all pending database migrations and seed data.
 * Authentication enforced by proxy.
 */
export async function POST() {
  try {
    console.log('[POST /ycode/api/devtools/run-migrations] Starting migrations...');

    const result = await runMigrations();

    if (!result.success) {
      console.error('[POST /ycode/api/devtools/run-migrations] Migrations failed:', result.error);
      return NextResponse.json(
        { 
          error: result.error || 'Migrations failed',
          failed: result.failed,
          executed: result.executed,
        },
        { status: 500 }
      );
    }

    console.log('[POST /ycode/api/devtools/run-migrations] Migrations completed successfully');
    console.log('[POST /ycode/api/devtools/run-migrations] Executed:', result.executed);

    // Run seeds after migrations
    console.log('[POST /ycode/api/devtools/run-migrations] Running seeds...');
    const seedResult = await runSeeds();
    
    if (!seedResult.success) {
      console.warn('[POST /ycode/api/devtools/run-migrations] Some seeds failed:', seedResult.results);
    } else {
      console.log('[POST /ycode/api/devtools/run-migrations] Seeds completed successfully');
    }

    return NextResponse.json({
      data: {
        message: `Successfully executed ${result.executed.length} migration(s)`,
        executed: result.executed,
        seeds: seedResult.results,
      }
    });
  } catch (error) {
    console.error('[POST /ycode/api/devtools/run-migrations] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run migrations' },
      { status: 500 }
    );
  }
}
