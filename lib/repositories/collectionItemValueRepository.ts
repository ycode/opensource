import { getSupabaseAdmin } from '../supabase-server';
import type { CollectionItemValue, CollectionFieldType } from '@/types';
import { castValue, valueToString } from '../collection-utils';

/**
 * Collection Item Value Repository
 * 
 * Handles CRUD operations for collection item values (EAV values).
 * Each value represents one field value for one item.
 * Uses Supabase/PostgreSQL via admin client.
 */

export interface CreateCollectionItemValueData {
  value: string | null;
  item_id: number;
  field_id: number;
  is_published?: boolean;
}

export interface UpdateCollectionItemValueData {
  value?: string | null;
  is_published?: boolean;
}

/**
 * Get all values for an item
 * @param item_id - Item ID
 * @param is_published - Optional filter for draft (false) or published (true) values. If undefined, returns all.
 */
export async function getValuesByItemId(item_id: number, is_published?: boolean): Promise<CollectionItemValue[]> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  let query = client
    .from('collection_item_values')
    .select('*')
    .eq('item_id', item_id)
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
 */
export async function getValuesByFieldId(field_id: number): Promise<CollectionItemValue[]> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase client not configured');
  }
  
  const { data, error } = await client
    .from('collection_item_values')
    .select('*')
    .eq('field_id', field_id)
    .is('deleted_at', null);
  
  if (error) {
    throw new Error(`Failed to fetch field values: ${error.message}`);
  }
  
  return data || [];
}

/**
 * Get a specific value
 * @param item_id - Item ID
 * @param field_id - Field ID
 * @param is_published - Draft (false) or published (true) value. Defaults to false (draft).
 */
export async function getValue(item_id: number, field_id: number, is_published: boolean = false): Promise<CollectionItemValue | null> {
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
 * @param item_id - Item ID
 * @param field_id - Field ID
 * @param value - Value to set
 * @param is_published - Draft (false) or published (true) value. Defaults to false (draft).
 */
export async function setValue(
  item_id: number,
  field_id: number,
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
 * @param item_id - Item ID
 * @param values - Object mapping field_id to value string
 * @param is_published - Draft (false) or published (true) values. Defaults to false (draft).
 */
export async function setValues(
  item_id: number,
  values: Record<number, string | null>,
  is_published: boolean = false
): Promise<CollectionItemValue[]> {
  const results: CollectionItemValue[] = [];
  
  // Process each value
  for (const [field_id_str, value] of Object.entries(values)) {
    const field_id = parseInt(field_id_str, 10);
    const result = await setValue(item_id, field_id, value, is_published);
    results.push(result);
  }
  
  return results;
}

/**
 * Set multiple values by field name
 * Convenience method that looks up field IDs from collection
 * @param item_id - Item ID
 * @param collection_id - Collection ID
 * @param values - Object mapping field_name to value
 * @param fieldType - Field type mapping (for casting)
 * @param is_published - Draft (false) or published (true) values. Defaults to false (draft).
 */
export async function setValuesByFieldName(
  item_id: number,
  collection_id: number,
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
    .is('deleted_at', null);
  
  if (error) {
    throw new Error(`Failed to fetch fields: ${error.message}`);
  }
  
  // Create mapping of field_name -> field_id
  const fieldMap: Record<string, { id: number; type: CollectionFieldType }> = {};
  fields?.forEach((field: any) => {
    fieldMap[field.field_name] = { id: field.id, type: field.type };
  });
  
  // Convert values to strings based on type and set
  const valuesToSet: Record<number, string | null> = {};
  
  for (const [fieldName, value] of Object.entries(values)) {
    const field = fieldMap[fieldName];
    if (field) {
      valuesToSet[field.id] = valueToString(value, field.type);
    }
  }
  
  return setValues(item_id, valuesToSet, is_published);
}

/**
 * Delete a value
 */
export async function deleteValue(item_id: number, field_id: number): Promise<void> {
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
    .is('deleted_at', null);
  
  if (error) {
    throw new Error(`Failed to delete value: ${error.message}`);
  }
}

/**
 * Publish values for an item
 * Copies all draft values to published values
 * @param item_id - Item ID to publish
 * @returns Number of values published
 */
export async function publishValues(item_id: number): Promise<number> {
  const client = await getSupabaseAdmin();
  
  // Get all draft values for this item
  const draftValues = await getValuesByItemId(item_id, false);
  
  if (draftValues.length === 0) {
    return 0;
  }
  
  let publishedCount = 0;
  
  // Copy each draft value to published
  for (const draftValue of draftValues) {
    await setValue(item_id, draftValue.field_id, draftValue.value, true);
    publishedCount++;
  }
  
  return publishedCount;
}

/**
 * Cast a value to its proper type
 * Helper function to convert text values to typed values
 */
export function castValueByType(value: string | null, type: CollectionFieldType): any {
  return castValue(value, type);
}


