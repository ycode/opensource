import type { Knex } from 'knex';

/**
 * Migration: Create Page Versions Table
 *
 * Creates the page_versions table with foreign keys and RLS
 */

export async function up(knex: Knex): Promise<void> {
  // Create page_versions table
  await knex.schema.createTable('page_versions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('page_id').notNullable().references('id').inTable('pages').onDelete('CASCADE');
    table.jsonb('layers').notNullable().defaultTo('[]');
    table.boolean('is_published').defaultTo(false);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Create indexes
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_versions_page_id ON page_versions(page_id)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_versions_published ON page_versions(page_id, is_published)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_versions_layers ON page_versions USING GIN (layers)');

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE page_versions ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  await knex.schema.raw(`
    CREATE POLICY "Public can view published versions"
      ON page_versions FOR SELECT
      USING (
        is_published = TRUE
        AND EXISTS (
          SELECT 1 FROM pages
          WHERE pages.id = page_versions.page_id
          AND pages.status = 'published'
        )
      )
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can manage versions"
      ON page_versions FOR ALL
      USING (auth.role() = 'authenticated')
  `);

  // Add foreign key constraint for published_version_id in pages table
  await knex.schema.raw(`
    ALTER TABLE pages
      ADD CONSTRAINT fk_pages_published_version
      FOREIGN KEY (published_version_id)
      REFERENCES page_versions(id)
      ON DELETE SET NULL
  `);

  // Create default homepage with initial draft version
  const existingHome = await knex('pages').where('slug', 'home').first();

  if (!existingHome) {
    // Insert homepage
    const [homepage] = await knex('pages')
      .insert({
        title: 'Home',
        slug: 'home',
        status: 'draft',
        published_version_id: null,
      })
      .returning('*');

    // Create initial draft with Body container
    const bodyLayer = {
      id: 'body',
      type: 'container',
      classes: '',
      children: [],
      locked: true,
    };

    await knex('page_versions').insert({
      page_id: homepage.id,
      layers: JSON.stringify([bodyLayer]),
      is_published: false,
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Remove foreign key from pages table first
  await knex.schema.raw('ALTER TABLE pages DROP CONSTRAINT IF EXISTS fk_pages_published_version');

  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Public can view published versions" ON page_versions');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can manage versions" ON page_versions');

  // Drop table
  await knex.schema.dropTableIfExists('page_versions');
}

