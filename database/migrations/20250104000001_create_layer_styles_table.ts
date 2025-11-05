import { Knex } from 'knex';

/**
 * Migration: Create layer_styles table
 * 
 * Layer styles are reusable design configurations that can be applied to multiple layers.
 * They are part of the page draft and get published when the page is published.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('layer_styles', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 255).notNullable();
    
    // Style data (single version)
    table.text('classes').notNullable();
    table.jsonb('design');
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('name');
  });
  
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('layer_styles');
}

