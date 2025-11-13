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
  await knex('page_layers').insert({
    page_id: homepage.id,
    layers: JSON.stringify([{
      id: 'body',
      type: 'container',
      classes: '',
      children: [],
      locked: true,
    }]),
    is_published: false,
  });

  // Define error page records
  const errorPages = [
    {
      code: 401,
      name: '401 - Password required',
      layers: JSON.stringify([
        {
          id: 'body',
          type: 'container',
          locked: true,
          classes: '',
          children: [
            {
              id: 'layer-1762789137823-g2cdo46ld',
              name: 'section',
              design: {
                layout: { display: 'Flex', isActive: true, flexDirection: 'column' },
                sizing: { height: '100vh', isActive: true },
                spacing: { isActive: true, paddingTop: '3rem', paddingBottom: '3rem' },
              },
              classes: 'flex flex-col gap-[1rem] py-[3rem] h-[100vh]',
              children: [
                {
                  id: 'layer-1762789141753-zpz5jyobc',
                  name: 'div',
                  design: {
                    sizing: { height: '100vh', isActive: true, maxWidth: '80rem' },
                    spacing: { isActive: true, marginLeft: 'auto', marginRight: 'auto', paddingLeft: '1rem', paddingRight: '1rem' },
                  },
                  classes: 'max-w-[80rem] mx-auto px-[1rem] h-[100vh]',
                  children: [
                    {
                      id: 'layer-1762789168560-icft8ynp5',
                      name: 'div',
                      design: {
                        layout: { gap: '6', display: 'flex', isActive: true, alignItems: 'center', flexDirection: 'column', justifyContent: 'center' },
                        sizing: { height: '100%', isActive: true },
                        typography: { isActive: true, textAlign: 'center' },
                      },
                      classes: 'items-center text-center h-full flex flex-col justify-center gap-[6px]',
                      children: [
                        {
                          id: 'layer-1762789150944-5qezgblbe',
                          name: 'h2',
                          text: '401',
                          design: {
                            typography: { color: '#111827', fontSize: '30', isActive: true, fontWeight: '700' },
                          },
                          classes: 'font-[700] text-[#111827] text-[30px]',
                          content: '401',
                          children: [],
                          customName: 'Heading',
                        },
                        {
                          id: 'layer-1762789197005-7z2wy597y',
                          name: 'span',
                          text: 'Password protected',
                          design: {
                            typography: { fontSize: '12', color: '#111827', isActive: true },
                          },
                          classes: 'text-[12px] text-[#111827]',
                          content: 'Password protected',
                          children: [],
                          customName: 'Text',
                          formattable: true,
                        },
                        {
                          id: 'layer-1762789197006-7z2wy597z',
                          name: 'span',
                          text: 'To access this page, please enter the required password below.',
                          design: {
                            typography: { fontSize: '12', color: '#111827', isActive: true },
                          },
                          classes: 'text-[12px] text-[#111827]',
                          content: 'To access this page, please enter the required password below.',
                          children: [],
                          customName: 'Text',
                          formattable: true,
                        },
                      ],
                      customName: 'Block',
                    },
                  ],
                  customName: 'Container',
                },
              ],
              customName: 'Section',
            },
          ],
        },
      ]),
    },
    {
      code: 404,
      name: '404 - Page not found',
      layers: JSON.stringify([
        {
          id: 'body',
          type: 'container',
          locked: true,
          classes: '',
          children: [
            {
              id: 'layer-1762789137823-g2cdo46ld',
              name: 'section',
              design: {
                layout: { display: 'Flex', isActive: true, flexDirection: 'column' },
                sizing: { height: '100vh', isActive: true },
                spacing: { isActive: true, paddingTop: '3rem', paddingBottom: '3rem' },
              },
              classes: 'flex flex-col gap-[1rem] py-[3rem] h-[100vh]',
              children: [
                {
                  id: 'layer-1762789141753-zpz5jyobc',
                  name: 'div',
                  design: {
                    sizing: { height: '100vh', isActive: true, maxWidth: '80rem' },
                    spacing: { isActive: true, marginLeft: 'auto', marginRight: 'auto', paddingLeft: '1rem', paddingRight: '1rem' },
                  },
                  classes: 'max-w-[80rem] mx-auto px-[1rem] h-[100vh]',
                  children: [
                    {
                      id: 'layer-1762789168560-icft8ynp5',
                      name: 'div',
                      design: {
                        layout: { gap: '6', display: 'flex', isActive: true, alignItems: 'center', flexDirection: 'column', justifyContent: 'center' },
                        sizing: { height: '100%', isActive: true },
                        typography: { isActive: true, textAlign: 'center' },
                      },
                      classes: 'items-center text-center h-full flex flex-col justify-center gap-[6px]',
                      children: [
                        {
                          id: 'layer-1762789150944-5qezgblbe',
                          name: 'h2',
                          text: '404',
                          design: {
                            typography: { color: '#111827', fontSize: '30', isActive: true, fontWeight: '700' },
                          },
                          classes: 'font-[700] text-[#111827] text-[30px]',
                          content: '404',
                          children: [],
                          customName: 'Heading',
                        },
                        {
                          id: 'layer-1762789197005-7z2wy597z',
                          name: 'span',
                          text: 'The requested page could not be found',
                          design: {
                            typography: { fontSize: '12', color: '#111827', isActive: true },
                          },
                          classes: 'text-[12px] text-[#111827]',
                          content: 'The requested page could not be found',
                          children: [],
                          customName: 'Text',
                          formattable: true,
                        },
                      ],
                      customName: 'Block',
                    },
                  ],
                  customName: 'Container',
                },
              ],
              customName: 'Section',
            },
          ],
        },
      ]),
    },
    {
      code: 500,
      name: '500 - Server error',
      layers: JSON.stringify([
        {
          id: 'body',
          type: 'container',
          locked: true,
          classes: '',
          children: [
            {
              id: 'layer-1762789137823-g2cdo46ld',
              name: 'section',
              design: {
                layout: { display: 'Flex', isActive: true, flexDirection: 'column' },
                sizing: { height: '100vh', isActive: true },
                spacing: { isActive: true, paddingTop: '3rem', paddingBottom: '3rem' },
              },
              classes: 'flex flex-col gap-[1rem] py-[3rem] h-[100vh]',
              children: [
                {
                  id: 'layer-1762789141753-zpz5jyobc',
                  name: 'div',
                  design: {
                    sizing: { height: '100vh', isActive: true, maxWidth: '80rem' },
                    spacing: { isActive: true, marginLeft: 'auto', marginRight: 'auto', paddingLeft: '1rem', paddingRight: '1rem' },
                  },
                  classes: 'max-w-[80rem] mx-auto px-[1rem] h-[100vh]',
                  children: [
                    {
                      id: 'layer-1762789168560-icft8ynp5',
                      name: 'div',
                      design: {
                        layout: { gap: '6', display: 'flex', isActive: true, alignItems: 'center', flexDirection: 'column', justifyContent: 'center' },
                        sizing: { height: '100%', isActive: true },
                        typography: { isActive: true, textAlign: 'center' },
                      },
                      classes: 'items-center text-center h-full flex flex-col justify-center gap-[6px]',
                      children: [
                        {
                          id: 'layer-1762789150944-5qezgblbe',
                          name: 'h2',
                          text: '500',
                          design: {
                            typography: { color: '#111827', fontSize: '30', isActive: true, fontWeight: '700' },
                          },
                          classes: 'font-[700] text-[#111827] text-[30px]',
                          content: '500',
                          children: [],
                          customName: 'Heading',
                        },
                        {
                          id: 'layer-1762789197005-7z2wy597z',
                          name: 'span',
                          text: 'Unable to display the page due to a server error',
                          design: {
                            typography: { fontSize: '12', color: '#111827', isActive: true },
                          },
                          classes: 'text-[12px] text-[#111827]',
                          content: 'Unable to display the page due to a server error',
                          children: [],
                          customName: 'Text',
                          formattable: true,
                        },
                      ],
                      customName: 'Block',
                    },
                  ],
                  customName: 'Container',
                },
              ],
              customName: 'Section',
            },
          ],
        },
      ]),
    },
  ];

  // Insert error page records in database
  for (const errorPage of errorPages) {
    const [createdPage] = await knex('pages')
      .insert({
        name: errorPage.name,
        error_page: errorPage.code,
        slug: '',
        depth: 0,
        order: 0,
        is_published: false,
      })
      .returning('*');

    await knex('page_layers').insert({
      page_id: createdPage.id,
      layers: errorPage.layers,
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

