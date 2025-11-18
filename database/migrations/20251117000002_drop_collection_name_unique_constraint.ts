import { Knex } from 'knex';

/**
 * Migration: Drop unique constraint on collection_name
 * 
 * With composite primary keys (id, is_published), we need to allow
 * the same collection_name for both draft and published versions.
 * 
 * The unique constraint causes issues when publishing collections.
 */
export async function up(knex: Knex): Promise<void> {
  console.log('🔧 Dropping unique constraint on collections.collection_name...');
  
  // Drop the unique constraint
  await knex.raw(`
    ALTER TABLE collections 
    DROP CONSTRAINT IF EXISTS collections_collection_name_unique
  `);
  
  console.log('✅ Dropped unique constraint on collections.collection_name');
}

export async function down(knex: Knex): Promise<void> {
  console.log('🔧 Re-adding unique constraint on collections.collection_name...');
  
  // Re-add the unique constraint (for rollback)
  await knex.raw(`
    ALTER TABLE collections 
    ADD CONSTRAINT collections_collection_name_unique UNIQUE (collection_name)
  `);
  
  console.log('✅ Re-added unique constraint on collections.collection_name');
}

