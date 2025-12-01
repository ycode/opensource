import { Knex } from 'knex';

/**
 * Migration: Replace collection_name with uuid
 * 
 * This migration:
 * 1. Drops the unique constraint on collection_name
 * 2. Drops the collection_name column (allows duplicate names)
 * 3. Adds a uuid column as a unique identifier
 * 4. Removes the collection_name index
 * 5. Adds index on uuid
 */
export async function up(knex: Knex): Promise<void> {
  console.log('Starting migration: replace collection_name with uuid');
  
  const tableExists = await knex.schema.hasTable('collections');
  
  if (!tableExists) {
    console.log('⚠️  collections table does not exist, skipping migration');
    return;
  }
  
  // Check if uuid column already exists
  const hasUuid = await knex.schema.hasColumn('collections', 'uuid');
  const hasCollectionName = await knex.schema.hasColumn('collections', 'collection_name');
  
  if (hasUuid && !hasCollectionName) {
    console.log('⚠️  Migration already applied, skipping');
    return;
  }
  
  await knex.schema.alterTable('collections', (table) => {
    // Drop unique constraint and index on collection_name
    if (hasCollectionName) {
      table.dropUnique(['collection_name'], 'collections_collection_name_unique');
      table.dropIndex(['collection_name'], 'idx_collections_collection_name');
      table.dropColumn('collection_name');
      console.log('✅ Dropped collection_name column and constraints');
    }
    
    // Add uuid column
    if (!hasUuid) {
      table.uuid('uuid').notNullable().unique().defaultTo(knex.raw('gen_random_uuid()'));
      table.index('uuid', 'idx_collections_uuid');
      console.log('✅ Added uuid column with unique constraint and index');
    }
  });
  
  console.log('✅ Migration complete: replace_collection_name_with_uuid');
}

export async function down(knex: Knex): Promise<void> {
  console.log('Rolling back migration: replace_collection_name_with_uuid');
  
  const tableExists = await knex.schema.hasTable('collections');
  
  if (!tableExists) {
    console.log('⚠️  collections table does not exist, skipping rollback');
    return;
  }
  
  const hasUuid = await knex.schema.hasColumn('collections', 'uuid');
  const hasCollectionName = await knex.schema.hasColumn('collections', 'collection_name');
  
  await knex.schema.alterTable('collections', (table) => {
    // Remove uuid column
    if (hasUuid) {
      table.dropIndex(['uuid'], 'idx_collections_uuid');
      table.dropColumn('uuid');
      console.log('✅ Dropped uuid column and index');
    }
    
    // Re-add collection_name column
    if (!hasCollectionName) {
      table.string('collection_name', 255).notNullable().unique();
      table.index('collection_name', 'idx_collections_collection_name');
      console.log('✅ Re-added collection_name column with unique constraint');
    }
  });
  
  console.log('✅ Rollback complete: replace_collection_name_with_uuid');
}
