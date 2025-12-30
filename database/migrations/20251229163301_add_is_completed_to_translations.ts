import type { Knex } from 'knex';

/**
 * Migration: Add is_completed column to translations table
 *
 * Adds a boolean column to track whether a translation is marked as completed.
 * This helps translators track their progress and mark translations as reviewed/finalized.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('translations', (table) => {
    // Add is_completed column after content_value
    table.boolean('is_completed').notNullable().defaultTo(false).after('content_value');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('translations', (table) => {
    table.dropColumn('is_completed');
  });
}
