import { NextResponse } from 'next/server';
import { getKnexClient } from '@/lib/knex-client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/devtools/reset-db
 *
 * DANGEROUS: Deletes all tables in the public schema
 * Only for development use
 */
export async function POST() {
  try {
    console.log('[POST /api/devtools/reset-db] Starting database reset...');

    const knex = await getKnexClient();

    // Get all tables in the public schema
    const tables = await knex.raw(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);

    console.log('[POST /api/devtools/reset-db] Found tables:', tables.rows);

    // Drop all tables
    await knex.raw(`
      DO $$
      DECLARE
        r RECORD;
      BEGIN
        FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public')
        LOOP
          EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;
      END $$;
    `);

    console.log('[POST /api/devtools/reset-db] All tables dropped successfully');

    return NextResponse.json({
      data: { message: 'All public tables have been deleted' }
    });
  } catch (error) {
    console.error('[POST /api/devtools/reset-db] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reset database' },
      { status: 500 }
    );
  }
}

