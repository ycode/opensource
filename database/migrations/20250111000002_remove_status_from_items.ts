import { Knex } from 'knex';

/**
 * Migration: Remove status from collection_items
 * 
 * Status is now derived from whether published values exist.
 * No need to maintain item-level status when we have value-level versioning.
 */
export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('collection_items');
  
  if (!tableExists) {
    console.log('⚠️  collection_items table does not exist, skipping migration');
    return;
  }
  
  console.log('Starting migration: remove status from collection_items');
  
  // Drop index on status
  await knex.schema.alterTable('collection_items', (table) => {
    table.dropIndex('status', 'idx_collection_items_status');
  });
  console.log('✅ Dropped index on status');
  
  // Drop status column
  await knex.schema.alterTable('collection_items', (table) => {
    table.dropColumn('status');
  });
  console.log('✅ Dropped status column from collection_items');
  
  console.log('✅ Migration complete: remove_status_from_items');
}

export async function down(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('collection_items');
  
  if (!tableExists) {
    console.log('⚠️  collection_items table does not exist, skipping rollback');
    return;
  }
  
  console.log('Rolling back migration: remove_status_from_items');
  
  // Add status column back
  await knex.schema.alterTable('collection_items', (table) => {
    table.string('status', 255).notNullable().defaultTo('draft');
  });
  
  // Add index back
  await knex.schema.alterTable('collection_items', (table) => {
    table.index('status', 'idx_collection_items_status');
  });
  
  // Restore status based on whether published values exist
  const items = await knex('collection_items')
    .select('id')
    .whereNull('deleted_at');
  
  for (const item of items) {
    // Check if item has published values
    const publishedValues = await knex('collection_item_values')
      .select('id')
      .where('item_id', item.id)
      .where('is_published', true)
      .whereNull('deleted_at')
      .limit(1);
    
    if (publishedValues.length > 0) {
      await knex('collection_items')
        .where('id', item.id)
        .update({ status: 'published' });
    }
  }
  
  console.log('✅ Rollback complete');
}

