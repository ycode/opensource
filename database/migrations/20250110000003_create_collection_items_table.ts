import { Knex } from 'knex';

/**
 * Migration: Create collection_items table
 * 
 * Individual collection entries (EAV "Entities").
 * Each row represents one item (e.g., a blog post, a category).
 */
export async function up(knex: Knex): Promise<void> {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('collection_items');
  
  if (tableExists) {
    console.log('⚠️  collection_items table already exists, skipping creation');
    return;
  }
  
  // Create collection_items table
  await knex.schema.createTable('collection_items', (table) => {
    table.bigIncrements('id').primary();
    table.string('r_id', 255).notNullable();
    table.string('status', 255).notNullable().defaultTo('draft');
    table.bigInteger('collection_id').notNullable()
      .references('id').inTable('collections').onDelete('CASCADE');
    table.timestamp('created_at', { precision: 0 }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { precision: 0 }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { precision: 0 }).nullable();
    table.bigInteger('backup_id').nullable();
    table.string('temp_id', 255).nullable();
    table.boolean('is_promotable').notNullable().defaultTo(true);
    table.bigInteger('manual_order').notNullable().defaultTo(0);
    
    // Indexes
    table.index('collection_id', 'idx_collection_items_collection_id');
    table.index('r_id', 'idx_collection_items_r_id');
    table.index('status', 'idx_collection_items_status');
  });
  
  // Add unique constraint on collection_id + r_id (excluding soft-deleted)
  await knex.raw(`
    CREATE UNIQUE INDEX idx_collection_items_unique_rid 
    ON collection_items(collection_id, r_id) 
    WHERE deleted_at IS NULL
  `);
  
  console.log('✅ Created collection_items table');
}

export async function down(knex: Knex): Promise<void> {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('collection_items');
  
  if (!tableExists) {
    console.log('⚠️  collection_items table does not exist, skipping drop');
    return;
  }
  
  // Drop collection_items table
  await knex.schema.dropTable('collection_items');
  
  console.log('✅ Dropped collection_items table');
}




