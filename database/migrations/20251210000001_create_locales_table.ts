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

  // Insert default English locale
  await knex('locales').insert({
    code: 'en',
    label: 'English',
    is_default: true,
    is_published: false,
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('locales');
}
