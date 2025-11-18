import { Knex } from 'knex';

/**
 * Migration: Create collections table
 *
 * Collections are types/categories of structured content (e.g., "Blog Posts", "Categories").
 * Uses EAV (Entity-Attribute-Value) architecture for flexible field management.
 *
 * Uses composite primary key (id, is_published) for draft/published workflow,
 * same pattern as pages, components, and layer_styles tables.
 */
export async function up(knex: Knex): Promise<void> {
  // Create collections table
  await knex.schema.createTable('collections', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.jsonb('sorting').nullable();
    table.integer('order').nullable();
    table.boolean('is_published').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Composite primary key (id, is_published) - same pattern as pages and components
    table.primary(['id', 'is_published']);

    // Indexes
    table.index('is_published');
  });

  console.log('✅ Created collections table');
}

export async function down(knex: Knex): Promise<void> {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('collections');

  if (!tableExists) {
    console.log('⚠️  collections table does not exist, skipping drop');
    return;
  }

  // Drop collections table
  await knex.schema.dropTable('collections');

  console.log('✅ Dropped collections table');
}
