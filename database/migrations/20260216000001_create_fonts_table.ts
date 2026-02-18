import type { Knex } from 'knex';

/**
 * Migration: Create Fonts Table
 *
 * Creates the fonts table for managing Google Fonts and custom uploaded fonts.
 * Uses composite primary key (id, is_published) for draft/published workflow.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('fonts', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable(); // Slug-friendly name (e.g., "open-sans")
    table.string('family', 255).notNullable(); // Display name (e.g., "Open Sans")
    table.string('type', 50).notNullable().defaultTo('google'); // 'google' | 'custom' | 'default'
    table.jsonb('variants').notNullable().defaultTo('[]'); // Available variant names
    table.jsonb('weights').notNullable().defaultTo('[]'); // Available numeric weights
    table.string('category', 100).notNullable().defaultTo(''); // Font category (e.g., "sans-serif")
    table.string('kind', 50).nullable(); // Font format for custom fonts (e.g., "woff2")
    table.text('url').nullable(); // Public URL for custom font file
    table.text('storage_path').nullable(); // Storage path for custom font file
    table.string('file_hash', 64).nullable(); // File content hash for custom fonts
    table.string('content_hash', 64).nullable();
    table.boolean('is_published').notNullable().defaultTo(false);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();

    table.primary(['id', 'is_published']);
  });

  // Indexes
  await knex.schema.raw('CREATE INDEX idx_fonts_name ON fonts(name) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX idx_fonts_type ON fonts(type) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX idx_fonts_is_published ON fonts(is_published) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE UNIQUE INDEX idx_fonts_id_unique ON fonts(id) WHERE is_published = false AND deleted_at IS NULL');

  // Enable RLS
  await knex.schema.raw('ALTER TABLE fonts ENABLE ROW LEVEL SECURITY');

  // RLS policies
  await knex.schema.raw(`
    CREATE POLICY "Fonts are viewable"
      ON fonts FOR SELECT
      USING (
        (is_published = true AND deleted_at IS NULL)
        OR (SELECT auth.uid()) IS NOT NULL
      )
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can modify fonts"
      ON fonts FOR INSERT
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can update fonts"
      ON fonts FOR UPDATE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can delete fonts"
      ON fonts FOR DELETE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('fonts');
}
