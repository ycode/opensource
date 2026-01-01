import { NextResponse } from 'next/server';
import { runMigrations } from '@/lib/services/migrationService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/devtools/run-migrations
 *
 * Run all pending database migrations
 */
export async function POST() {
  try {
    console.log('[POST /api/devtools/run-migrations] Starting migrations...');

    const result = await runMigrations();

    if (!result.success) {
      console.error('[POST /api/devtools/run-migrations] Migrations failed:', result.error);
      return NextResponse.json(
        { 
          error: result.error || 'Migrations failed',
          failed: result.failed,
          executed: result.executed,
        },
        { status: 500 }
      );
    }

    console.log('[POST /api/devtools/run-migrations] Migrations completed successfully');
    console.log('[POST /api/devtools/run-migrations] Executed:', result.executed);

    return NextResponse.json({
      data: {
        message: `Successfully executed ${result.executed.length} migration(s)`,
        executed: result.executed,
      }
    });
  } catch (error) {
    console.error('[POST /api/devtools/run-migrations] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run migrations' },
      { status: 500 }
    );
  }
}
