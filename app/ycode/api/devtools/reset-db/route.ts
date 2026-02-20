import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getKnexClient } from '@/lib/knex-client';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { STORAGE_BUCKET } from '@/lib/asset-constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /ycode/api/devtools/reset-db
 *
 * DANGEROUS: Deletes all tables in the public schema and empties storage buckets.
 * Authentication enforced by proxy.
 */
export async function POST() {
  try {
    console.log('[POST /ycode/api/devtools/reset-db] Starting database reset...');

    const knex = await getKnexClient();
    const supabase = await getSupabaseAdmin();

    // Get all tables in the public schema
    const tables = await knex.raw(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);

    console.log('[POST /ycode/api/devtools/reset-db] Found ' + tables.rows.length + ' tables');

    if (supabase) {
      console.log('[POST /ycode/api/devtools/reset-db] Cleaning up assets storage bucket...');

      try {
        // emptyBucket removes all files recursively (including nested folders)
        const { error: emptyError } = await supabase.storage.emptyBucket(STORAGE_BUCKET);

        if (emptyError) {
          console.log('[POST /ycode/api/devtools/reset-db] Error emptying bucket (may not exist):', emptyError.message);
        } else {
          console.log('[POST /ycode/api/devtools/reset-db] Assets bucket emptied');
        }

        const { error: deleteBucketError } = await supabase.storage.deleteBucket(STORAGE_BUCKET);

        if (deleteBucketError) {
          console.log('[POST /ycode/api/devtools/reset-db] Error deleting bucket (may not exist):', deleteBucketError.message);
        } else {
          console.log('[POST /ycode/api/devtools/reset-db] Assets bucket deleted');
        }
      } catch (storageError) {
        console.log('[POST /ycode/api/devtools/reset-db] Storage cleanup error:', storageError);
      }
    }

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

    console.log('[POST /ycode/api/devtools/reset-db] All tables dropped successfully');

    revalidatePath('/', 'layout');
    console.log('[POST /ycode/api/devtools/reset-db] Cache invalidated');

    return NextResponse.json({
      data: { message: 'All public tables and storage buckets have been deleted' }
    });
  } catch (error) {
    console.error('[POST /ycode/api/devtools/reset-db] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reset database' },
      { status: 500 }
    );
  }
}
