import { Knex } from 'knex';

/**
 * Migration: Change collections.id from bigint to UUID
 * 
 * This migration:
 * 1. Creates a new uuid column in collections
 * 2. Updates all foreign key references in collection_fields, collection_items
 * 3. Drops the old id column and renames uuid to id
 * 4. Updates all indexes and constraints
 * 
 * This is a destructive migration - it will delete existing collections data.
 * Run this BEFORE creating any collections in production.
 */
export async function up(knex: Knex): Promise<void> {
  console.log('Starting migration: change collections.id to UUID');
  
  const tableExists = await knex.schema.hasTable('collections');
  
  if (!tableExists) {
    console.log('⚠️  collections table does not exist, skipping migration');
    return;
  }
  
  // Check if id is already UUID type
  const result = await knex.raw(`
    SELECT data_type 
    FROM information_schema.columns 
    WHERE table_name = 'collections' 
    AND column_name = 'id'
  `);
  
  if (result.rows[0]?.data_type === 'uuid') {
    console.log('⚠️  collections.id is already UUID type, skipping migration');
    return;
  }
  
  console.log('⚠️  WARNING: This migration will DELETE all existing collections data');
  
  // Step 1: Delete all existing data (foreign key constraints will cascade)
  await knex('collection_item_values').del();
  await knex('collection_items').del();
  await knex('collection_fields').del();
  await knex('collections').del();
  console.log('✅ Deleted all existing collections data');
  
  // Step 2: Drop foreign key constraints in dependent tables
  const fieldsTableExists = await knex.schema.hasTable('collection_fields');
  const itemsTableExists = await knex.schema.hasTable('collection_items');
  
  if (fieldsTableExists) {
    await knex.schema.alterTable('collection_fields', (table) => {
      table.dropForeign(['collection_id']);
      table.dropForeign(['reference_collection_id']);
    });
    console.log('✅ Dropped foreign keys from collection_fields');
  }
  
  if (itemsTableExists) {
    await knex.schema.alterTable('collection_items', (table) => {
      table.dropForeign(['collection_id']);
    });
    console.log('✅ Dropped foreign keys from collection_items');
  }
  
  // Step 3: Drop old id column and create new uuid primary key
  await knex.schema.alterTable('collections', (table) => {
    table.dropPrimary();
    table.dropColumn('id');
  });
  
  await knex.schema.alterTable('collections', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
  });
  console.log('✅ Changed collections.id to UUID with primary key');
  
  // Step 4: Update collection_fields to use UUID foreign keys
  if (fieldsTableExists) {
    await knex.schema.alterTable('collection_fields', (table) => {
      table.dropColumn('collection_id');
      table.dropColumn('reference_collection_id');
    });
    
    await knex.schema.alterTable('collection_fields', (table) => {
      table.uuid('collection_id').notNullable()
        .references('id').inTable('collections').onDelete('CASCADE');
      table.uuid('reference_collection_id').nullable()
        .references('id').inTable('collections');
    });
    console.log('✅ Updated collection_fields foreign keys to UUID');
  }
  
  // Step 5: Update collection_items to use UUID foreign key
  if (itemsTableExists) {
    await knex.schema.alterTable('collection_items', (table) => {
      table.dropColumn('collection_id');
    });
    
    await knex.schema.alterTable('collection_items', (table) => {
      table.uuid('collection_id').notNullable()
        .references('id').inTable('collections').onDelete('CASCADE');
    });
    console.log('✅ Updated collection_items foreign key to UUID');
  }
  
  // Step 6: Recreate indexes
  if (fieldsTableExists) {
    await knex.schema.raw('DROP INDEX IF EXISTS idx_collection_fields_collection_id');
    await knex.schema.raw('CREATE INDEX idx_collection_fields_collection_id ON collection_fields(collection_id)');
  }
  
  if (itemsTableExists) {
    await knex.schema.raw('DROP INDEX IF EXISTS idx_collection_items_collection_id');
    await knex.schema.raw('CREATE INDEX idx_collection_items_collection_id ON collection_items(collection_id)');
  }
  
  console.log('✅ Migration complete: change_collections_id_to_uuid');
}

export async function down(knex: Knex): Promise<void> {
  console.log('Rolling back migration: change_collections_id_to_uuid');
  console.log('⚠️  WARNING: This rollback will DELETE all collections data');
  
  const tableExists = await knex.schema.hasTable('collections');
  
  if (!tableExists) {
    console.log('⚠️  collections table does not exist, skipping rollback');
    return;
  }
  
  // Delete all data
  await knex('collection_item_values').del();
  await knex('collection_items').del();
  await knex('collection_fields').del();
  await knex('collections').del();
  
  const fieldsTableExists = await knex.schema.hasTable('collection_fields');
  const itemsTableExists = await knex.schema.hasTable('collection_items');
  
  // Drop foreign keys
  if (fieldsTableExists) {
    await knex.schema.alterTable('collection_fields', (table) => {
      table.dropForeign(['collection_id']);
      table.dropForeign(['reference_collection_id']);
    });
  }
  
  if (itemsTableExists) {
    await knex.schema.alterTable('collection_items', (table) => {
      table.dropForeign(['collection_id']);
    });
  }
  
  // Change collections back to bigint
  await knex.schema.alterTable('collections', (table) => {
    table.dropPrimary();
    table.dropColumn('id');
  });
  
  await knex.schema.alterTable('collections', (table) => {
    table.bigIncrements('id').primary();
  });
  
  // Update foreign keys back to bigint
  if (fieldsTableExists) {
    await knex.schema.alterTable('collection_fields', (table) => {
      table.dropColumn('collection_id');
      table.dropColumn('reference_collection_id');
    });
    
    await knex.schema.alterTable('collection_fields', (table) => {
      table.bigInteger('collection_id').notNullable()
        .references('id').inTable('collections').onDelete('CASCADE');
      table.bigInteger('reference_collection_id').nullable()
        .references('id').inTable('collections');
    });
  }
  
  if (itemsTableExists) {
    await knex.schema.alterTable('collection_items', (table) => {
      table.dropColumn('collection_id');
    });
    
    await knex.schema.alterTable('collection_items', (table) => {
      table.bigInteger('collection_id').notNullable()
        .references('id').inTable('collections').onDelete('CASCADE');
    });
  }
  
  // Recreate indexes
  if (fieldsTableExists) {
    await knex.schema.raw('DROP INDEX IF EXISTS idx_collection_fields_collection_id');
    await knex.schema.raw('CREATE INDEX idx_collection_fields_collection_id ON collection_fields(collection_id)');
  }
  
  if (itemsTableExists) {
    await knex.schema.raw('DROP INDEX IF EXISTS idx_collection_items_collection_id');
    await knex.schema.raw('CREATE INDEX idx_collection_items_collection_id ON collection_items(collection_id)');
  }
  
  console.log('✅ Rollback complete: change_collections_id_to_uuid');
}
