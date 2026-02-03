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
    table.string('key', 255).nullable(); // built-in fields have a key to identify them
    table.string('type', 255).notNullable();
    table.string('default', 255).nullable();
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

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE collection_fields ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  // Single SELECT policy: public can view published OR authenticated can view all
  await knex.schema.raw(`
    CREATE POLICY "Collection fields are viewable"
      ON collection_fields FOR SELECT
      USING (
        (is_published = true AND deleted_at IS NULL)
        OR (SELECT auth.uid()) IS NOT NULL
      )
  `);

  // Authenticated users can INSERT/UPDATE/DELETE
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can modify collection fields"
      ON collection_fields FOR INSERT
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can update collection fields"
      ON collection_fields FOR UPDATE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can delete collection fields"
      ON collection_fields FOR DELETE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Collection fields are viewable" ON collection_fields');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can modify collection fields" ON collection_fields');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can update collection fields" ON collection_fields');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can delete collection fields" ON collection_fields');

  await knex.schema.dropTableIfExists('collection_fields');
}
