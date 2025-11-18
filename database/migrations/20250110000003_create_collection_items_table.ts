import { Knex } from 'knex';

/**
 * Migration: Create collection_items table
 *
 * Individual collection entries (EAV "Entities").
 * Each row represents one item (e.g., a blog post, a category).
 *
 * Uses composite primary key (id, is_published) for draft/published workflow,
 * same pattern as pages, components, and layer_styles tables.
 */
export async function up(knex: Knex): Promise<void> {
  // Create collection_items table
  await knex.schema.createTable('collection_items', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('collection_id').notNullable();
    table.bigInteger('manual_order').notNullable().defaultTo(0);
    table.boolean('is_published').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Composite primary key (id, is_published)
    table.primary(['id', 'is_published']);

    // Indexes
    table.index('collection_id');
    table.index('is_published');
  });

  // Add composite foreign key to collections
  await knex.raw(`
    ALTER TABLE collection_items
    ADD CONSTRAINT collection_items_collection_fkey
    FOREIGN KEY (collection_id, is_published)
    REFERENCES collections(id, is_published)
    ON DELETE CASCADE
  `);

  console.log('✅ Created collection_items table');
}

export async function down(knex: Knex): Promise<void> {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('collection_items');

  if (!tableExists) {
    console.log('⚠️  collection_items table does not exist, skipping drop');
    return;
  }

  // Drop collection_items table
  await knex.schema.dropTable('collection_items');

  console.log('✅ Dropped collection_items table');
}
