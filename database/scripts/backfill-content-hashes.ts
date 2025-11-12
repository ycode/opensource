/**
 * Backfill Content Hashes Script
 * 
 * This script calculates and stores content_hash for all existing entities:
 * - Pages (metadata hash)
 * - PageLayers (layers + CSS hash)
 * - Components (name + layers hash)
 * - LayerStyles (name + classes + design hash)
 * 
 * Run this after the content_hash migrations have been applied.
 * 
 * Usage: npx ts-node database/scripts/backfill-content-hashes.ts
 */

import { getSupabaseAdmin } from '../../lib/supabase-server';
import {
  generatePageMetadataHash,
  generatePageLayersHash,
  generateComponentContentHash,
  generateLayerStyleContentHash,
} from '../../lib/hash-utils';

async function backfillPageHashes() {
  console.log('Backfilling page content hashes...');
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase not configured');
  }
  
  // Get all pages
  const { data: pages, error } = await client
    .from('pages')
    .select('*')
    .is('deleted_at', null);
  
  if (error) {
    throw new Error(`Failed to fetch pages: ${error.message}`);
  }
  
  if (!pages || pages.length === 0) {
    console.log('  No pages found');
    return;
  }
  
  let updated = 0;
  
  for (const page of pages) {
    try {
      // Calculate hash for page metadata
      const hash = generatePageMetadataHash({
        name: page.name,
        slug: page.slug,
        settings: page.settings || {},
        is_index: page.is_index || false,
        is_dynamic: page.is_dynamic || false,
        error_page: page.error_page || null,
      });
      
      // Update page with content_hash
      const { error: updateError } = await client
        .from('pages')
        .update({ content_hash: hash })
        .eq('id', page.id);
      
      if (updateError) {
        console.error(`  Error updating page ${page.id}:`, updateError.message);
      } else {
        updated++;
      }
    } catch (error) {
      console.error(`  Error processing page ${page.id}:`, error);
    }
  }
  
  console.log(`  Updated ${updated} of ${pages.length} pages`);
}

async function backfillPageLayersHashes() {
  console.log('Backfilling page_layers content hashes...');
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase not configured');
  }
  
  // Get all page_layers
  const { data: pageLayersRecords, error } = await client
    .from('page_layers')
    .select('*')
    .is('deleted_at', null);
  
  if (error) {
    throw new Error(`Failed to fetch page_layers: ${error.message}`);
  }
  
  if (!pageLayersRecords || pageLayersRecords.length === 0) {
    console.log('  No page_layers found');
    return;
  }
  
  let updated = 0;
  
  for (const record of pageLayersRecords) {
    try {
      // Calculate hash for layers + CSS
      const hash = generatePageLayersHash({
        layers: record.layers || [],
        generated_css: record.generated_css || null,
      });
      
      // Update page_layers with content_hash
      const { error: updateError } = await client
        .from('page_layers')
        .update({ content_hash: hash })
        .eq('id', record.id);
      
      if (updateError) {
        console.error(`  Error updating page_layers ${record.id}:`, updateError.message);
      } else {
        updated++;
      }
    } catch (error) {
      console.error(`  Error processing page_layers ${record.id}:`, error);
    }
  }
  
  console.log(`  Updated ${updated} of ${pageLayersRecords.length} page_layers records`);
}

async function backfillComponentHashes() {
  console.log('Backfilling component content hashes...');
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase not configured');
  }
  
  // Get all components
  const { data: components, error } = await client
    .from('components')
    .select('*');
  
  if (error) {
    throw new Error(`Failed to fetch components: ${error.message}`);
  }
  
  if (!components || components.length === 0) {
    console.log('  No components found');
    return;
  }
  
  let updated = 0;
  
  for (const component of components) {
    try {
      // Calculate hash for component
      const hash = generateComponentContentHash({
        name: component.name,
        layers: component.layers || [],
      });
      
      // Update component with content_hash
      const { error: updateError } = await client
        .from('components')
        .update({ content_hash: hash })
        .eq('id', component.id);
      
      if (updateError) {
        console.error(`  Error updating component ${component.id}:`, updateError.message);
      } else {
        updated++;
      }
    } catch (error) {
      console.error(`  Error processing component ${component.id}:`, error);
    }
  }
  
  console.log(`  Updated ${updated} of ${components.length} components`);
}

async function backfillLayerStyleHashes() {
  console.log('Backfilling layer_styles content hashes...');
  const client = await getSupabaseAdmin();
  
  if (!client) {
    throw new Error('Supabase not configured');
  }
  
  // Get all layer styles
  const { data: styles, error } = await client
    .from('layer_styles')
    .select('*');
  
  if (error) {
    throw new Error(`Failed to fetch layer_styles: ${error.message}`);
  }
  
  if (!styles || styles.length === 0) {
    console.log('  No layer_styles found');
    return;
  }
  
  let updated = 0;
  
  for (const style of styles) {
    try {
      // Calculate hash for layer style
      const hash = generateLayerStyleContentHash({
        name: style.name,
        classes: style.classes || '',
        design: style.design || {},
      });
      
      // Update layer_style with content_hash
      const { error: updateError } = await client
        .from('layer_styles')
        .update({ content_hash: hash })
        .eq('id', style.id);
      
      if (updateError) {
        console.error(`  Error updating layer_style ${style.id}:`, updateError.message);
      } else {
        updated++;
      }
    } catch (error) {
      console.error(`  Error processing layer_style ${style.id}:`, error);
    }
  }
  
  console.log(`  Updated ${updated} of ${styles.length} layer_styles`);
}

async function main() {
  console.log('Starting content hash backfill...\n');
  
  try {
    await backfillPageHashes();
    await backfillPageLayersHashes();
    await backfillComponentHashes();
    await backfillLayerStyleHashes();
    
    console.log('\n✅ Content hash backfill completed successfully');
  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  }
}

// Run the script
main();

