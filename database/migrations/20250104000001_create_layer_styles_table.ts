import { Knex } from 'knex';

/**
 * Migration: Create layer_styles table
 * 
 * Layer styles are reusable design configurations that can be applied to multiple layers.
 * They are part of the page draft and get published when the page is published.
 * 
 * Uses composite primary key (id, is_published) for draft/published workflow,
 * same pattern as pages and components tables. Includes content_hash for change detection.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('layer_styles', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    
    // Style data
    table.text('classes').notNullable();
    table.jsonb('design');
    
    // Versioning for draft/published workflow
    table.boolean('is_published').notNullable().defaultTo(false);
    
    // Content hash for change detection
    table.string('content_hash', 64).nullable();
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Composite primary key (id, is_published) - same pattern as pages and components
    table.primary(['id', 'is_published']);
    
    // Indexes
    table.index('name');
    table.index('is_published');
    table.index('content_hash');
    
    // Unique index to allow draft + published versions with same name
    table.unique(['name', 'is_published']);
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop table (indexes are dropped automatically)
  await knex.schema.dropTableIfExists('layer_styles');
}
