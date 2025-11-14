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
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('page_id').notNullable().references('id').inTable('pages').onDelete('CASCADE');
    table.jsonb('layers').notNullable().defaultTo('[]');
    table.boolean('is_published').defaultTo(false);
    table.string('publish_key', 255).defaultTo(knex.raw('gen_random_uuid()'));
    table.string('content_hash', 64).nullable(); // SHA-256 hash for change detection
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
  });

  // Create indexes (partial indexes for soft delete support)
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_layers_page_id ON page_layers(page_id) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_layers_published ON page_layers(page_id, is_published) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_layers_publish_key ON page_layers(publish_key) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_layers_content_hash ON page_layers(content_hash)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_layers_layers ON page_layers USING GIN (layers) WHERE deleted_at IS NULL');

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE page_layers ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  await knex.schema.raw(`
    CREATE POLICY "Public can view published layers"
      ON page_layers FOR SELECT
      USING (
        is_published = TRUE
        AND deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM pages
          WHERE pages.id = page_layers.page_id
          AND pages.is_published = true
          AND pages.deleted_at IS NULL
        )
      )
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can manage layers"
      ON page_layers FOR ALL
      USING (auth.uid() IS NOT NULL)
  `);

  // Create default homepage with initial draft layers
  const homepageLayers = [{
    id: 'body',
    type: 'container',
    classes: '',
    children: [],
    locked: true,
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

    // Generate a shared publish_key for draft and published versions
    const sharedPublishKey = knex.raw('gen_random_uuid()');

    // Create draft version
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
        publish_key: sharedPublishKey,
      })
      .returning('*');

    // Create published version with same content_hash
    const [publishedPage] = await knex('pages')
      .insert({
        name: errorPage.name,
        error_page: errorPage.code,
        slug: '',
        depth: 0,
        order: 0,
        is_published: true,
        settings: JSON.stringify(errorPage.settings),
        content_hash: errorPageHash,
        publish_key: draftPage.publish_key, // Use same publish_key as draft
      })
      .returning('*');

    // Create draft layers with shared publish_key
    const layersPublishKey = knex.raw('gen_random_uuid()');
    await knex('page_layers').insert({
      page_id: draftPage.id,
      layers: errorPage.layers,
      is_published: false,
      content_hash: errorPageLayersHash,
      publish_key: layersPublishKey,
    });

    // Create published layers with same content_hash and publish_key
    const [draftLayers] = await knex('page_layers')
      .select('publish_key')
      .where('page_id', draftPage.id)
      .limit(1);

    await knex('page_layers').insert({
      page_id: publishedPage.id,
      layers: errorPage.layers,
      is_published: true,
      content_hash: errorPageLayersHash,
      publish_key: draftLayers.publish_key, // Use same publish_key as draft
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies
  await knex.schema.raw('DROP POLICY IF EXISTS "Public can view published layers" ON page_layers');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can manage layers" ON page_layers');

  // Drop table
  await knex.schema.dropTableIfExists('page_layers');
}

