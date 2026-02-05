import { Knex } from 'knex';

/**
 * TEST MIGRATION 3: Adds auto-generated slug to collections
 * Demonstrates transformation on a different template table
 */
export async function up(knex: Knex): Promise<void> {
  // Check if collections table exists
  const tableExists = await knex.schema.hasTable('collections');
  if (!tableExists) {
    console.log('[migration] collections table does not exist, skipping');
    return;
  }

  // Add column (idempotent)
  const hasColumn = await knex.schema.hasColumn('collections', 'test_slug');
  if (!hasColumn) {
    await knex.schema.alterTable('collections', (table) => {
      table.string('test_slug').defaultTo('');
    });
  }

  // Generate slug from name
  await knex.raw(`
    UPDATE collections
    SET test_slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
    WHERE test_slug IS NULL OR test_slug = '';
  `);
}

export async function down(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('collections');
  if (!tableExists) return;

  const hasColumn = await knex.schema.hasColumn('collections', 'test_slug');
  if (hasColumn) {
    await knex.schema.alterTable('collections', (table) => {
      table.dropColumn('test_slug');
    });
  }
}
