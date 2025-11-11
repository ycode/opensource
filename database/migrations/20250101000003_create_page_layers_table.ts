import type { Knex } from 'knex';

/**
 * Migration: Create page layers table
 *
 * Creates the page_layers table with foreign keys and RLS
 */

export async function up(knex: Knex): Promise<void> {
  // Create page_layers table
  await knex.schema.createTable('page_layers', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('page_id').notNullable().references('id').inTable('pages').onDelete('CASCADE');
    table.jsonb('layers').notNullable().defaultTo('[]');
    table.boolean('is_published').defaultTo(false);
    table.string('publish_key', 255).defaultTo(knex.raw('gen_random_uuid()'));
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('deleted_at', { useTz: true }).nullable();
  });

  // Create indexes (partial indexes for soft delete support)
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_layers_page_id ON page_layers(page_id) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_layers_published ON page_layers(page_id, is_published) WHERE deleted_at IS NULL');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_page_layers_publish_key ON page_layers(publish_key) WHERE deleted_at IS NULL');
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
  // Check if homepage already exists (is_index=true, page_folder_id=null)
  const existingHome = await knex('pages')
    .where('is_index', true)
    .whereNull('page_folder_id')
    .whereNull('deleted_at')
    .first();

  if (!existingHome) {
    // Insert homepage
    const [homepage] = await knex('pages')
      .insert({
        name: 'Homepage',
        slug: '',
        depth: 0,
        is_index: true,
        is_published: false,
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

    await knex('page_layers').insert({
      page_id: homepage.id,
      layers: JSON.stringify([bodyLayer]),
      is_published: false,
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

