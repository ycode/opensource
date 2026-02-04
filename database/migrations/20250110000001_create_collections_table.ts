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
    table.uuid('uuid').notNullable().unique().defaultTo(knex.raw('gen_random_uuid()')); // Unique identifier for URL routing
    table.jsonb('sorting').nullable();
    table.integer('order').notNullable().defaultTo(0);
    table.boolean('is_published').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Composite primary key (id, is_published) - same pattern as pages and components
    table.primary(['id', 'is_published']);

    // Indexes
    table.index('is_published');
    table.index('uuid', 'idx_collections_uuid');
  });

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE collections ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  // Single SELECT policy: public can view published OR authenticated can view all
  await knex.schema.raw(`
    CREATE POLICY "Collections are viewable"
      ON collections FOR SELECT
      USING (
        (is_published = true AND deleted_at IS NULL)
        OR (SELECT auth.uid()) IS NOT NULL
      )
  `);

  // Authenticated users can INSERT/UPDATE/DELETE
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can modify collections"
      ON collections FOR INSERT
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can update collections"
      ON collections FOR UPDATE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can delete collections"
      ON collections FOR DELETE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Collections are viewable" ON collections');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can modify collections" ON collections');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can update collections" ON collections');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can delete collections" ON collections');

  await knex.schema.dropTableIfExists('collections');
}
