import { Knex } from 'knex';

/**
 * Migration: Create collection_fields table
 * 
 * Field definitions for each collection (e.g., "title", "slug", "content").
 * Defines the schema for collection items using EAV model.
 */
export async function up(knex: Knex): Promise<void> {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('collection_fields');
  
  if (tableExists) {
    console.log('⚠️  collection_fields table already exists, skipping creation');
    return;
  }
  
  // Create collection_fields table
  await knex.schema.createTable('collection_fields', (table) => {
    table.bigIncrements('id').primary();
    table.string('name', 255).notNullable();
    table.string('field_name', 255).notNullable();
    table.string('type', 255).notNullable();
    table.string('default', 255).nullable();
    table.boolean('fillable').notNullable().defaultTo(true);
    table.boolean('built_in').notNullable().defaultTo(false);
    table.integer('order').notNullable();
    table.bigInteger('collection_id').notNullable()
      .references('id').inTable('collections').onDelete('CASCADE');
    table.bigInteger('reference_collection_id').nullable()
      .references('id').inTable('collections');
    table.timestamp('created_at', { precision: 0 }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { precision: 0 }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { precision: 0 }).nullable();
    table.boolean('hidden').notNullable().defaultTo(false);
    table.string('temp_id', 255).nullable();
    table.jsonb('data').notNullable().defaultTo('{}');
    table.string('status', 255).notNullable().defaultTo('draft');
    
    // Indexes
    table.index('collection_id', 'idx_collection_fields_collection_id');
    table.index('type', 'idx_collection_fields_type');
  });
  
  // Add unique constraint on collection_id + field_name (excluding soft-deleted)
  await knex.raw(`
    CREATE UNIQUE INDEX idx_collection_fields_unique 
    ON collection_fields(collection_id, field_name) 
    WHERE deleted_at IS NULL
  `);
  
  console.log('✅ Created collection_fields table');
}

export async function down(knex: Knex): Promise<void> {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('collection_fields');
  
  if (!tableExists) {
    console.log('⚠️  collection_fields table does not exist, skipping drop');
    return;
  }
  
  // Drop collection_fields table
  await knex.schema.dropTable('collection_fields');
  
  console.log('✅ Dropped collection_fields table');
}




