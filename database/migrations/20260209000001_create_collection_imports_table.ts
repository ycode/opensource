import { Knex } from 'knex';

/**
 * Migration: Create collection_imports table
 *
 * Tracks CSV import jobs for collections, enabling background processing
 * that can continue even if the browser is closed.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('collection_imports', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('collection_id').notNullable();
    table.string('status', 50).notNullable().defaultTo('pending'); // pending, processing, completed, failed
    table.integer('total_rows').notNullable().defaultTo(0);
    table.integer('processed_rows').notNullable().defaultTo(0);
    table.integer('failed_rows').notNullable().defaultTo(0);
    table.jsonb('column_mapping').notNullable(); // { csvColumn: fieldId }
    table.jsonb('csv_data').notNullable(); // Parsed CSV rows
    table.jsonb('errors').nullable(); // Array of error messages
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    // Indexes
    table.index('collection_id');
    table.index('status');
  });

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE collection_imports ENABLE ROW LEVEL SECURITY');

  // Create RLS policies - only authenticated users can access
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can view collection imports"
      ON collection_imports FOR SELECT
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can create collection imports"
      ON collection_imports FOR INSERT
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can update collection imports"
      ON collection_imports FOR UPDATE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can delete collection imports"
      ON collection_imports FOR DELETE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can view collection imports" ON collection_imports');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can create collection imports" ON collection_imports');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can update collection imports" ON collection_imports');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can delete collection imports" ON collection_imports');

  await knex.schema.dropTableIfExists('collection_imports');
}
