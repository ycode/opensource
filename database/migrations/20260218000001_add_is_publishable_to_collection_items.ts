import { Knex } from 'knex';

/**
 * Migration: Add is_publishable + content_hash to collection_items, is_computed to collection_fields
 *
 * 1. Adds is_publishable boolean to collection_items (per-item publish eligibility toggle)
 * 2. Adds content_hash text to collection_items (hash of item values for change detection)
 * 3. Adds is_computed boolean to collection_fields (marks computed fields like Status)
 * 4. Inserts a built-in "Status" field (type=status, key=status) for every collection that lacks one
 */
export async function up(knex: Knex): Promise<void> {
  // 1. Add is_publishable to collection_items
  const hasPublishable = await knex.schema.hasColumn('collection_items', 'is_publishable');
  if (!hasPublishable) {
    await knex.schema.alterTable('collection_items', (table) => {
      table.boolean('is_publishable').notNullable().defaultTo(true);
    });
  }

  // 2. Add content_hash to collection_items
  const hasContentHash = await knex.schema.hasColumn('collection_items', 'content_hash');
  if (!hasContentHash) {
    await knex.schema.alterTable('collection_items', (table) => {
      table.text('content_hash').nullable();
    });
  }

  // 3. Add is_computed to collection_fields
  const hasComputed = await knex.schema.hasColumn('collection_fields', 'is_computed');
  if (!hasComputed) {
    await knex.schema.alterTable('collection_fields', (table) => {
      table.boolean('is_computed').notNullable().defaultTo(false);
    });
  }

  // 4. Insert a Status field for every collection that doesn't already have one
  const collections = await knex('collections')
    .select('id', 'is_published')
    .whereNull('deleted_at');

  for (const collection of collections) {
    const existingStatus = await knex('collection_fields')
      .where('collection_id', collection.id)
      .where('is_published', collection.is_published)
      .where('key', 'status')
      .whereNull('deleted_at')
      .first();

    if (!existingStatus) {
      await knex('collection_fields').insert({
        id: knex.raw('gen_random_uuid()'),
        collection_id: collection.id,
        name: 'Status',
        key: 'status',
        type: 'status',
        fillable: false,
        hidden: false,
        is_computed: true,
        order: 1,
        data: JSON.stringify({}),
        is_published: collection.is_published,
        created_at: knex.fn.now(),
        updated_at: knex.fn.now(),
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Remove Status fields
  await knex('collection_fields')
    .where('key', 'status')
    .where('type', 'status')
    .del();

  // Remove is_computed column
  const hasComputed = await knex.schema.hasColumn('collection_fields', 'is_computed');
  if (hasComputed) {
    await knex.schema.alterTable('collection_fields', (table) => {
      table.dropColumn('is_computed');
    });
  }

  // Remove content_hash column
  const hasContentHash = await knex.schema.hasColumn('collection_items', 'content_hash');
  if (hasContentHash) {
    await knex.schema.alterTable('collection_items', (table) => {
      table.dropColumn('content_hash');
    });
  }

  // Remove is_publishable column
  const hasPublishable = await knex.schema.hasColumn('collection_items', 'is_publishable');
  if (hasPublishable) {
    await knex.schema.alterTable('collection_items', (table) => {
      table.dropColumn('is_publishable');
    });
  }
}
