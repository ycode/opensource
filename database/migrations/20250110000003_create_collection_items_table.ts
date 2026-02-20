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
    table.boolean('is_publishable').notNullable().defaultTo(true);
    table.boolean('is_published').notNullable().defaultTo(false);
    table.text('content_hash').nullable();
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

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  // Single SELECT policy: public can view published OR authenticated can view all
  await knex.schema.raw(`
    CREATE POLICY "Collection items are viewable"
      ON collection_items FOR SELECT
      USING (
        (is_published = true AND deleted_at IS NULL)
        OR (SELECT auth.uid()) IS NOT NULL
      )
  `);

  // Authenticated users can INSERT/UPDATE/DELETE
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can modify collection items"
      ON collection_items FOR INSERT
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can update collection items"
      ON collection_items FOR UPDATE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can delete collection items"
      ON collection_items FOR DELETE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Collection items are viewable" ON collection_items');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can modify collection items" ON collection_items');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can update collection items" ON collection_items');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can delete collection items" ON collection_items');

  await knex.schema.dropTableIfExists('collection_items');
}
