import { Knex } from 'knex';

/**
 * Migration: Create components table
 * 
 * Components are reusable layer trees that can be instanced across pages.
 * When a layer has a componentId, it references this table and renders
 * the component's layers instead of its own children.
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
    
    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Indexes
    table.index('name');
  });
  
  console.log('✅ Created components table');
}

export async function down(knex: Knex): Promise<void> {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('components');
  
  if (!tableExists) {
    console.log('⚠️  components table does not exist, skipping drop');
    return;
  }
  
  // Drop components table
  await knex.schema.dropTable('components');
  
  console.log('✅ Dropped components table');
}

