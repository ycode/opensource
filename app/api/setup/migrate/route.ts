import { NextResponse } from 'next/server';
import { runMigrations, getMigrationSQL } from '@/lib/services/migrationService';

/**
 * POST /api/setup/migrate
 * 
 * Run Supabase migrations
 */
export async function POST() {
  try {
    const result = await runMigrations();

    if (!result.success) {
      return NextResponse.json(
        {
          error: `Migration failed at ${result.failed}: ${result.error}`,
          executed: result.executed,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      executed: result.executed,
      message: `Successfully executed ${result.executed.length} migrations`,
    });
  } catch (error) {
    console.error('Migration error:', error);
    
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
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

    return NextResponse.json({
      migrations,
      count: migrations.length,
    });
  } catch (error) {
    console.error('Failed to get migrations:', error);
    
    return NextResponse.json(
      { error: 'Failed to retrieve migrations' },
      { status: 500 }
    );
  }
}

