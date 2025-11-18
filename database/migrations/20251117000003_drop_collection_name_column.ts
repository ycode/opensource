import { Knex } from 'knex';

/**
 * Migration: Drop collection_name column from collections table
 * 
 * With composite primary keys (id, is_published), collection_name is no longer needed.
 * The ID itself serves as the unique identifier across draft and published versions.
 */
export async function up(knex: Knex): Promise<void> {
  console.log('🗑️  Dropping collection_name column from collections table...');
  
  // Drop the column
  await knex.schema.alterTable('collections', (table) => {
    table.dropColumn('collection_name');
  });
  
  console.log('✅ Dropped collection_name column');
}

export async function down(knex: Knex): Promise<void> {
  console.log('🔧 Re-adding collection_name column to collections table...');
  
  // Re-add the column (for rollback)
  await knex.schema.alterTable('collections', (table) => {
    table.string('collection_name', 255).nullable();
  });
  
  console.log('✅ Re-added collection_name column');
}


