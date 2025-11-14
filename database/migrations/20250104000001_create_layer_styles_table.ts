import { Knex } from 'knex';

/**
 * Migration: Create layer_styles table
 * 
 * Layer styles are reusable design configurations that can be applied to multiple layers.
 * They are part of the page draft and get published when the page is published.
 * 
 * Includes versioning (is_published, publish_key) and content_hash for
 * draft/published workflow and change detection.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('layer_styles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 255).notNullable();
    
    // Style data
    table.text('classes').notNullable();
    table.jsonb('design');
    
    // Versioning for draft/published workflow
    table.boolean('is_published').notNullable().defaultTo(false);
    table.string('publish_key', 255).notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Content hash for change detection
    table.string('content_hash', 64).nullable();
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('name');
    table.index('publish_key', 'idx_layer_styles_publish_key');
    table.index('is_published', 'idx_layer_styles_is_published');
    table.index('content_hash', 'idx_layer_styles_content_hash');
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
  
  await knex.schema.dropTableIfExists('layer_styles');
}

