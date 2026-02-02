import type { Knex } from 'knex';

/**
 * Migration: Add is_published to assets table
 *
 * Converts assets table to use composite primary key (id, is_published)
 * pattern like other publishable entities. This allows draft/published
 * workflow where:
 * - Draft assets (is_published=false) are managed in the builder
 * - Published assets (is_published=true) are live on the site
 * - Physical files are only deleted when publishing a deleted draft
 */

export async function up(knex: Knex): Promise<void> {
  // Step 1: Drop existing policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Assets are viewable by everyone" ON assets');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can manage assets" ON assets');

  // Step 2: Drop foreign key from assets to asset_folders
  await knex.schema.raw('ALTER TABLE assets DROP CONSTRAINT IF EXISTS fk_assets_folder');

  // Step 3: Drop the existing primary key
  await knex.schema.raw('ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_pkey');

  // Step 4: Add new columns
  await knex.schema.alterTable('assets', (table) => {
    table.boolean('is_published').notNullable().defaultTo(false);
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
  });

  // Step 5: Create composite primary key
  await knex.schema.raw('ALTER TABLE assets ADD PRIMARY KEY (id, is_published)');

  // Step 6: Create unique index on id alone (for foreign key references)
  await knex.schema.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_assets_id_unique ON assets(id) WHERE is_published = false AND deleted_at IS NULL');

  // Step 7: Update indexes
  await knex.schema.raw('DROP INDEX IF EXISTS idx_assets_filename');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_assets_mime_type');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_assets_source');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_assets_asset_folder_id');

  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_filename ON assets(filename) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_mime_type ON assets(mime_type) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_source ON assets(source) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_is_published ON assets(is_published) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_asset_folder_id ON assets(asset_folder_id, is_published) WHERE deleted_at IS NULL');

  // Step 8: Create new RLS policies
  await knex.schema.raw(`
    CREATE POLICY "Public can view published assets"
      ON assets FOR SELECT
      USING (is_published = true AND deleted_at IS NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can manage assets"
      ON assets FOR ALL
      USING (auth.uid() IS NOT NULL)
  `);

  // Step 9: Re-add foreign key with composite key support
  await knex.schema.raw(`
    ALTER TABLE assets
    ADD CONSTRAINT fk_assets_folder
    FOREIGN KEY (asset_folder_id, is_published)
    REFERENCES asset_folders(id, is_published)
    ON DELETE SET NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop the new foreign key
  await knex.schema.raw('ALTER TABLE assets DROP CONSTRAINT IF EXISTS fk_assets_folder');

  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Public can view published assets" ON assets');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can manage assets" ON assets');

  // Drop new indexes
  await knex.schema.raw('DROP INDEX IF EXISTS idx_assets_id_unique');
  await knex.schema.raw('DROP INDEX IF EXISTS idx_assets_is_published');

  // Drop composite primary key
  await knex.schema.raw('ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_pkey');

  // Remove new columns
  await knex.schema.alterTable('assets', (table) => {
    table.dropColumn('is_published');
    table.dropColumn('updated_at');
    table.dropColumn('deleted_at');
  });

  // Recreate simple primary key
  await knex.schema.raw('ALTER TABLE assets ADD PRIMARY KEY (id)');

  // Recreate original indexes
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_filename ON assets(filename)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_mime_type ON assets(mime_type)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_source ON assets(source)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_asset_folder_id ON assets(asset_folder_id)');

  // Recreate original policies
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

  // Re-add original foreign key
  await knex.schema.raw(`
    ALTER TABLE assets
    ADD CONSTRAINT fk_assets_folder
    FOREIGN KEY (asset_folder_id)
    REFERENCES asset_folders(id)
    ON DELETE SET NULL
  `);
}
