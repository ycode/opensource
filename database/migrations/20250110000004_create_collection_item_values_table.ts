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

  console.log('✅ Created collection_item_values table');
}

export async function down(knex: Knex): Promise<void> {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('collection_item_values');

  if (!tableExists) {
    console.log('⚠️  collection_item_values table does not exist, skipping drop');
    return;
  }

  // Drop collection_item_values table
  await knex.schema.dropTable('collection_item_values');

  console.log('✅ Dropped collection_item_values table');
}







