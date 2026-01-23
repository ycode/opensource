import { Knex } from 'knex';

/**
 * Migration: Add deleted_at to layer_styles table
 *
 * Adds soft delete support for layer styles to enable undo/redo functionality
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('layer_styles', (table) => {
    table.timestamp('deleted_at').nullable();
  });

  // Add index on deleted_at
  await knex.schema.alterTable('layer_styles', (table) => {
    table.index('deleted_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('layer_styles', (table) => {
    table.dropColumn('deleted_at');
  });
}
