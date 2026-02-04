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

    // Component variables - exposed properties for overrides (text, numbers, booleans, etc.)
    table.jsonb('variables').defaultTo('[]');

    // Versioning for draft/published workflow
    table.boolean('is_published').notNullable().defaultTo(false);

    // Content hash for change detection
    table.string('content_hash', 64).nullable();

    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();

    // Composite primary key (id, is_published) - same pattern as pages
    table.primary(['id', 'is_published']);

    // Indexes
    table.index('name');
    table.index('is_published');
    table.index('content_hash');
    table.index('deleted_at');
  });

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE components ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  // Single SELECT policy: public can view published OR authenticated can view all
  await knex.schema.raw(`
    CREATE POLICY "Components are viewable"
      ON components FOR SELECT
      USING (
        (is_published = true AND deleted_at IS NULL)
        OR (SELECT auth.uid()) IS NOT NULL
      )
  `);

  // Authenticated users can INSERT/UPDATE/DELETE
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can modify components"
      ON components FOR INSERT
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can update components"
      ON components FOR UPDATE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can delete components"
      ON components FOR DELETE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Components are viewable" ON components');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can modify components" ON components');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can update components" ON components');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can delete components" ON components');

  await knex.schema.dropTableIfExists('components');
}
