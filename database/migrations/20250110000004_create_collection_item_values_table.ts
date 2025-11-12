import { Knex } from 'knex';

/**
 * Migration: Create collection_item_values table
 * 
 * Field values for collection items (EAV "Values").
 * Each row represents one field value for one item.
 * Values stored as text and cast based on field type.
 */
export async function up(knex: Knex): Promise<void> {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('collection_item_values');
  
  if (tableExists) {
    console.log('⚠️  collection_item_values table already exists, skipping creation');
    return;
  }
  
  // Create collection_item_values table
  await knex.schema.createTable('collection_item_values', (table) => {
    table.bigIncrements('id').primary();
    table.text('value').nullable();
    table.bigInteger('item_id').notNullable()
      .references('id').inTable('collection_items').onDelete('CASCADE');
    table.bigInteger('field_id').notNullable()
      .references('id').inTable('collection_fields').onDelete('CASCADE');
    table.timestamp('created_at', { precision: 0 }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { precision: 0 }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { precision: 0 }).nullable();
    table.bigInteger('backup_id').nullable();
    table.string('status', 255).notNullable().defaultTo('draft');
    table.string('uniqid', 255).nullable();
    
    // Indexes
    table.index('item_id', 'idx_collection_item_values_item_id');
    table.index('field_id', 'idx_collection_item_values_field_id');
  });
  
  // Add unique constraint on item_id + field_id (one value per field per item)
  await knex.raw(`
    CREATE UNIQUE INDEX idx_collection_item_values_unique 
    ON collection_item_values(item_id, field_id) 
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



