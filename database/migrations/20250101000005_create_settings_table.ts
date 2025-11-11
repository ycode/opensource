import type { Knex } from 'knex';

/**
 * Migration: Create Settings Table
 *
 * Creates the settings table with default values
 */

export async function up(knex: Knex): Promise<void> {
  // Create settings table
  await knex.schema.createTable('settings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('key', 255).notNullable().unique();
    table.jsonb('value').notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Create index
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key)');

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE settings ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  // Public can read all settings (including published_css for public pages)
  await knex.schema.raw(`
    CREATE POLICY "Public settings are viewable by everyone"
      ON settings FOR SELECT
      USING (true)
  `);

  // Only authenticated users can create/update/delete settings
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can manage settings"
      ON settings FOR ALL
      USING (auth.uid() IS NOT NULL)
  `);

  // Insert default settings
  await knex('settings').insert([
    { key: 'site_name', value: JSON.stringify('YCode Site') },
    { key: 'site_description', value: JSON.stringify('Built with YCode') },
    { key: 'ycode_version', value: JSON.stringify('0.1.0') },
  ]).onConflict('key').ignore();
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Public settings are viewable by everyone" ON settings');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can manage settings" ON settings');

  // Drop table
  await knex.schema.dropTableIfExists('settings');
}

