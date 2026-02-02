import type { Knex } from 'knex';

/**
 * Migration: Fix asset_folders unique index
 *
 * The original unique index on just `id` prevents having both draft and published
 * versions of the same folder. We need to change it to a partial index that only
 * enforces uniqueness within each is_published state.
 */

export async function up(knex: Knex): Promise<void> {
  // Drop the problematic unique index that prevents draft/published duplicates
  await knex.schema.raw('DROP INDEX IF EXISTS idx_asset_folders_id_unique');

  // Create a partial unique index for drafts only (if needed for foreign keys)
  // This allows the same ID to exist for both is_published=false and is_published=true
  await knex.schema.raw(`
    CREATE UNIQUE INDEX idx_asset_folders_draft_id_unique
    ON asset_folders(id)
    WHERE is_published = false AND deleted_at IS NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop the partial unique index
  await knex.schema.raw('DROP INDEX IF EXISTS idx_asset_folders_draft_id_unique');

  // Restore the original unique index (this may fail if there are duplicates)
  await knex.schema.raw('CREATE UNIQUE INDEX idx_asset_folders_id_unique ON asset_folders(id)');
}
