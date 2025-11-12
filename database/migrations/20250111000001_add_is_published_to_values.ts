import { Knex } from 'knex';

/**
 * Migration: Add is_published to collection_item_values
 * 
 * Changes collection_item_values from item-level status to value-level versioning.
 * Each field value can now exist in both draft and published states.
 */
export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('collection_item_values');
  
  if (!tableExists) {
    console.log('⚠️  collection_item_values table does not exist, skipping migration');
    return;
  }
  
  console.log('Starting migration: add is_published to collection_item_values');
  
  // 1. Add is_published column (default false for draft)
  await knex.schema.alterTable('collection_item_values', (table) => {
    table.boolean('is_published').notNullable().defaultTo(false);
  });
  console.log('✅ Added is_published column');
  
  // 2. Add index on is_published for query performance
  await knex.schema.alterTable('collection_item_values', (table) => {
    table.index('is_published', 'idx_collection_item_values_is_published');
  });
  console.log('✅ Added index on is_published');
  
  // 3. Drop old unique constraint (item_id + field_id)
  await knex.raw(`
    DROP INDEX IF EXISTS idx_collection_item_values_unique
  `);
  console.log('✅ Dropped old unique constraint');
  
  // 4. Add new unique constraint (item_id + field_id + is_published)
  // This allows one draft and one published value per field per item
  await knex.raw(`
    CREATE UNIQUE INDEX idx_collection_item_values_unique_published 
    ON collection_item_values(item_id, field_id, is_published) 
    WHERE deleted_at IS NULL
  `);
  console.log('✅ Added new unique constraint with is_published');
  
  // 5. Migrate existing data
  // All existing values become draft (is_published = false already set by default)
  
  // 6. For items with status='published', duplicate their values as published
  const publishedItems = await knex('collection_items')
    .select('id')
    .where('status', 'published')
    .whereNull('deleted_at');
  
  console.log(`Found ${publishedItems.length} published items to migrate`);
  
  for (const item of publishedItems) {
    // Get all draft values for this item
    const draftValues = await knex('collection_item_values')
      .select('*')
      .where('item_id', item.id)
      .where('is_published', false)
      .whereNull('deleted_at');
    
    // Duplicate each value as published
    for (const value of draftValues) {
      await knex('collection_item_values').insert({
        value: value.value,
        item_id: value.item_id,
        field_id: value.field_id,
        is_published: true,
        backup_id: value.backup_id,
        uniqid: value.uniqid,
        created_at: value.created_at,
        updated_at: knex.fn.now(),
      });
    }
  }
  
  console.log('✅ Migrated published items data');
  
  // 7. Drop status column from collection_item_values (no longer needed)
  await knex.schema.alterTable('collection_item_values', (table) => {
    table.dropColumn('status');
  });
  console.log('✅ Dropped status column from values table');
  
  console.log('✅ Migration complete: add_is_published_to_values');
}

export async function down(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('collection_item_values');
  
  if (!tableExists) {
    console.log('⚠️  collection_item_values table does not exist, skipping rollback');
    return;
  }
  
  console.log('Rolling back migration: add_is_published_to_values');
  
  // 1. Add status column back
  await knex.schema.alterTable('collection_item_values', (table) => {
    table.string('status', 255).notNullable().defaultTo('draft');
  });
  
  // 2. Drop new unique constraint
  await knex.raw(`
    DROP INDEX IF EXISTS idx_collection_item_values_unique_published
  `);
  
  // 3. Restore old unique constraint
  await knex.raw(`
    CREATE UNIQUE INDEX idx_collection_item_values_unique 
    ON collection_item_values(item_id, field_id) 
    WHERE deleted_at IS NULL
  `);
  
  // 4. Delete published values (keep only draft)
  await knex('collection_item_values')
    .where('is_published', true)
    .delete();
  
  // 5. Drop is_published column and index
  await knex.schema.alterTable('collection_item_values', (table) => {
    table.dropIndex('is_published', 'idx_collection_item_values_is_published');
    table.dropColumn('is_published');
  });
  
  console.log('✅ Rollback complete');
}

