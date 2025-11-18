import { Knex } from 'knex';

/**
 * Migration: Collections Composite Key Refactor
 * 
 * Major architectural change:
 * - Change all collection table IDs from BIGINT to UUID
 * - Implement composite primary keys (id, is_published)
 * - Replace status columns with is_published boolean
 * - Update all foreign keys to composite keys
 * 
 * This allows the same UUID to exist as both draft and published versions.
 */
export async function up(knex: Knex): Promise<void> {
  console.log('🔄 Starting collections composite key refactor...');

  // ============================================================================
  // STEP 1: Backup existing data and add new columns
  // ============================================================================
  
  console.log('📦 Step 1: Adding is_published columns and preparing data...');
  
  // Add is_published to collections if not exists
  const collectionsHasIsPublished = await knex.schema.hasColumn('collections', 'is_published');
  if (!collectionsHasIsPublished) {
    await knex.schema.alterTable('collections', (table) => {
      table.boolean('is_published').defaultTo(false);
    });
    // Convert status to is_published
    await knex.raw(`
      UPDATE collections 
      SET is_published = (status = 'published')
      WHERE is_published IS NULL
    `);
    await knex.schema.alterTable('collections', (table) => {
      table.boolean('is_published').notNullable().defaultTo(false).alter();
    });
  }
  
  // Add is_published to collection_fields if not exists
  const fieldsHasIsPublished = await knex.schema.hasColumn('collection_fields', 'is_published');
  if (!fieldsHasIsPublished) {
    await knex.schema.alterTable('collection_fields', (table) => {
      table.boolean('is_published').defaultTo(false);
    });
    // Convert status to is_published
    await knex.raw(`
      UPDATE collection_fields 
      SET is_published = (status = 'published')
      WHERE is_published IS NULL
    `);
    await knex.schema.alterTable('collection_fields', (table) => {
      table.boolean('is_published').notNullable().defaultTo(false).alter();
    });
  }
  
  // Add is_published to collection_items if not exists
  const itemsHasIsPublished = await knex.schema.hasColumn('collection_items', 'is_published');
  if (!itemsHasIsPublished) {
    await knex.schema.alterTable('collection_items', (table) => {
      table.boolean('is_published').notNullable().defaultTo(false);
    });
  }
  
  // collection_item_values already has is_published
  
  // Add new UUID columns and composite FK columns
  await knex.schema.alterTable('collections', (table) => {
    table.uuid('new_id');
  });
  
  await knex.schema.alterTable('collection_fields', (table) => {
    table.uuid('new_id');
    table.uuid('new_collection_id');
    table.boolean('collection_is_published');
  });
  
  await knex.schema.alterTable('collection_items', (table) => {
    table.uuid('new_id');
    table.uuid('new_collection_id');
    table.boolean('collection_is_published');
  });
  
  await knex.schema.alterTable('collection_item_values', (table) => {
    table.uuid('new_id');
    table.uuid('new_item_id');
    table.boolean('item_is_published');
    table.uuid('new_field_id');
    table.boolean('field_is_published');
  });

  // ============================================================================
  // STEP 2: Generate UUIDs for all records
  // ============================================================================
  
  console.log('🔑 Step 2: Generating UUIDs for all records...');
  
  // Generate UUIDs for collections
  await knex.raw(`
    UPDATE collections 
    SET new_id = gen_random_uuid()
    WHERE new_id IS NULL
  `);
  
  // Generate UUIDs for fields
  await knex.raw(`
    UPDATE collection_fields 
    SET new_id = gen_random_uuid()
    WHERE new_id IS NULL
  `);
  
  // Generate UUIDs for items
  await knex.raw(`
    UPDATE collection_items 
    SET new_id = gen_random_uuid()
    WHERE new_id IS NULL
  `);
  
  // Generate UUIDs for values
  await knex.raw(`
    UPDATE collection_item_values 
    SET new_id = gen_random_uuid()
    WHERE new_id IS NULL
  `);

  // ============================================================================
  // STEP 3: Populate composite FK columns
  // ============================================================================
  
  console.log('🔗 Step 3: Populating composite foreign key columns...');
  
  // Update collection_fields to reference collections
  await knex.raw(`
    UPDATE collection_fields cf
    SET 
      new_collection_id = c.new_id,
      collection_is_published = c.is_published
    FROM collections c
    WHERE cf.collection_id = c.id
  `);
  
  // Update collection_items to reference collections
  await knex.raw(`
    UPDATE collection_items ci
    SET 
      new_collection_id = c.new_id,
      collection_is_published = c.is_published
    FROM collections c
    WHERE ci.collection_id = c.id
  `);
  
  // Update collection_item_values to reference items and fields
  await knex.raw(`
    UPDATE collection_item_values civ
    SET 
      new_item_id = ci.new_id,
      item_is_published = ci.is_published,
      new_field_id = cf.new_id,
      field_is_published = cf.is_published
    FROM collection_items ci, collection_fields cf
    WHERE civ.item_id = ci.id AND civ.field_id = cf.id
  `);

  // ============================================================================
  // STEP 4: Drop old constraints and indexes
  // ============================================================================
  
  console.log('🗑️  Step 4: Dropping old constraints and indexes...');
  
  // Drop foreign keys on collection_item_values
  await knex.raw(`
    ALTER TABLE collection_item_values
    DROP CONSTRAINT IF EXISTS collection_item_values_item_id_foreign,
    DROP CONSTRAINT IF EXISTS collection_item_values_field_id_foreign
  `);
  
  // Drop foreign keys on collection_items
  await knex.raw(`
    ALTER TABLE collection_items
    DROP CONSTRAINT IF EXISTS collection_items_collection_id_foreign
  `);
  
  // Drop foreign keys on collection_fields
  await knex.raw(`
    ALTER TABLE collection_fields
    DROP CONSTRAINT IF EXISTS collection_fields_collection_id_foreign,
    DROP CONSTRAINT IF EXISTS collection_fields_reference_collection_id_foreign
  `);
  
  // Drop old primary keys
  await knex.raw(`
    ALTER TABLE collection_item_values DROP CONSTRAINT IF EXISTS collection_item_values_pkey
  `);
  await knex.raw(`
    ALTER TABLE collection_items DROP CONSTRAINT IF EXISTS collection_items_pkey
  `);
  await knex.raw(`
    ALTER TABLE collection_fields DROP CONSTRAINT IF EXISTS collection_fields_pkey
  `);
  await knex.raw(`
    ALTER TABLE collections DROP CONSTRAINT IF EXISTS collections_pkey
  `);
  
  // Drop old indexes
  await knex.raw(`DROP INDEX IF EXISTS idx_collections_collection_name`);
  await knex.raw(`DROP INDEX IF EXISTS idx_collections_status`);
  await knex.raw(`DROP INDEX IF EXISTS idx_collection_fields_collection_id`);
  await knex.raw(`DROP INDEX IF EXISTS idx_collection_items_collection_id`);
  await knex.raw(`DROP INDEX IF EXISTS idx_collection_item_values_item_id`);
  await knex.raw(`DROP INDEX IF EXISTS idx_collection_item_values_field_id`);

  // ============================================================================
  // STEP 5: Rename columns (new_id -> id, etc.)
  // ============================================================================
  
  console.log('♻️  Step 5: Renaming columns...');
  
  // Rename in collections
  await knex.schema.alterTable('collections', (table) => {
    table.renameColumn('id', 'old_id');
    table.renameColumn('new_id', 'id');
  });
  
  // Rename in collection_fields
  await knex.schema.alterTable('collection_fields', (table) => {
    table.renameColumn('id', 'old_id');
    table.renameColumn('new_id', 'id');
    table.renameColumn('collection_id', 'old_collection_id');
    table.renameColumn('new_collection_id', 'collection_id');
  });
  
  // Rename in collection_items
  await knex.schema.alterTable('collection_items', (table) => {
    table.renameColumn('id', 'old_id');
    table.renameColumn('new_id', 'id');
    table.renameColumn('collection_id', 'old_collection_id');
    table.renameColumn('new_collection_id', 'collection_id');
  });
  
  // Rename in collection_item_values
  await knex.schema.alterTable('collection_item_values', (table) => {
    table.renameColumn('id', 'old_id');
    table.renameColumn('new_id', 'id');
    table.renameColumn('item_id', 'old_item_id');
    table.renameColumn('new_item_id', 'item_id');
    table.renameColumn('field_id', 'old_field_id');
    table.renameColumn('new_field_id', 'field_id');
  });

  // ============================================================================
  // STEP 6: Add composite primary keys
  // ============================================================================
  
  console.log('🔑 Step 6: Adding composite primary keys...');
  
  await knex.raw(`
    ALTER TABLE collections
    ADD PRIMARY KEY (id, is_published)
  `);
  
  await knex.raw(`
    ALTER TABLE collection_fields
    ADD PRIMARY KEY (id, is_published)
  `);
  
  await knex.raw(`
    ALTER TABLE collection_items
    ADD PRIMARY KEY (id, is_published)
  `);
  
  await knex.raw(`
    ALTER TABLE collection_item_values
    ADD PRIMARY KEY (id, is_published)
  `);

  // ============================================================================
  // STEP 7: Add composite foreign keys
  // ============================================================================
  
  console.log('🔗 Step 7: Adding composite foreign keys...');
  
  // collection_fields -> collections
  await knex.raw(`
    ALTER TABLE collection_fields
    ADD CONSTRAINT collection_fields_collection_fkey
    FOREIGN KEY (collection_id, collection_is_published)
    REFERENCES collections(id, is_published)
    ON DELETE CASCADE
  `);
  
  // collection_items -> collections
  await knex.raw(`
    ALTER TABLE collection_items
    ADD CONSTRAINT collection_items_collection_fkey
    FOREIGN KEY (collection_id, collection_is_published)
    REFERENCES collections(id, is_published)
    ON DELETE CASCADE
  `);
  
  // collection_item_values -> collection_items
  await knex.raw(`
    ALTER TABLE collection_item_values
    ADD CONSTRAINT collection_item_values_item_fkey
    FOREIGN KEY (item_id, item_is_published)
    REFERENCES collection_items(id, is_published)
    ON DELETE CASCADE
  `);
  
  // collection_item_values -> collection_fields
  await knex.raw(`
    ALTER TABLE collection_item_values
    ADD CONSTRAINT collection_item_values_field_fkey
    FOREIGN KEY (field_id, field_is_published)
    REFERENCES collection_fields(id, is_published)
    ON DELETE CASCADE
  `);

  // ============================================================================
  // STEP 8: Add indexes
  // ============================================================================
  
  console.log('📑 Step 8: Adding indexes...');
  
  await knex.schema.alterTable('collections', (table) => {
    table.index(['collection_name', 'is_published'], 'idx_collections_name_published');
    table.index('is_published', 'idx_collections_is_published');
  });
  
  await knex.schema.alterTable('collection_fields', (table) => {
    table.index(['collection_id', 'collection_is_published'], 'idx_fields_collection');
    table.index('is_published', 'idx_fields_is_published');
  });
  
  await knex.schema.alterTable('collection_items', (table) => {
    table.index(['collection_id', 'collection_is_published'], 'idx_items_collection');
    table.index('is_published', 'idx_items_is_published');
  });
  
  await knex.schema.alterTable('collection_item_values', (table) => {
    table.index(['item_id', 'item_is_published'], 'idx_values_item');
    table.index(['field_id', 'field_is_published'], 'idx_values_field');
    table.index('is_published', 'idx_values_is_published');
  });

  // ============================================================================
  // STEP 9: Drop old columns
  // ============================================================================
  
  console.log('🗑️  Step 9: Dropping old columns...');
  
  await knex.schema.alterTable('collections', (table) => {
    table.dropColumn('old_id');
    table.dropColumn('status');
  });
  
  await knex.schema.alterTable('collection_fields', (table) => {
    table.dropColumn('old_id');
    table.dropColumn('old_collection_id');
    table.dropColumn('status');
  });
  
  await knex.schema.alterTable('collection_items', (table) => {
    table.dropColumn('old_id');
    table.dropColumn('old_collection_id');
  });
  
  await knex.schema.alterTable('collection_item_values', (table) => {
    table.dropColumn('old_id');
    table.dropColumn('old_item_id');
    table.dropColumn('old_field_id');
  });

  // ============================================================================
  // STEP 10: Make new FK columns NOT NULL
  // ============================================================================
  
  console.log('✅ Step 10: Setting constraints on new columns...');
  
  await knex.schema.alterTable('collection_fields', (table) => {
    table.uuid('collection_id').notNullable().alter();
    table.boolean('collection_is_published').notNullable().alter();
  });
  
  await knex.schema.alterTable('collection_items', (table) => {
    table.uuid('collection_id').notNullable().alter();
    table.boolean('collection_is_published').notNullable().alter();
  });
  
  await knex.schema.alterTable('collection_item_values', (table) => {
    table.uuid('item_id').notNullable().alter();
    table.boolean('item_is_published').notNullable().alter();
    table.uuid('field_id').notNullable().alter();
    table.boolean('field_is_published').notNullable().alter();
  });

  console.log('✅ Collections composite key refactor completed successfully!');
}

export async function down(knex: Knex): Promise<void> {
  console.log('⚠️  WARNING: This migration cannot be safely reversed!');
  console.log('⚠️  Rolling back would require converting UUIDs back to BIGINTs and recreating the old structure.');
  console.log('⚠️  This would result in data loss. Please restore from backup if needed.');
  
  throw new Error('This migration cannot be reversed. Please restore from database backup.');
}

