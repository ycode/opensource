import { Knex } from 'knex';

/**
 * Migration: Create collection_fields table
 *
 * Field definitions for each collection (e.g., "title", "slug", "content").
 * Defines the schema for collection items using EAV model.
 *
 * Uses composite primary key (id, is_published) for draft/published workflow,
 * same pattern as pages, components, and layer_styles tables.
 */
export async function up(knex: Knex): Promise<void> {
  // Create collection_fields table
  await knex.schema.createTable('collection_fields', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('collection_id').notNullable();
    table.uuid('reference_collection_id').nullable();
    table.string('name', 255).notNullable();
    table.string('type', 255).notNullable();
    table.string('default', 255).nullable();
    table.boolean('built_in').notNullable().defaultTo(false);
    table.boolean('fillable').notNullable().defaultTo(true);
    table.integer('order').notNullable();
    table.boolean('hidden').notNullable().defaultTo(false);
    table.jsonb('data').notNullable().defaultTo('{}');
    table.boolean('is_published').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Composite primary key (id, is_published)
    table.primary(['id', 'is_published']);

    // Indexes
    table.index('collection_id');
    table.index('is_published');
    table.index('type');
  });

  // Add composite foreign key to collections
  await knex.raw(`
    ALTER TABLE collection_fields
    ADD CONSTRAINT collection_fields_collection_fkey
    FOREIGN KEY (collection_id, is_published)
    REFERENCES collections(id, is_published)
    ON DELETE CASCADE
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('collection_fields');
}
