import type { Knex } from 'knex';

/**
 * Migration: Create translations table
 *
 * Stores translations for translatable content across pages, folders, components, and CMS.
 * Each translation is tied to a locale and identifies content by source_type, source_id, and content_key.
 * Uses draft/published workflow pattern consistent with other tables.
 */
export async function up(knex: Knex): Promise<void> {
  // Create translations table
  await knex.schema.createTable('translations', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('locale_id').notNullable();
    table.string('source_type', 50).notNullable(); // 'page' | 'folder' | 'component' | 'cms'
    table.string('source_id', 50).notNullable(); // ID of the source entity
    table.string('content_key', 255).notNullable(); // Content key (e.g., 'layer:{layerId}:text', 'seo:title', 'slug')
    table.string('content_type', 50).notNullable(); // 'text' | 'richtext' | 'asset_id'
    table.text('content_value').notNullable(); // Translated content value
    table.boolean('is_completed').notNullable().defaultTo(false); // Track translation completion status
    table.boolean('is_published').notNullable().defaultTo(false); // Versioning for draft/published workflow
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Composite primary key (id, is_published)
    table.primary(['id', 'is_published']);

    // Ensure only one translation per locale (published or draft) for each content item
    table.unique(['locale_id', 'source_type', 'source_id', 'content_key', 'is_published']);

    // Indexes
    table.index('locale_id');
    table.index(['source_type', 'source_id']);
    table.index('content_key');
    table.index('is_published');
    table.index('deleted_at');
  });

  // Add foreign key constraint to locales table
  await knex.schema.raw(`
    ALTER TABLE translations
    ADD CONSTRAINT fk_translations_locale
    FOREIGN KEY (locale_id, is_published)
    REFERENCES locales(id, is_published)
    ON DELETE CASCADE
  `);

  // Create composite index for common queries
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_translations_locale_source
    ON translations(locale_id, source_type, source_id, is_published)
    WHERE deleted_at IS NULL
  `);

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE translations ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  // Single SELECT policy: public can view published OR authenticated can view all
  await knex.schema.raw(`
    CREATE POLICY "Translations are viewable"
      ON translations FOR SELECT
      USING (
        (is_published = true AND deleted_at IS NULL)
        OR (SELECT auth.uid()) IS NOT NULL
      )
  `);

  // Authenticated users can INSERT/UPDATE/DELETE
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can modify translations"
      ON translations FOR INSERT
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can update translations"
      ON translations FOR UPDATE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can delete translations"
      ON translations FOR DELETE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Translations are viewable" ON translations');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can modify translations" ON translations');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can update translations" ON translations');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can delete translations" ON translations');

  await knex.schema.dropTableIfExists('translations');
}
