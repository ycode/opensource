import { Knex } from 'knex';

/**
 * TEST MIGRATION 2: Adds word count to pages
 * Demonstrates data transformation based on existing content
 */
export async function up(knex: Knex): Promise<void> {
  // Add column (idempotent)
  const hasColumn = await knex.schema.hasColumn('pages', 'word_count');
  if (!hasColumn) {
    await knex.schema.alterTable('pages', (table) => {
      table.integer('word_count').defaultTo(0);
    });
  }

  // Calculate word count from page name
  await knex.raw(`
    UPDATE pages
    SET word_count = array_length(regexp_split_to_array(name, '\\s+'), 1)
    WHERE word_count IS NULL OR word_count = 0;
  `);
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('pages', 'word_count');
  if (hasColumn) {
    await knex.schema.alterTable('pages', (table) => {
      table.dropColumn('word_count');
    });
  }
}
