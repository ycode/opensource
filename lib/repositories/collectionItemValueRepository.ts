import { getSupabaseAdmin } from '../supabase-server';
import type { CollectionItemValue, CollectionFieldType } from '@/types';
import { castValue, valueToString } from '../collection-utils';
import { randomUUID } from 'crypto';

/**
 * Collection Item Value Repository
 *
 * Handles CRUD operations for collection item values (EAV values).
 * Each value represents one field value for one item.
 * Uses Supabase/PostgreSQL via admin client.
 *
 * NOTE: Uses composite primary key (id, is_published) architecture.
 * References items using composite FK (item_id, item_is_published).
 * References fields using composite FK (field_id, field_is_published).
 */

export interface CreateCollectionItemValueData {
  value: string | null;
  item_id: string; // UUID
  item_is_published?: boolean; // Defaults to false (draft)
  field_id: string; // UUID
  field_is_published?: boolean; // Defaults to false (draft)
  is_published?: boolean;
}

export interface UpdateCollectionItemValueData {
  value?: string | null;
}

/**
 * Get all values for an item
 * @param item_id - Item UUID
 * @param itemIsPublished - Whether this is for draft (false) or published (true) item
 * @param is_published - Optional filter for draft (false) or published (true) values. If undefined, returns all.
 */
export async function getValuesByItemId(
  item_id: string,
  itemIsPublished: boolean,
  is_published?: boolean
): Promise<CollectionItemValue[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  let query = client
    .from('collection_item_values')
    .select('*')
    .eq('item_id', item_id)
    .eq('item_is_published', itemIsPublished)
    .is('deleted_at', null);

  if (is_published !== undefined) {
    query = query.eq('is_published', is_published);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch item values: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all values for a field
 * @param field_id - Field UUID
 * @param fieldIsPublished - Whether this is for draft (false) or published (true) field
 */
export async function getValuesByFieldId(
  field_id: string,
  fieldIsPublished: boolean
): Promise<CollectionItemValue[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('collection_item_values')
    .select('*')
    .eq('field_id', field_id)
    .eq('field_is_published', fieldIsPublished)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch field values: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a specific value
 * @param item_id - Item UUID
 * @param itemIsPublished - Whether this is for draft (false) or published (true) item
 * @param field_id - Field UUID
 * @param fieldIsPublished - Whether this is for draft (false) or published (true) field
 * @param is_published - Draft (false) or published (true) value. Defaults to false (draft).
 */
export async function getValue(
  item_id: string,
  itemIsPublished: boolean,
  field_id: string,
  fieldIsPublished: boolean,
  is_published: boolean = false
): Promise<CollectionItemValue | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('collection_item_values')
    .select('*')
    .eq('item_id', item_id)
    .eq('item_is_published', itemIsPublished)
    .eq('field_id', field_id)
    .eq('field_is_published', fieldIsPublished)
    .eq('is_published', is_published)
    .is('deleted_at', null)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to fetch value: ${error.message}`);
  }

  return data;
}

/**
 * Set a value (upsert)
 * @param item_id - Item UUID
 * @param itemIsPublished - Whether this is for draft (false) or published (true) item
 * @param field_id - Field UUID
 * @param fieldIsPublished - Whether this is for draft (false) or published (true) field
 * @param value - Value to set
 * @param is_published - Draft (false) or published (true) value. Defaults to false (draft).
 */
export async function setValue(
  item_id: string,
  itemIsPublished: boolean,
  field_id: string,
  fieldIsPublished: boolean,
  value: string | null,
  is_published: boolean = false
): Promise<CollectionItemValue> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Check if value already exists for this specific version (draft or published)
  const existing = await getValue(item_id, itemIsPublished, field_id, fieldIsPublished, is_published);

  if (existing) {
    // Update existing value
    const { data, error } = await client
      .from('collection_item_values')
      .update({
        value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .eq('is_published', is_published)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update value: ${error.message}`);
    }

    return data;
  } else {
    // Create new value
    const { data, error } = await client
      .from('collection_item_values')
      .insert({
        id: randomUUID(),
        item_id,
        item_is_published: itemIsPublished,
        field_id,
        field_is_published: fieldIsPublished,
        value,
        is_published,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create value: ${error.message}`);
    }

    return data;
  }
}

/**
 * Set multiple values for an item (batch upsert)
 * @param item_id - Item UUID
 * @param itemIsPublished - Whether this is for draft (false) or published (true) item
 * @param values - Object mapping field_id (UUID) to value string
 * @param fieldIsPublished - Whether fields are draft (false) or published (true)
 * @param is_published - Draft (false) or published (true) values. Defaults to false (draft).
 */
export async function setValues(
  item_id: string,
  itemIsPublished: boolean,
  values: Record<string, string | null>,
  fieldIsPublished: boolean,
  is_published: boolean = false
): Promise<CollectionItemValue[]> {
  const results: CollectionItemValue[] = [];

  // Process each value
  for (const [field_id, value] of Object.entries(values)) {
    const result = await setValue(item_id, itemIsPublished, field_id, fieldIsPublished, value, is_published);
    results.push(result);
  }

  return results;
}

/**
 * Set multiple values by field name
 * Convenience method that looks up field IDs from collection
 * @param item_id - Item UUID
 * @param itemIsPublished - Whether this is for draft (false) or published (true) item
 * @param collection_id - Collection UUID
 * @param collectionIsPublished - Whether this is for draft (false) or published (true) collection
 * @param values - Object mapping field_name to value
 * @param fieldType - Field type mapping (for casting)
 * @param is_published - Draft (false) or published (true) values. Defaults to false (draft).
 */
export async function setValuesByFieldName(
  item_id: string,
  itemIsPublished: boolean,
  collection_id: string,
  collectionIsPublished: boolean,
  values: Record<string, any>,
  fieldType: Record<string, CollectionFieldType>,
  is_published: boolean = false
): Promise<CollectionItemValue[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Get field mappings
  const { data: fields, error } = await client
    .from('collection_fields')
    .select('id, field_name, type')
    .eq('collection_id', collection_id)
    .eq('collection_is_published', collectionIsPublished)
    .eq('is_published', collectionIsPublished)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch fields: ${error.message}`);
  }

  // Create mapping of field_name -> field_id
  const fieldMap: Record<string, { id: string; type: CollectionFieldType }> = {};
  fields?.forEach((field: any) => {
    fieldMap[field.field_name] = { id: field.id, type: field.type };
  });

  // Convert values to strings based on type and set
  const valuesToSet: Record<string, string | null> = {};

  for (const [fieldName, value] of Object.entries(values)) {
    const field = fieldMap[fieldName];
    if (field) {
      valuesToSet[field.id] = valueToString(value, field.type);
    }
  }

  return setValues(item_id, itemIsPublished, valuesToSet, collectionIsPublished, is_published);
}

/**
 * Delete a value
 * @param item_id - Item UUID
 * @param itemIsPublished - Whether this is for draft (false) or published (true) item
 * @param field_id - Field UUID
 * @param fieldIsPublished - Whether this is for draft (false) or published (true) field
 * @param isPublished - Which version to delete: draft (false) or published (true). Defaults to false (draft).
 */
export async function deleteValue(
  item_id: string,
  itemIsPublished: boolean,
  field_id: string,
  fieldIsPublished: boolean,
  isPublished: boolean = false
): Promise<void> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { error } = await client
    .from('collection_item_values')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('item_id', item_id)
    .eq('item_is_published', itemIsPublished)
    .eq('field_id', field_id)
    .eq('field_is_published', fieldIsPublished)
    .eq('is_published', isPublished)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to delete value: ${error.message}`);
  }
}

/**
 * Publish values for an item
 * Copies all draft values to published values for the same item
 * @param item_id - Item UUID to publish
 * @returns Number of values published
 */
export async function publishValues(item_id: string): Promise<number> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Get all draft values for this item
  const draftValues = await getValuesByItemId(item_id, false, false);
  console.log(`[publishValues] Found ${draftValues.length} draft values for item ${item_id}`);

  if (draftValues.length === 0) {
    console.log(`[publishValues] No draft values to publish for item ${item_id}`);
    return 0;
  }

  let publishedCount = 0;

  // Copy each draft value to published
  for (const draftValue of draftValues) {
    console.log(`[publishValues] Publishing value for field ${draftValue.field_id}, value: ${draftValue.value}`);
    const result = await setValue(
      item_id,
      true, // Published item
      draftValue.field_id,
      true, // Published field
      draftValue.value,
      true // Published value
    );
    console.log(`[publishValues] Value published, result:`, result);
    publishedCount++;
  }

  console.log(`[publishValues] Total published: ${publishedCount} values for item ${item_id}`);
  return publishedCount;
}

/**
 * Cast a value to its proper type
 * Helper function to convert text values to typed values
 */
export function castValueByType(value: string | null, type: CollectionFieldType): any {
  return castValue(value, type);
}
