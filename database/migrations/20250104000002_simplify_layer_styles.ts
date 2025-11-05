import { Knex } from 'knex';

/**
 * Migration: Simplify layer_styles table
 * 
 * Remove draft/published split - layer styles now have single version
 * that gets saved to the database and is immediately available
 */
export async function up(knex: Knex): Promise<void> {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('layer_styles');
  
  if (!tableExists) {
    // Table doesn't exist, create it with new schema
    await knex.schema.createTable('layer_styles', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
      table.string('name', 255).notNullable();
      
      // Style data (single version)
      table.text('classes').notNullable();
      table.jsonb('design');
      
      // Timestamps
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // Indexes
      table.index('name');
    });
    
    return;
  }
  
  // Table exists, check if it has the old schema
  const hasOldSchema = await knex.schema.hasColumn('layer_styles', 'draft_classes');
  
  if (hasOldSchema) {
    
    // Drop old columns if they exist
    await knex.schema.alterTable('layer_styles', (table) => {
      table.dropColumn('draft_classes');
      table.dropColumn('draft_design');
      table.dropColumn('published_classes');
      table.dropColumn('published_design');
      table.dropColumn('is_published');
      table.dropColumn('published_at');
    });
    
    // Add new columns
    await knex.schema.alterTable('layer_styles', (table) => {
      table.text('classes').notNullable().defaultTo('');
      table.jsonb('design');
    });
    
  } else {
    // Check if new columns exist
    const hasNewSchema = await knex.schema.hasColumn('layer_styles', 'classes');
    
    if (!hasNewSchema) {
      // Add new columns
      await knex.schema.alterTable('layer_styles', (table) => {
        table.text('classes').notNullable().defaultTo('');
        table.jsonb('design');
      });
      
    } else {
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Check if table exists
  const tableExists = await knex.schema.hasTable('layer_styles');
  
  if (!tableExists) {
    return;
  }
  
  // Remove new columns and restore old schema
  await knex.schema.alterTable('layer_styles', (table) => {
    table.dropColumn('classes');
    table.dropColumn('design');
    
    table.text('draft_classes').notNullable();
    table.jsonb('draft_design');
    table.text('published_classes');
    table.jsonb('published_design');
    table.boolean('is_published').defaultTo(false);
    table.timestamp('published_at');
  });
  
}



