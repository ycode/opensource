import type { Knex } from 'knex';

/**
 * Migration: Add SVG Support to Assets
 *
 * - Makes storage_path and public_url nullable for inline SVG icons
 * - Adds content column for storing inline SVG content
 */

export async function up(knex: Knex): Promise<void> {
  // Make storage_path and public_url nullable for SVG assets
  await knex.schema.alterTable('assets', (table) => {
    table.text('storage_path').nullable().alter();
    table.text('public_url').nullable().alter();
  });

  // Add content column for inline SVG content
  await knex.schema.alterTable('assets', (table) => {
    table.text('content').nullable();
  });

  // Add comment for documentation
  await knex.schema.raw(`
    COMMENT ON COLUMN assets.content IS 'Inline SVG content for icon assets. When set, storage_path and public_url should be NULL.'
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Remove content column
  await knex.schema.alterTable('assets', (table) => {
    table.dropColumn('content');
  });

  // Note: We cannot make columns NOT NULL again in the down migration
  // as there might be existing records with NULL values
  // In a real rollback scenario, you'd need to handle this data migration
}
