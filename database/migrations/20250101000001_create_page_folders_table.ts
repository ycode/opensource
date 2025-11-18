import type { Knex } from 'knex';

/**
 * Migration: Create Page Folders Table
 *
 * Creates the page_folders table with self-referential foreign key, RLS and policies
 */

export async function up(knex: Knex): Promise<void> {
  // Create page_folders table
  await knex.schema.createTable('page_folders', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('page_folder_id').nullable();
    table.string('name', 255).notNullable();
    table.string('slug', 255).notNullable();
    table.integer('depth').notNullable().defaultTo(0);
    table.integer('order').notNullable().defaultTo(0);
    table.jsonb('settings').defaultTo('{}'); // Settings for `auth` (enabled + password)
    table.boolean('is_published').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Composite primary key
    table.primary(['id', 'is_published']);
  });

  // Add foreign key constraint separately (after table creation)
  await knex.schema.raw(`
    ALTER TABLE page_folders
    ADD CONSTRAINT fk_page_folders_parent
    FOREIGN KEY (page_folder_id, is_published)
    REFERENCES page_folders(id, is_published)
    ON DELETE SET NULL
  `);

  // Create indexes (partial indexes for soft delete support)
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_folders_page_folder_id ON page_folders(page_folder_id, is_published) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_folders_slug ON page_folders(slug, is_published) WHERE deleted_at IS NULL');

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
      USING (auth.uid() IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies first
  await knex.schema.raw('DROP POLICY IF EXISTS "Public can view published folders" ON page_folders');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can manage folders" ON page_folders');

  // Drop table
  await knex.schema.dropTableIfExists('page_folders');
}

