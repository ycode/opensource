import { getSupabaseAdmin } from '../supabase-server';
import type { Page } from '../../types';

export interface CreatePageData {
  title: string;
  slug: string;
  status: 'draft' | 'published';
  published_version_id?: string | null;
}

export interface UpdatePageData {
  title?: string;
  slug?: string;
  status?: 'draft' | 'published';
  published_version_id?: string | null;
}

/**
 * Get all pages
 */
export async function getAllPages(): Promise<Page[]> {
  console.log('[pageRepository.getAllPages] Getting Supabase client...');
  const client = await getSupabaseAdmin();
  
  if (!client) {
    console.error('[pageRepository.getAllPages] Supabase client is null!');
    throw new Error('Supabase not configured');
  }

  console.log('[pageRepository.getAllPages] Querying pages table...');
  const { data, error } = await client
    .from('pages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[pageRepository.getAllPages] Query error:', error);
    throw new Error(`Failed to fetch pages: ${error.message}`);
  }

  console.log('[pageRepository.getAllPages] Query success, rows:', data?.length || 0);
  return data || [];
}

/**
 * Get page by ID
 */
export async function getPageById(id: string): Promise<Page | null> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('pages')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch page: ${error.message}`);
  }

  return data;
}

/**
 * Get page by slug
 */
export async function getPageBySlug(slug: string): Promise<Page | null> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('pages')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to fetch page: ${error.message}`);
  }

  return data;
}

/**
 * Create new page
 */
export async function createPage(pageData: CreatePageData): Promise<Page> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await client
    .from('pages')
    .insert(pageData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create page: ${error.message}`);
  }

  return data;
}

/**
 * Update page
 */
export async function updatePage(id: string, updates: UpdatePageData): Promise<Page> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { data, error} = await client
    .from('pages')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update page: ${error.message}`);
  }

  return data;
}

/**
 * Delete page
 */
export async function deletePage(id: string): Promise<void> {
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase not configured');
  }

  const { error } = await client
    .from('pages')
    .delete()
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete page: ${error.message}`);
  }
}

