import type { Knex } from 'knex';

/**
 * Migration: Create API Keys Table
 *
 * Creates the api_keys table for managing multiple API keys
 * for the public v1 API.
 */

export async function up(knex: Knex): Promise<void> {
  // Create api_keys table
  await knex.schema.createTable('api_keys', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.string('key_hash', 64).notNullable(); // SHA-256 hash (64 hex chars)
    table.string('key_prefix', 8).notNullable(); // First 8 chars for identification
    table.timestamp('last_used_at', { useTz: true }).nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Create index on key_hash for fast lookups during validation
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash)');

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  // Only authenticated users can read API keys
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can view api_keys"
      ON api_keys FOR SELECT
      USING (auth.uid() IS NOT NULL)
  `);

  // Only authenticated users can manage API keys
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can manage api_keys"
      ON api_keys FOR ALL
      USING (auth.uid() IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can view api_keys" ON api_keys');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can manage api_keys" ON api_keys');

  // Drop table
  await knex.schema.dropTableIfExists('api_keys');
}
