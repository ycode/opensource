import type { Knex } from 'knex';

/**
 * Migration: Create Page Folders Table
 *
 * Creates the page_folders table with self-referential foreign key, RLS and policies
 */

export async function up(knex: Knex): Promise<void> {
  // Create page_folders table
  await knex.schema.createTable('page_folders', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('page_folder_id').nullable().references('id').inTable('page_folders').onDelete('SET NULL');
    table.string('name', 255).notNullable();
    table.string('slug', 255).notNullable();
    table.integer('depth').notNullable().defaultTo(0);
    table.integer('order').notNullable().defaultTo(0);
    table.jsonb('settings').defaultTo('{}'); // Settings for `auth` (enabled + password)
    table.boolean('is_published').defaultTo(false);
    table.string('publish_key', 255).defaultTo(knex.raw('gen_random_uuid()'));
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
  });

  // Create indexes (partial indexes for soft delete support)
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_folders_page_folder_id ON page_folders(page_folder_id) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_folders_slug ON page_folders(slug) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_folders_publish_key ON page_folders(publish_key) WHERE deleted_at IS NULL');

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE page_folders ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  await knex.schema.raw(`
    CREATE POLICY "Public can view published folders"
      ON page_folders FOR SELECT
      USING (is_published = true AND deleted_at IS NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can manage folders"
      ON page_folders FOR ALL
      USING (auth.role() = 'authenticated')
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies first
  await knex.schema.raw('DROP POLICY IF EXISTS "Public can view published folders" ON page_folders');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can manage folders" ON page_folders');

  // Drop table
  await knex.schema.dropTableIfExists('page_folders');
}

