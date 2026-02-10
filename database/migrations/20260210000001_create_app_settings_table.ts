import type { Knex } from 'knex';

/**
 * Migration: Create App Settings Table
 *
 * Creates a generic key-value settings table for app integrations.
 * Each app stores its configuration (API keys, connections, etc.) here.
 */

export async function up(knex: Knex): Promise<void> {
  // Drop existing table if it exists (to handle schema changes during development)
  const hasTable = await knex.schema.hasTable('app_settings');
  if (hasTable) {
    await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can manage app_settings" ON app_settings');
    await knex.schema.dropTable('app_settings');
  }

  // Create app_settings table
  await knex.schema.createTable('app_settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('app_id', 100).notNullable(); // e.g. "mailerlite"
    table.string('key', 255).notNullable(); // e.g. "api_key", "connections"
    table.jsonb('value').notNullable(); // Flexible JSON storage
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());

    // Unique constraint: one key per app
    table.unique(['app_id', 'key']);
  });

  // Create index for faster app settings lookups
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_app_settings_app_id ON app_settings(app_id)');

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY');

  // Create RLS policy
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can manage app_settings"
      ON app_settings FOR ALL
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can manage app_settings" ON app_settings');
  await knex.schema.dropTableIfExists('app_settings');
}
