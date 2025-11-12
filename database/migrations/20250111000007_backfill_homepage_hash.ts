import { Knex } from 'knex';
import crypto from 'crypto';

/**
 * Migration: Backfill content_hash for default Homepage
 * 
 * The default homepage is created in migration 20250101000003 before content_hash
 * columns exist. This migration calculates and sets the missing content_hash values
 * for the homepage and its layers.
 */

/**
 * Generate a SHA-256 hash from any content
 */
function generateContentHash(content: any): string {
  if (content === null || content === undefined) {
    return crypto.createHash('sha256').update('null').digest('hex');
  }
  
  const serialized = serializeForHash(content);
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Serialize content with sorted keys for deterministic hashing
 */
function serializeForHash(obj: any): string {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj !== 'object') return String(obj);
  
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => serializeForHash(item)).join(',') + ']';
  }
  
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key => {
    const value = serializeForHash(obj[key]);
    return `"${key}":${value}`;
  });
  
  return '{' + pairs.join(',') + '}';
}

/**
 * Generate hash for page metadata
 */
function generatePageMetadataHash(pageData: {
  name: string;
  slug: string;
  settings: any;
  is_index: boolean;
  is_dynamic: boolean;
  error_page: number | null;
}): string {
  return generateContentHash({
    name: pageData.name,
    slug: pageData.slug,
    settings: pageData.settings,
    is_index: pageData.is_index,
    is_dynamic: pageData.is_dynamic,
    error_page: pageData.error_page,
  });
}

/**
 * Generate hash for page layers
 */
function generatePageLayersHash(layersData: {
  layers: any;
  generated_css: string | null;
}): string {
  return generateContentHash({
    layers: layersData.layers,
    generated_css: layersData.generated_css,
  });
}

export async function up(knex: Knex): Promise<void> {
  // Find the default homepage (is_index=true, page_folder_id=null, is_published=false)
  const homepage = await knex('pages')
    .where('is_index', true)
    .whereNull('page_folder_id')
    .where('is_published', false)
    .whereNull('deleted_at')
    .first();
  
  if (homepage) {
    // Only update if content_hash is null (not already set)
    if (!homepage.content_hash) {
      // Calculate content_hash for homepage metadata
      const pageHash = generatePageMetadataHash({
        name: homepage.name,
        slug: homepage.slug || '',
        settings: homepage.settings || {},
        is_index: homepage.is_index,
        is_dynamic: homepage.is_dynamic || false,
        error_page: homepage.error_page || null,
      });
      
      // Update homepage with content_hash
      await knex('pages')
        .where('id', homepage.id)
        .update({ content_hash: pageHash });
      
      console.log(`✓ Updated homepage (${homepage.id}) with content_hash: ${pageHash}`);
    }
    
    // Find the homepage's draft layers
    const homepageLayers = await knex('page_layers')
      .where('page_id', homepage.id)
      .where('is_published', false)
      .whereNull('deleted_at')
      .first();
    
    if (homepageLayers && !homepageLayers.content_hash) {
      // Calculate content_hash for layers
      const layersHash = generatePageLayersHash({
        layers: homepageLayers.layers,
        generated_css: homepageLayers.generated_css || null,
      });
      
      // Update layers with content_hash
      await knex('page_layers')
        .where('id', homepageLayers.id)
        .update({ content_hash: layersHash });
      
      console.log(`✓ Updated homepage layers (${homepageLayers.id}) with content_hash: ${layersHash}`);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Find the default homepage
  const homepage = await knex('pages')
    .where('is_index', true)
    .whereNull('page_folder_id')
    .where('is_published', false)
    .whereNull('deleted_at')
    .first();
  
  if (homepage) {
    // Clear content_hash from homepage
    await knex('pages')
      .where('id', homepage.id)
      .update({ content_hash: null });
    
    // Clear content_hash from homepage layers
    await knex('page_layers')
      .where('page_id', homepage.id)
      .where('is_published', false)
      .whereNull('deleted_at')
      .update({ content_hash: null });
  }
}

