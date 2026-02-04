import type { Knex } from 'knex';

/**
 * Migration: Create Assets Table
 *
 * Creates the assets table for file storage references.
 * Supports both uploaded files and inline SVG content.
 * Uses composite primary key (id, is_published) for draft/published workflow.
 *
 * Note: asset_folder_id is added by the asset_folders migration.
 */

export async function up(knex: Knex): Promise<void> {
  // Create assets table with composite primary key
  await knex.schema.createTable('assets', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    table.string('source', 100).notNullable().defaultTo('library'); // Identifies where asset was uploaded from
    table.string('filename', 255).notNullable();
    table.text('storage_path').nullable(); // Nullable for inline SVG assets
    table.text('public_url').nullable(); // Nullable for inline SVG assets
    table.integer('file_size').nullable();
    table.string('mime_type', 100).nullable();
    table.integer('width').nullable();
    table.integer('height').nullable();
    table.text('content').nullable(); // Inline SVG content for icon assets
    table.boolean('is_published').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Composite primary key
    table.primary(['id', 'is_published']);
  });

  // Create indexes (partial indexes for soft delete support)
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_filename ON assets(filename) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_mime_type ON assets(mime_type) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_source ON assets(source) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_is_published ON assets(is_published) WHERE deleted_at IS NULL');

  // Unique index on id for draft assets (allows foreign key references)
  await knex.schema.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_id_unique ON assets(id) WHERE is_published = false AND deleted_at IS NULL');

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE assets ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  // Single SELECT policy: public can view published OR authenticated can view all
  await knex.schema.raw(`
    CREATE POLICY "Assets are viewable"
      ON assets FOR SELECT
      USING (
        (is_published = true AND deleted_at IS NULL)
        OR (SELECT auth.uid()) IS NOT NULL
      )
  `);

  // Authenticated users can INSERT/UPDATE/DELETE
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can modify assets"
      ON assets FOR INSERT
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can update assets"
      ON assets FOR UPDATE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can delete assets"
      ON assets FOR DELETE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  // Add comment for documentation
  await knex.schema.raw(`
    COMMENT ON COLUMN assets.content IS 'Inline SVG content for icon assets. When set, storage_path and public_url should be NULL.'
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Assets are viewable" ON assets');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can modify assets" ON assets');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can update assets" ON assets');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can delete assets" ON assets');

  // Drop table
  await knex.schema.dropTableIfExists('assets');
}
