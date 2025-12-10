/**
 * Locale Repository
 *
 * Data access layer for locales (language/region configurations)
 * Supports draft/published workflow with composite primary key (id, is_published)
 */

import { getSupabaseAdmin } from '../supabase-server';
import type { Locale, CreateLocaleData, UpdateLocaleData } from '@/types';

/**
 * Get all locales (draft by default)
 */
export async function getAllLocales(isPublished: boolean = false): Promise<Locale[]> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { data, error } = await client
    .from('locales')
    .select('*')
    .eq('is_published', isPublished)
    .is('deleted_at', null)
    .order('is_default', { ascending: false })
    .order('label', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch locales: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single locale by ID (draft by default)
 * With composite primary key, we need to specify is_published to get a single row
 */
export async function getLocaleById(id: string, isPublished: boolean = false): Promise<Locale | null> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { data, error } = await client
    .from('locales')
    .select('*')
    .eq('id', id)
    .eq('is_published', isPublished)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch locale: ${error.message}`);
  }

  return data;
}

/**
 * Get locale by code (draft by default)
 */
export async function getLocaleByCode(code: string, isPublished: boolean = false): Promise<Locale | null> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { data, error } = await client
    .from('locales')
    .select('*')
    .eq('code', code)
    .eq('is_published', isPublished)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch locale: ${error.message}`);
  }

  return data;
}

/**
 * Get the default locale (draft by default)
 */
export async function getDefaultLocale(isPublished: boolean = false): Promise<Locale | null> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  const { data, error } = await client
    .from('locales')
    .select('*')
    .eq('is_default', true)
    .eq('is_published', isPublished)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // No default locale set
    }
    throw new Error(`Failed to fetch default locale: ${error.message}`);
  }

  return data;
}

/**
 * Create a new locale (draft by default)
 */
export async function createLocale(
  localeData: CreateLocaleData
): Promise<Locale> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // If this is set as default, unset any existing default
  if (localeData.is_default) {
    await client
      .from('locales')
      .update({ is_default: false })
      .eq('is_default', true)
      .eq('is_published', false);
  }

  const { data, error } = await client
    .from('locales')
    .insert({
      code: localeData.code,
      label: localeData.label,
      is_default: localeData.is_default || false,
      is_published: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create locale: ${error.message}`);
  }

  return data;
}

/**
 * Update a locale (draft only)
 */
export async function updateLocale(
  id: string,
  updates: UpdateLocaleData
): Promise<Locale> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // If this is being set as default, unset any existing default
  if (updates.is_default) {
    await client
      .from('locales')
      .update({ is_default: false })
      .eq('is_default', true)
      .eq('is_published', false)
      .neq('id', id);
  }

  const { data, error } = await client
    .from('locales')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('is_published', false)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update locale: ${error.message}`);
  }

  return data;
}

/**
 * Delete a locale (soft delete - sets deleted_at timestamp)
 */
export async function deleteLocale(id: string): Promise<void> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Check if this is the default locale
  const locale = await getLocaleById(id, false);
  if (locale?.is_default) {
    throw new Error('Cannot delete the default locale');
  }

  const { error } = await client
    .from('locales')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('is_published', false);

  if (error) {
    throw new Error(`Failed to delete locale: ${error.message}`);
  }
}

/**
 * Set a locale as the default
 */
export async function setDefaultLocale(id: string): Promise<Locale> {
  const client = await getSupabaseAdmin();
  if (!client) {
    throw new Error('Failed to initialize Supabase client');
  }

  // Unset current default
  await client
    .from('locales')
    .update({ is_default: false })
    .eq('is_default', true)
    .eq('is_published', false);

  // Set new default
  const { data, error } = await client
    .from('locales')
    .update({
      is_default: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('is_published', false)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to set default locale: ${error.message}`);
  }

  return data;
}
