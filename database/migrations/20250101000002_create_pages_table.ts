import type { Knex } from 'knex';

/**
 * Migration: Create Pages Table
 *
 * Creates the pages table with RLS and policies
 */

export async function up(knex: Knex): Promise<void> {
  // Create pages table
  await knex.schema.createTable('pages', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('page_folder_id').nullable();
    table.string('name', 255).notNullable();
    table.string('slug', 255).notNullable();
    table.integer('order').defaultTo(0);
    table.integer('depth').defaultTo(0);
    table.boolean('is_index').defaultTo(false); // Index of the root or parent folder
    table.boolean('is_dynamic').defaultTo(false); // Dynamic page (CMS-driven)
    table.integer('error_page').nullable(); // If an error page, error page type: 401, 404, 500
    table.jsonb('settings').defaultTo('{}'); // Settings for `cms` (source + key), `auth` (enabled + password), `seo`, `code`
    table.boolean('is_published').notNullable().defaultTo(false);
    table.string('content_hash', 64).nullable(); // SHA-256 hash for change detection
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Composite primary key
    table.primary(['id', 'is_published']);
  });

  // Add foreign key constraint separately (after table creation)
  await knex.schema.raw(`
    ALTER TABLE pages
    ADD CONSTRAINT fk_pages_folder
    FOREIGN KEY (page_folder_id, is_published)
    REFERENCES page_folders(id, is_published)
    ON DELETE SET NULL
  `);

  // Create indexes
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_pages_page_folder_id ON pages(page_folder_id, is_published) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug, is_published) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_pages_is_published ON pages(is_published) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_pages_content_hash ON pages(content_hash)');

  // Uses COALESCE to handle NULL values because NULL != NULL in SQL
  await knex.schema.raw(`
    CREATE UNIQUE INDEX pages_slug_is_published_folder_unique
    ON pages(
      slug,
      is_published,
      COALESCE(page_folder_id, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(error_page, 0)
    )
    WHERE deleted_at IS NULL
  `);

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE pages ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  await knex.schema.raw(`
    CREATE POLICY "Public pages are viewable by everyone"
      ON pages FOR SELECT
      USING (is_published = true AND deleted_at IS NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can manage pages"
      ON pages FOR ALL
      USING (auth.uid() IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies first
  await knex.schema.raw('DROP POLICY IF EXISTS "Public pages are viewable by everyone" ON pages');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can manage pages" ON pages');

  // Drop table
  await knex.schema.dropTableIfExists('pages');
}

