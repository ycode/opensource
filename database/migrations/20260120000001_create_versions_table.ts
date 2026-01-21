import type { Knex } from 'knex';

/**
 * Migration: Create versions table for undo/redo functionality
 *
 * Stores version history for pages, components, and layer styles
 * Uses JSON patches (RFC 6902) for optimized storage - only stores diffs
 */

export async function up(knex: Knex): Promise<void> {
  // Create versions table
  await knex.schema.createTable('versions', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()')).primary();

    // Entity reference
    table.string('entity_type', 50).notNullable(); // 'page_layers' | 'component' | 'layer_style'
    table.uuid('entity_id').notNullable();

    // Version metadata
    table.string('action_type', 50).notNullable(); // 'create' | 'update' | 'delete'
    table.text('description').nullable(); // Human-readable description of the change

    // Inverse patch (undo) - reverts the change (only for 'update' actions)
    table.jsonb('undo').nullable();

    // Forward patch (redo) - applies the change
    table.jsonb('redo').notNullable();

    // Full snapshot (stored periodically for optimization, e.g., every 10th version)
    // Allows faster restoration without applying all patches
    table.jsonb('snapshot').nullable();

    // Additional context metadata (selected layers, viewport state, etc.)
    // Stores UI state to restore context after undo/redo operations
    table.jsonb('metadata').nullable();

    // Integrity hashes
    table.string('previous_hash', 64).nullable(); // Hash before this change
    table.string('current_hash', 64).notNullable(); // Hash after this change

    // Session tracking for grouping related operations
    table.string('session_id', 100).nullable();

    // Timestamps
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Create indexes for efficient queries
  await knex.schema.raw(`
    CREATE INDEX idx_versions_entity
    ON versions(entity_type, entity_id)
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_versions_entity_created
    ON versions(entity_type, entity_id, created_at DESC)
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_versions_session
    ON versions(session_id)
    WHERE session_id IS NOT NULL
  `);

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE versions ENABLE ROW LEVEL SECURITY');

  // RLS policies
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can view versions"
      ON versions FOR SELECT
      USING (auth.uid() IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can create versions"
      ON versions FOR INSERT
      WITH CHECK (auth.uid() IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can update versions"
      ON versions FOR UPDATE
      USING (auth.uid() IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can view versions" ON versions');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can create versions" ON versions');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can update versions" ON versions');

  // Drop table
  await knex.schema.dropTableIfExists('versions');
}
