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
 * References items using FK (item_id).
 * References fields using FK (field_id).
 */

export interface CreateCollectionItemValueData {
  value: string | null;
  item_id: string; // UUID
  field_id: string; // UUID
  is_published?: boolean;
}

export interface UpdateCollectionItemValueData {
  value?: string | null;
}

/**
 * Get all values for multiple items in one query (batch operation)
 * @param item_ids - Array of item UUIDs
 * @param is_published - Filter for draft (false) or published (true) values. Defaults to false (draft).
 */
export async function getValuesByItemIds(
  item_ids: string[],
  is_published: boolean = false
): Promise<Record<string, Record<string, string>>> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  if (item_ids.length === 0) {
    return {};
  }

  const { data, error } = await client
    .from('collection_item_values')
    .select('item_id, field_id, value')
    .in('item_id', item_ids)
    .eq('is_published', is_published)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch item values: ${error.message}`);
  }

  // Transform to { item_id: { field_id: value } } structure
  const valuesByItem: Record<string, Record<string, string>> = {};
  
  data?.forEach((row: any) => {
    if (!valuesByItem[row.item_id]) {
      valuesByItem[row.item_id] = {};
    }
    valuesByItem[row.item_id][row.field_id] = row.value;
  });

  return valuesByItem;
}

/**
 * Get all values for an item
 * @param item_id - Item UUID
 * @param is_published - Filter for draft (false) or published (true) values. Defaults to false (draft).
 */
export async function getValuesByItemId(
  item_id: string,
  is_published: boolean = false
): Promise<CollectionItemValue[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('collection_item_values')
    .select('*')
    .eq('item_id', item_id)
    .eq('is_published', is_published)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch item values: ${error.message}`);
  }

  return data || [];
}

/**
 * Get all values for a field
 * @param field_id - Field UUID
 * @param is_published - Filter for draft (false) or published (true) values. Defaults to false (draft).
 */
export async function getValuesByFieldId(
  field_id: string,
  is_published: boolean = false
): Promise<CollectionItemValue[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  const { data, error } = await client
    .from('collection_item_values')
    .select('*')
    .eq('field_id', field_id)
    .eq('is_published', is_published)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch field values: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a specific value
 * @param item_id - Item UUID
 * @param field_id - Field UUID
 * @param is_published - Draft (false) or published (true) value. Defaults to false (draft).
 */
export async function getValue(
  item_id: string,
  field_id: string,
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
    .eq('field_id', field_id)
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
 * @param field_id - Field UUID
 * @param value - Value to set
 * @param is_published - Draft (false) or published (true) value. Defaults to false (draft).
 */
export async function setValue(
  item_id: string,
  field_id: string,
  value: string | null,
  is_published: boolean = false
): Promise<CollectionItemValue> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Check if value already exists for this specific version (draft or published)
  const existing = await getValue(item_id, field_id, is_published);
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
        field_id,
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
 * @param values - Object mapping field_id (UUID) to value string
 * @param is_published - Draft (false) or published (true) values. Defaults to false (draft).
 */
export async function setValues(
  item_id: string,
  values: Record<string, string | null>,
  is_published: boolean = false
): Promise<CollectionItemValue[]> {
  const results: CollectionItemValue[] = [];

  // Process each value
  for (const [field_id, value] of Object.entries(values)) {
    const result = await setValue(item_id, field_id, value, is_published);
    results.push(result);
  }

  return results;
}

/**
 * Set multiple values by field ID
 * Convenience method that validates field IDs and applies type casting
 * @param item_id - Item UUID
 * @param collection_id - Collection UUID
 * @param values - Object mapping field_id (UUID) to value
 * @param fieldType - Field type mapping (for casting)
 * @param is_published - Draft (false) or published (true) values. Defaults to false (draft).
 *                       Fields are fetched with the same is_published status.
 */
export async function setValuesByFieldName(
  item_id: string,
  collection_id: string,
  values: Record<string, any>,
  fieldType: Record<string, CollectionFieldType>,
  is_published: boolean = false
): Promise<CollectionItemValue[]> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Get field mappings to validate field IDs and get types
  // Fields are fetched with the same is_published status as the values
  const { data: fields, error } = await client
    .from('collection_fields')
    .select('id, type')
    .eq('collection_id', collection_id)
    .eq('is_published', is_published)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch fields: ${error.message}`);
  }

  // Create mapping of field_id -> type
  const fieldMap: Record<string, CollectionFieldType> = {};
  fields?.forEach((field: any) => {
    fieldMap[field.id] = field.type;
  });

  // Convert values to strings based on type and set
  const valuesToSet: Record<string, string | null> = {};

  for (const [fieldId, value] of Object.entries(values)) {
    const type = fieldMap[fieldId] || fieldType[fieldId];
    if (type) {
      valuesToSet[fieldId] = valueToString(value, type);
    }
  }

  return setValues(item_id, valuesToSet, is_published);
}

/**
 * Delete a value
 * @param item_id - Item UUID
 * @param field_id - Field UUID
 * @param is_published - Which version to delete: draft (false) or published (true). Defaults to false (draft).
 */
export async function deleteValue(
  item_id: string,
  field_id: string,
  is_published: boolean = false
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
    .eq('field_id', field_id)
    .eq('is_published', is_published)
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to delete value: ${error.message}`);
  }
}

/**
 * Publish values for an item
 * Copies all draft values to published values for the same item
 * Uses batch upsert for efficiency
 * @param item_id - Item UUID to publish
 * @returns Number of values published
 */
export async function publishValues(item_id: string): Promise<number> {
  const client = await getSupabaseAdmin();

  if (!client) {
    throw new Error('Supabase client not configured');
  }

  // Get all draft values for this item
  const draftValues = await getValuesByItemId(item_id, false);
  console.log(`[publishValues] Found ${draftValues.length} draft values for item ${item_id}`);

  if (draftValues.length === 0) {
    console.log(`[publishValues] No draft values to publish for item ${item_id}`);
    return 0;
  }

  // Prepare values for batch upsert
  const now = new Date().toISOString();
  const valuesToUpsert = draftValues.map(value => ({
    id: value.id,
    item_id: value.item_id,
    field_id: value.field_id,
    value: value.value,
    is_published: true,
    created_at: value.created_at,
    updated_at: now,
  }));

  // Batch upsert all values
  const { error } = await client
    .from('collection_item_values')
    .upsert(valuesToUpsert, {
      onConflict: 'id,is_published', // Composite primary key
    });

  if (error) {
    throw new Error(`Failed to publish values: ${error.message}`);
  }

  console.log(`[publishValues] Successfully published ${draftValues.length} values for item ${item_id}`);
  return draftValues.length;
}

/**
 * Cast a value to its proper type
 * Helper function to convert text values to typed values
 */
export function castValueByType(value: string | null, type: CollectionFieldType): any {
  return castValue(value, type);
}
