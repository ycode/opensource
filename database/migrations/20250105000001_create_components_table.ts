import { Knex } from 'knex';

/**
 * Migration: Create components table
 *
 * Components are reusable layer trees that can be instanced across pages.
 * When a layer has a componentId, it references this table and renders
 * the component's layers instead of its own children.
 *
 * Uses composite primary key (id, is_published) for draft/published workflow,
 * same pattern as pages table. Includes content_hash for change detection.
 */
export async function up(knex: Knex): Promise<void> {
  // Create components table
  await knex.schema.createTable('components', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();

    // Component data - stores the complete layer tree
    table.jsonb('layers').notNullable();

    // Versioning for draft/published workflow
    table.boolean('is_published').notNullable().defaultTo(false);

    // Content hash for change detection
    table.string('content_hash', 64).nullable();

    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Composite primary key (id, is_published) - same pattern as pages
    table.primary(['id', 'is_published']);

    // Indexes
    table.index('name');
    table.index('is_published');
    table.index('content_hash');

    // Unique index to allow draft + published versions with same name
    table.unique(['name', 'is_published']);
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

  // Drop components table (indexes are dropped automatically)
  await knex.schema.dropTable('components');

  console.log('✅ Dropped components table');
}

