import { Knex } from 'knex';

/**
 * Migration: Create collections table
 * 
 * Collections are types/categories of structured content (e.g., "Blog Posts", "Categories").
 * Uses EAV (Entity-Attribute-Value) architecture for flexible field management.
 */
export async function up(knex: Knex): Promise<void> {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('collections');
  
  if (tableExists) {
    console.log('⚠️  collections table already exists, skipping creation');
    return;
  }
  
  // Create collections table
  await knex.schema.createTable('collections', (table) => {
    table.bigIncrements('id').primary();
    table.string('name', 255).notNullable();
    table.string('collection_name', 255).notNullable().unique();
    table.timestamp('created_at', { precision: 0 }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { precision: 0 }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { precision: 0 }).nullable();
    table.jsonb('sorting').nullable();
    table.string('temp_id', 255).nullable();
    table.integer('order').nullable();
    table.string('status', 255).notNullable().defaultTo('draft');
    
    // Indexes
    table.index('collection_name', 'idx_collections_collection_name');
    table.index('status', 'idx_collections_status');
  });
  
  console.log('✅ Created collections table');
}

export async function down(knex: Knex): Promise<void> {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('collections');
  
  if (!tableExists) {
    console.log('⚠️  collections table does not exist, skipping drop');
    return;
  }
  
  // Drop collections table
  await knex.schema.dropTable('collections');
  
  console.log('✅ Dropped collections table');
}







