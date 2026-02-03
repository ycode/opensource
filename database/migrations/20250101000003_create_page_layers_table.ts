import type { Knex } from 'knex';
import { DEFAULT_ERROR_PAGES } from '@/lib/page-utils';
import { generatePageMetadataHash, generatePageLayersHash } from '@/lib/hash-utils';

/**
 * Migration: Create page layers table
 *
 * Creates the page_layers table with foreign keys and RLS
 * Also creates default homepage and error pages with content_hash set
 */

export async function up(knex: Knex): Promise<void> {
  // Create page_layers table
  await knex.schema.createTable('page_layers', (table) => {
    table.uuid('id').defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('page_id').notNullable();
    table.jsonb('layers').notNullable().defaultTo('[]');
    table.boolean('is_published').notNullable().defaultTo(false);
    table.string('content_hash', 64).nullable(); // SHA-256 hash for change detection
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();

    // Composite primary key
    table.primary(['id', 'is_published']);
  });

  // Add foreign key constraint separately (after table creation)
  await knex.schema.raw(`
    ALTER TABLE page_layers
    ADD CONSTRAINT fk_page_layers_page
    FOREIGN KEY (page_id, is_published)
    REFERENCES pages(id, is_published)
    ON DELETE CASCADE
  `);

  // Create indexes (partial indexes for soft delete support)
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_layers_page_id ON page_layers(page_id, is_published) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_layers_content_hash ON page_layers(content_hash)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_layers_layers ON page_layers USING GIN (layers) WHERE deleted_at IS NULL');

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE page_layers ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  // Single SELECT policy: public can view published layers with published pages OR authenticated can view all
  await knex.schema.raw(`
    CREATE POLICY "Page layers are viewable"
      ON page_layers FOR SELECT
      USING (
        (
          is_published = TRUE
          AND deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM pages
            WHERE pages.id = page_layers.page_id
            AND pages.is_published = true
            AND pages.deleted_at IS NULL
          )
        )
        OR (SELECT auth.uid()) IS NOT NULL
      )
  `);

  // Authenticated users can INSERT/UPDATE/DELETE
  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can modify page layers"
      ON page_layers FOR INSERT
      WITH CHECK ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can update page layers"
      ON page_layers FOR UPDATE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can delete page layers"
      ON page_layers FOR DELETE
      USING ((SELECT auth.uid()) IS NOT NULL)
  `);

  // Create default homepage with initial draft layers
  const homepageLayers = [{
    id: 'body',
    name: 'body',
    classes: '',
    children: [],
  }];

  // Calculate content_hash for homepage
  const homepageHash = generatePageMetadataHash({
    name: 'Homepage',
    slug: '',
    settings: {},
    is_index: true,
    is_dynamic: false,
    error_page: null,
  });

  const [homepage] = await knex('pages')
    .insert({
      name: 'Homepage',
      slug: '',
      depth: 0,
      is_index: true,
      is_published: false,
      content_hash: homepageHash,
    })
    .returning('*');

  // Calculate content_hash for homepage layers
  const homepageLayersHash = generatePageLayersHash({
    layers: homepageLayers,
    generated_css: null,
  });

  // Create initial draft with Body container
  await knex('page_layers').insert({
    page_id: homepage.id,
    layers: JSON.stringify(homepageLayers),
    is_published: false,
    content_hash: homepageLayersHash,
  });

  // Insert error page records in database (both draft and published versions)
  for (const errorPage of DEFAULT_ERROR_PAGES) {
    // Calculate content_hash for error page
    const errorPageHash = generatePageMetadataHash({
      name: errorPage.name,
      slug: '',
      settings: errorPage.settings,
      is_index: false,
      is_dynamic: false,
      error_page: errorPage.code,
    });

    // Calculate content_hash for error page layers
    const errorPageLayersHash = generatePageLayersHash({
      layers: errorPage.layers,
      generated_css: null,
    });

    // Create draft version with gen_random_uuid() and capture the generated ID
    const [draftPage] = await knex('pages')
      .insert({
        name: errorPage.name,
        error_page: errorPage.code,
        slug: '',
        depth: 0,
        order: 0,
        is_published: false,
        settings: JSON.stringify(errorPage.settings),
        content_hash: errorPageHash,
      })
      .returning('id');

    // Create published version with same ID as draft
    await knex('pages').insert({
      id: draftPage.id,
      name: errorPage.name,
      error_page: errorPage.code,
      slug: '',
      depth: 0,
      order: 0,
      is_published: true,
      settings: JSON.stringify(errorPage.settings),
      content_hash: errorPageHash,
    });

    // Create draft layers with gen_random_uuid() and capture the generated ID
    const [draftLayers] = await knex('page_layers')
      .insert({
        page_id: draftPage.id,
        layers: errorPage.layers,
        is_published: false,
        content_hash: errorPageLayersHash,
      })
      .returning('id');

    // Create published layers with same ID as draft
    await knex('page_layers').insert({
      id: draftLayers.id,
      page_id: draftPage.id,
      layers: errorPage.layers,
      is_published: true,
      content_hash: errorPageLayersHash,
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Page layers are viewable" ON page_layers');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can modify page layers" ON page_layers');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can update page layers" ON page_layers');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can delete page layers" ON page_layers');

  // Drop table
  await knex.schema.dropTableIfExists('page_layers');
}
