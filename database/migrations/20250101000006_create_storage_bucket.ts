import type { Knex } from 'knex';

/**
 * Migration: Create Storage Bucket
 *
 * Creates Supabase storage bucket for assets with policies
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'assets',
      'assets',
      true,
      52428800,
      NULL
    )
    ON CONFLICT (id) DO NOTHING
  `);

  // Drop existing policies if they exist
  await knex.schema.raw('DROP POLICY IF EXISTS "Assets are publicly accessible" ON storage.objects');
  await knex.schema.raw('DROP POLICY IF EXISTS "Anyone can upload assets" ON storage.objects');
  await knex.schema.raw('DROP POLICY IF EXISTS "Anyone can update assets" ON storage.objects');
  await knex.schema.raw('DROP POLICY IF EXISTS "Anyone can delete assets" ON storage.objects');

  // Create storage policies
  await knex.schema.raw(`
    CREATE POLICY "Assets are publicly accessible"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'assets')
  `);

  await knex.schema.raw(`
    CREATE POLICY "Anyone can upload assets"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'assets')
  `);

  await knex.schema.raw(`
    CREATE POLICY "Anyone can update assets"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'assets')
      WITH CHECK (bucket_id = 'assets')
  `);

  await knex.schema.raw(`
    CREATE POLICY "Anyone can delete assets"
      ON storage.objects FOR DELETE
      USING (bucket_id = 'assets')
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Assets are publicly accessible" ON storage.objects');
  await knex.schema.raw('DROP POLICY IF EXISTS "Anyone can upload assets" ON storage.objects');
  await knex.schema.raw('DROP POLICY IF EXISTS "Anyone can update assets" ON storage.objects');
  await knex.schema.raw('DROP POLICY IF EXISTS "Anyone can delete assets" ON storage.objects');

  // Delete bucket (this will fail if there are files in it)
  await knex.schema.raw("DELETE FROM storage.buckets WHERE id = 'assets'");
}

