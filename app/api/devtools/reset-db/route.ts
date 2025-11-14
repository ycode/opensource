import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getKnexClient } from '@/lib/knex-client';
import { getSupabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/devtools/reset-db
 *
 * DANGEROUS: Deletes all tables in the public schema and empties storage buckets
 * Only for development use
 */
export async function POST() {
  try {
    console.log('[POST /api/devtools/reset-db] Starting database reset...');

    const knex = await getKnexClient();
    const supabase = await getSupabaseAdmin();

    // Get all tables in the public schema
    const tables = await knex.raw(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `);

    console.log('[POST /api/devtools/reset-db] Found ' + tables.rows.length + ' tables');

    if (supabase) {
      console.log('[POST /api/devtools/reset-db] Cleaning up assets storage bucket...');

      try {
        const { data: files, error: listError } = await supabase.storage
          .from('assets')
          .list('', {
            limit: 1000,
            sortBy: { column: 'created_at', order: 'desc' }
          });

        if (listError) {
          console.log('[POST /api/devtools/reset-db] Error listing files (bucket may not exist):', listError.message);
        } else if (files && files.length > 0) {
          console.log(`[POST /api/devtools/reset-db] Found ${files.length} files in assets bucket`);

          const filePaths = files.map(file => file.name);
          const { error: deleteError } = await supabase.storage
            .from('assets')
            .remove(filePaths);

          if (deleteError) {
            console.log('[POST /api/devtools/reset-db] Error deleting files:', deleteError.message);
          } else {
            console.log(`[POST /api/devtools/reset-db] Deleted ${filePaths.length} files from assets bucket`);
          }
        } else {
          console.log('[POST /api/devtools/reset-db] No files found in assets bucket');
        }

        console.log('[POST /api/devtools/reset-db] Deleting assets bucket...');
        const { error: deleteBucketError } = await supabase.storage.deleteBucket('assets');

        if (deleteBucketError) {
          console.log('[POST /api/devtools/reset-db] Error deleting bucket (may not exist):', deleteBucketError.message);
        } else {
          console.log('[POST /api/devtools/reset-db] Assets bucket deleted successfully');
        }
      } catch (storageError) {
        console.log('[POST /api/devtools/reset-db] Storage cleanup error:', storageError);
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

    console.log('[POST /api/devtools/reset-db] All tables dropped successfully');

    revalidatePath('/', 'layout');
    console.log('[POST /api/devtools/reset-db] Cache invalidated');

    return NextResponse.json({
      data: { message: 'All public tables and storage buckets have been deleted' }
    });
  } catch (error) {
    console.error('[POST /api/devtools/reset-db] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reset database' },
      { status: 500 }
    );
  }
}

