import { Knex } from 'knex';

/**
 * TEST MIGRATION 1: Adds a marker column to pages
 * This demonstrates that migrations run on template data
 */
export async function up(knex: Knex): Promise<void> {
  // Add column (idempotent)
  const hasColumn = await knex.schema.hasColumn('pages', 'test_applied');
  if (!hasColumn) {
    await knex.schema.alterTable('pages', (table) => {
      table.string('test_applied').defaultTo('');
    });
  }

  // Mark all pages that go through this migration
  await knex.raw(`
    UPDATE pages
    SET test_applied = 'migration-1-applied-' || to_char(now(), 'YYYY-MM-DD-HH24:MI:SS')
    WHERE test_applied IS NULL OR test_applied = '';
  `);
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('pages', 'test_applied');
  if (hasColumn) {
    await knex.schema.alterTable('pages', (table) => {
      table.dropColumn('test_applied');
    });
  }
}
