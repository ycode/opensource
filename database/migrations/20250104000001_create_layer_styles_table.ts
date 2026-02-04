import { Knex } from 'knex';

/**
 * Migration: Create layer_styles table
 *
 * Layer styles are reusable design configurations that can be applied to multiple layers.
 * They are part of the page draft and get published when the page is published.
 *
 * Uses composite primary key (id, is_published) for draft/published workflow,
 * same pattern as pages and components tables. Includes content_hash for change detection
 * and deleted_at for soft delete/undo support.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('layer_styles', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();

    // Style data
    table.text('classes').notNullable();
    table.jsonb('design');

    // Versioning for draft/published workflow
    table.boolean('is_published').notNullable().defaultTo(false);

    // Content hash for change detection
    table.string('content_hash', 64).nullable();

    // Timestamps
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable(); // Soft delete for undo/redo

    // Composite primary key (id, is_published) - same pattern as pages and components
    table.primary(['id', 'is_published']);

    // Indexes
    table.index('name');
    table.index('is_published');
    table.index('content_hash');
    table.index('deleted_at');

    // Unique index to allow draft + published versions with same name
    table.unique(['name', 'is_published']);
  });

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE layer_styles ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  // Single SELECT policy: public can view published OR authenticated can view all
  await knex.schema.raw(`
    CREATE POLICY "Layer styles are viewable"
      ON layer_styles FOR SELECT
      USING (
        (is_published = true AND deleted_at IS NULL)
        OR (SELECT auth.uid()) IS NOT NULL
      )
  `);

  // Authenticated users can INSERT/UPDATE/DELETE
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can modify layer styles"
      ON layer_styles FOR INSERT
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can update layer styles"
      ON layer_styles FOR UPDATE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can delete layer styles"
      ON layer_styles FOR DELETE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Layer styles are viewable" ON layer_styles');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can modify layer styles" ON layer_styles');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can update layer styles" ON layer_styles');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can delete layer styles" ON layer_styles');

  // Drop table (indexes are dropped automatically)
  await knex.schema.dropTableIfExists('layer_styles');
}
