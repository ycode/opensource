import type { Knex } from 'knex';

/**
 * Migration: Create Pages Table
 * 
 * Creates the pages table with RLS and policies
 */

export async function up(knex: Knex): Promise<void> {
  // Create pages table
  await knex.schema.createTable('pages', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('slug', 255).notNullable().unique();
    table.string('title', 255).notNullable();
    table.string('status', 50).defaultTo('draft');
    table.uuid('published_version_id').nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Create indexes
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug)');
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_pages_status ON pages(status)');

  // Enable Row Level Security
  await knex.schema.raw('ALTER TABLE pages ENABLE ROW LEVEL SECURITY');

  // Create RLS policies
  await knex.schema.raw(`
    CREATE POLICY "Public pages are viewable by everyone" 
      ON pages FOR SELECT 
      USING (status = 'published')
  `);

  await knex.schema.raw(`
    CREATE POLICY "Authenticated users can manage pages" 
      ON pages FOR ALL 
      USING (auth.role() = 'authenticated')
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Drop policies first
  await knex.schema.raw('DROP POLICY IF EXISTS "Public pages are viewable by everyone" ON pages');
  await knex.schema.raw('DROP POLICY IF EXISTS "Authenticated users can manage pages" ON pages');

  // Drop table
  await knex.schema.dropTableIfExists('pages');
}

