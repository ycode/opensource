import { Knex } from 'knex';

/**
 * Migration: Add versioning to layer_styles
 * 
 * Adds is_published and publish_key columns to support draft/published workflow.
 * Allows dual-record pattern where draft and published versions coexist.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('layer_styles', (table) => {
    // Add versioning columns
    table.boolean('is_published').notNullable().defaultTo(false);
    table.string('publish_key', 255).notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Add index on publish_key for efficient lookups
    table.index('publish_key', 'idx_layer_styles_publish_key');
    
    // Add index on is_published for filtering
    table.index('is_published', 'idx_layer_styles_is_published');
  });
  
  // Create unique index to allow draft + published versions with same name
  await knex.schema.raw(`
    CREATE UNIQUE INDEX idx_layer_styles_name_is_published_unique
    ON layer_styles(name, is_published)
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop unique index
  await knex.schema.raw('DROP INDEX IF EXISTS idx_layer_styles_name_is_published_unique');
  
  await knex.schema.alterTable('layer_styles', (table) => {
    // Drop indexes
    table.dropIndex('publish_key', 'idx_layer_styles_publish_key');
    table.dropIndex('is_published', 'idx_layer_styles_is_published');
    
    // Drop columns
    table.dropColumn('is_published');
    table.dropColumn('publish_key');
  });
}

