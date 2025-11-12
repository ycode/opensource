import { Knex } from 'knex';

/**
 * Migration: Add content_hash columns
 * 
 * Adds content_hash VARCHAR(64) columns to pages, page_layers, components,
 * and layer_styles for efficient change detection and publishing workflows.
 */

export async function up(knex: Knex): Promise<void> {
  // Add content_hash to pages table
  await knex.schema.alterTable('pages', (table) => {
    table.string('content_hash', 64).nullable();
    table.index('content_hash', 'idx_pages_content_hash');
  });
  
  // Add content_hash to page_layers table
  await knex.schema.alterTable('page_layers', (table) => {
    table.string('content_hash', 64).nullable();
    table.index('content_hash', 'idx_page_layers_content_hash');
  });
  
  // Add content_hash to components table
  await knex.schema.alterTable('components', (table) => {
    table.string('content_hash', 64).nullable();
    table.index('content_hash', 'idx_components_content_hash');
  });
  
  // Add content_hash to layer_styles table
  await knex.schema.alterTable('layer_styles', (table) => {
    table.string('content_hash', 64).nullable();
    table.index('content_hash', 'idx_layer_styles_content_hash');
  });
}

export async function down(knex: Knex): Promise<void> {
  // Remove from pages
  await knex.schema.alterTable('pages', (table) => {
    table.dropIndex('content_hash', 'idx_pages_content_hash');
    table.dropColumn('content_hash');
  });
  
  // Remove from page_layers
  await knex.schema.alterTable('page_layers', (table) => {
    table.dropIndex('content_hash', 'idx_page_layers_content_hash');
    table.dropColumn('content_hash');
  });
  
  // Remove from components
  await knex.schema.alterTable('components', (table) => {
    table.dropIndex('content_hash', 'idx_components_content_hash');
    table.dropColumn('content_hash');
  });
  
  // Remove from layer_styles
  await knex.schema.alterTable('layer_styles', (table) => {
    table.dropIndex('content_hash', 'idx_layer_styles_content_hash');
    table.dropColumn('content_hash');
  });
}

