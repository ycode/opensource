import type { Knex } from 'knex';

/**
 * Migration: Create Assets Table
 * 
 * Creates the assets table for file storage references
 */

export async function up(knex: Knex): Promise<void> {
  // Create assets table
  await knex.schema.createTable('assets', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('filename', 255).notNullable();
    table.text('storage_path').notNullable();
    table.text('public_url').notNullable();
    table.integer('file_size').nullable();
    table.string('mime_type', 100).nullable();
    table.integer('width').nullable();
    table.integer('height').nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Create indexes
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_filename ON assets(filename)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_mime_type ON assets(mime_type)');

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE assets ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  await knex.schema.raw(`
    CREATE POLICY "Assets are viewable by everyone" 
      ON assets FOR SELECT 
      USING (TRUE)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can manage assets" 
      ON assets FOR ALL 
      USING (auth.uid() IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Assets are viewable by everyone" ON assets');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can manage assets" ON assets');

  // Drop table
  await knex.schema.dropTableIfExists('assets');
}

