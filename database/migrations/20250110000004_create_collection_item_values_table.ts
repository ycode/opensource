import { Knex } from 'knex';

/**
 * Migration: Create collection_item_values table
 *
 * Field values for collection items (EAV "Values").
 * Each row represents one field value for one item.
 * Values stored as text and cast based on field type.
 *
 * Uses composite primary key (id, is_published) for draft/published workflow,
 * same pattern as pages, components, and layer_styles tables.
 */
export async function up(knex: Knex): Promise<void> {
  // Create collection_item_values table
  await knex.schema.createTable('collection_item_values', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    table.text('value').nullable();
    table.uuid('item_id').notNullable();
    table.uuid('field_id').notNullable();
    table.boolean('is_published').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Composite primary key (id, is_published)
    table.primary(['id', 'is_published']);

    // Indexes
    table.index('item_id');
    table.index('field_id');
    table.index('is_published');
  });

  // Add composite foreign keys
  await knex.raw(`
    ALTER TABLE collection_item_values
    ADD CONSTRAINT collection_item_values_item_fkey
    FOREIGN KEY (item_id, is_published)
    REFERENCES collection_items(id, is_published)
    ON DELETE CASCADE
  `);

  await knex.raw(`
    ALTER TABLE collection_item_values
    ADD CONSTRAINT collection_item_values_field_fkey
    FOREIGN KEY (field_id, is_published)
    REFERENCES collection_fields(id, is_published)
    ON DELETE CASCADE
  `);

  // Add unique constraint on item_id + field_id + is_published
  // This allows one draft and one published value per field per item
  await knex.raw(`
    CREATE UNIQUE INDEX idx_collection_item_values_unique
    ON collection_item_values(item_id, field_id, is_published)
    WHERE deleted_at IS NULL
  `);

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE collection_item_values ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  // Single SELECT policy: public can view published OR authenticated can view all
  await knex.schema.raw(`
    CREATE POLICY "Collection item values are viewable"
      ON collection_item_values FOR SELECT
      USING (
        (is_published = true AND deleted_at IS NULL)
        OR (SELECT auth.uid()) IS NOT NULL
      )
  `);

  // Authenticated users can INSERT/UPDATE/DELETE
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can modify collection item values"
      ON collection_item_values FOR INSERT
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can update collection item values"
      ON collection_item_values FOR UPDATE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can delete collection item values"
      ON collection_item_values FOR DELETE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Collection item values are viewable" ON collection_item_values');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can modify collection item values" ON collection_item_values');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can update collection item values" ON collection_item_values');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can delete collection item values" ON collection_item_values');

  await knex.schema.dropTableIfExists('collection_item_values');
}
