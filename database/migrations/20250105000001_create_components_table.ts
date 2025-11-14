import { Knex } from 'knex';

/**
 * Migration: Create components table
 * 
 * Components are reusable layer trees that can be instanced across pages.
 * When a layer has a componentId, it references this table and renders
 * the component's layers instead of its own children.
 * 
 * Includes versioning (is_published, publish_key) and content_hash for
 * draft/published workflow and change detection.
 */
export async function up(knex: Knex): Promise<void> {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('components');
  
  if (tableExists) {
    console.log('⚠️  components table already exists, skipping creation');
    return;
  }
  
  // Create components table
  await knex.schema.createTable('components', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    table.string('name', 255).notNullable();
    
    // Component data - stores the complete layer tree
    table.jsonb('layers').notNullable();
    
    // Versioning for draft/published workflow
    table.boolean('is_published').notNullable().defaultTo(false);
    table.string('publish_key', 255).notNullable().defaultTo(knex.raw('uuid_generate_v4()'));
    
    // Content hash for change detection
    table.string('content_hash', 64).nullable();
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('name');
    table.index('publish_key', 'idx_components_publish_key');
    table.index('is_published', 'idx_components_is_published');
    table.index('content_hash', 'idx_components_content_hash');
  });
  
  // Create unique index to allow draft + published versions with same name
  await knex.schema.raw(`
    CREATE UNIQUE INDEX idx_components_name_is_published_unique
    ON components(name, is_published)
  `);
  
  console.log('✅ Created components table');
}

export async function down(knex: Knex): Promise<void> {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('components');
  
  if (!tableExists) {
    console.log('⚠️  components table does not exist, skipping drop');
    return;
  }
  
  // Drop unique index
  await knex.schema.raw('DROP INDEX IF EXISTS idx_components_name_is_published_unique');
  
  // Drop components table
  await knex.schema.dropTable('components');
  
  console.log('✅ Dropped components table');
}

