import { Knex } from 'knex';

/**
 * Migration: Remove unused fields from collections tables
 * 
 * Removes is_promotable, backup_id, temp_id from:
 * - collection_items
 * - collection_item_values  
 * - collection_fields
 * - collections
 * 
 * These fields were never used for any business logic.
 */
export async function up(knex: Knex): Promise<void> {
  console.log('Starting migration: remove unused fields');
  
  // 1. Remove from collection_items
  const itemsTableExists = await knex.schema.hasTable('collection_items');
  if (itemsTableExists) {
    await knex.schema.alterTable('collection_items', (table) => {
      table.dropColumn('is_promotable');
      table.dropColumn('backup_id');
      table.dropColumn('temp_id');
    });
    console.log('✅ Removed unused fields from collection_items');
  }
  
  // 2. Remove from collection_item_values
  const valuesTableExists = await knex.schema.hasTable('collection_item_values');
  if (valuesTableExists) {
    await knex.schema.alterTable('collection_item_values', (table) => {
      table.dropColumn('backup_id');
      table.dropColumn('uniqid');
    });
    console.log('✅ Removed unused fields from collection_item_values');
  }
  
  // 3. Remove from collection_fields
  const fieldsTableExists = await knex.schema.hasTable('collection_fields');
  if (fieldsTableExists) {
    await knex.schema.alterTable('collection_fields', (table) => {
      table.dropColumn('temp_id');
    });
    console.log('✅ Removed temp_id from collection_fields');
  }
  
  // 4. Remove from collections
  const collectionsTableExists = await knex.schema.hasTable('collections');
  if (collectionsTableExists) {
    await knex.schema.alterTable('collections', (table) => {
      table.dropColumn('temp_id');
    });
    console.log('✅ Removed temp_id from collections');
  }
  
  console.log('✅ Migration complete: remove_unused_fields');
}

export async function down(knex: Knex): Promise<void> {
  console.log('Rolling back migration: remove_unused_fields');
  
  // 1. Restore to collection_items
  const itemsTableExists = await knex.schema.hasTable('collection_items');
  if (itemsTableExists) {
    await knex.schema.alterTable('collection_items', (table) => {
      table.boolean('is_promotable').notNullable().defaultTo(true);
      table.bigInteger('backup_id').nullable();
      table.string('temp_id', 255).nullable();
    });
  }
  
  // 2. Restore to collection_item_values
  const valuesTableExists = await knex.schema.hasTable('collection_item_values');
  if (valuesTableExists) {
    await knex.schema.alterTable('collection_item_values', (table) => {
      table.bigInteger('backup_id').nullable();
      table.string('uniqid', 255).nullable();
    });
  }
  
  // 3. Restore to collection_fields
  const fieldsTableExists = await knex.schema.hasTable('collection_fields');
  if (fieldsTableExists) {
    await knex.schema.alterTable('collection_fields', (table) => {
      table.string('temp_id', 255).nullable();
    });
  }
  
  // 4. Restore to collections
  const collectionsTableExists = await knex.schema.hasTable('collections');
  if (collectionsTableExists) {
    await knex.schema.alterTable('collections', (table) => {
      table.string('temp_id', 255).nullable();
    });
  }
  
  console.log('✅ Rollback complete');
}

