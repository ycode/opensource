import { Knex } from 'knex';

/**
 * Migration: Create locales table
 *
 * Locales store language/region configurations for the application.
 * Supports multiple language variants with draft/published workflow.
 *
 * Uses composite primary key (id, is_published) for draft/published workflow,
 * same pattern as pages and components tables.
 */
export async function up(knex: Knex): Promise<void> {
  // Create locales table
  await knex.schema.createTable('locales', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    table.string('code', 10).notNullable(); // Locale identifier (e.g., 'en', 'es', 'fr')
    table.string('label', 255).notNullable(); // Display label for the locale
    table.boolean('is_default').notNullable().defaultTo(false); // Default locale flag
    table.boolean('is_published').notNullable().defaultTo(false); // Versioning for draft/published workflow
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();

    // Composite primary key (id, is_published)
    table.primary(['id', 'is_published']);

    // Indexes
    table.index('code');
    table.index('is_published');
    table.index('is_default');
    table.index('deleted_at');

    // Unique index to allow draft + published versions with same code
    table.unique(['code', 'is_published']);
  });

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE locales ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  // Single SELECT policy: public can view published OR authenticated can view all
  await knex.schema.raw(`
    CREATE POLICY "Locales are viewable"
      ON locales FOR SELECT
      USING (
        (is_published = true AND deleted_at IS NULL)
        OR (SELECT auth.uid()) IS NOT NULL
      )
  `);

  // Authenticated users can INSERT/UPDATE/DELETE
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can modify locales"
      ON locales FOR INSERT
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can update locales"
      ON locales FOR UPDATE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can delete locales"
      ON locales FOR DELETE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  // Insert default English locale
  await knex('locales').insert({
    code: 'en',
    label: 'English',
    is_default: true,
    is_published: false,
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Locales are viewable" ON locales');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can modify locales" ON locales');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can update locales" ON locales');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can delete locales" ON locales');

  await knex.schema.dropTableIfExists('locales');
}
