import type { Knex } from 'knex';

/**
 * Migration: Create Asset Folders
 *
 * Creates the asset_folders table and adds asset_folder_id to assets table
 */

export async function up(knex: Knex): Promise<void> {
  // Create asset_folders table
  await knex.schema.createTable('asset_folders', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('asset_folder_id').nullable();
    table.string('name', 255).notNullable();
    table.integer('depth').notNullable().defaultTo(0);
    table.integer('order').notNullable().defaultTo(0);
    table.boolean('is_published').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Composite primary key
    table.primary(['id', 'is_published']);
  });

  // Add unique constraint on id alone (allows foreign keys to reference just id)
  await knex.schema.raw('CREATE UNIQUE INDEX idx_asset_folders_id_unique ON asset_folders(id)');

  // Add foreign key constraint for self-referential parent folder (includes is_published)
  await knex.schema.raw(`
    ALTER TABLE asset_folders
    ADD CONSTRAINT fk_asset_folders_parent
    FOREIGN KEY (asset_folder_id, is_published)
    REFERENCES asset_folders(id, is_published)
    ON DELETE SET NULL
  `);

  // Create indexes (partial indexes for soft delete support)
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_asset_folders_asset_folder_id ON asset_folders(asset_folder_id, is_published) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_asset_folders_name ON asset_folders(name, is_published) WHERE deleted_at IS NULL');

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE asset_folders ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  await knex.schema.raw(`
    CREATE POLICY "Public can view published asset folders"
      ON asset_folders FOR SELECT
      USING (is_published = true AND deleted_at IS NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can manage asset folders"
      ON asset_folders FOR ALL
      USING (auth.uid() IS NOT NULL)
  `);

  // Add asset_folder_id column to assets table
  await knex.schema.alterTable('assets', (table) => {
    table.uuid('asset_folder_id').nullable();
  });

  // Add foreign key constraint
  await knex.schema.raw(`
    ALTER TABLE assets
    ADD CONSTRAINT fk_assets_folder
    FOREIGN KEY (asset_folder_id)
    REFERENCES asset_folders(id)
    ON DELETE SET NULL
  `);

  // Create index
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_assets_asset_folder_id ON assets(asset_folder_id)');
}

export async function down(knex: Knex): Promise<void> {
  // Drop foreign key and column from assets
  await knex.schema.alterTable('assets', (table) => {
    table.dropColumn('asset_folder_id');
  });

  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Public can view published asset folders" ON asset_folders');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can manage asset folders" ON asset_folders');

  // Drop unique index
  await knex.schema.raw('DROP INDEX IF EXISTS idx_asset_folders_id_unique');

  // Drop asset_folders table
  await knex.schema.dropTableIfExists('asset_folders');
}
