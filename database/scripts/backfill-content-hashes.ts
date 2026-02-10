/**
 * Backfill Content Hashes Script
 * 
 * This script calculates and stores content_hash for all existing entities:
 * - Pages (metadata hash)
 * - PageLayers (layers + CSS hash)
 * - Components (name + layers hash)
 * - LayerStyles (name + classes + design hash)
 * - Assets (all mutable fields hash)
 * 
 * Run this after the content_hash migrations have been applied.
 * 
 * Usage: npx tsx database/scripts/backfill-content-hashes.ts
 */

import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  generatePageMetadataHash,
  generatePageLayersHash,
  generateComponentContentHash,
  generateLayerStyleContentHash,
  generateAssetContentHash,
} from '../../lib/hash-utils';

const PAGE_SIZE = 1000;

/** Create Supabase client from .credentials.json (bypasses server-only modules) */
async function getSupabaseClient(): Promise<SupabaseClient> {
  const credentialsPath = path.join(process.cwd(), '.credentials.json');

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      'Supabase credentials not found. Please configure Supabase in the builder first.'
    );
  }

  const credentialsFile = fs.readFileSync(credentialsPath, 'utf-8');
  const credentials = JSON.parse(credentialsFile);
  const config = credentials.supabase_config;

  if (!config?.connectionUrl || !config?.serviceRoleKey) {
    throw new Error('Invalid Supabase configuration in .credentials.json');
  }

  const match = config.connectionUrl.match(/postgres\.([^:]+)/);
  if (!match) {
    throw new Error('Could not parse project reference from connection URL');
  }

  const projectRef = match[1];
  const projectUrl = `https://${projectRef}.supabase.co`;

  return createClient(projectUrl, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Fetch all rows matching a query using pagination.
 * Supabase caps results at 1000 per request.
 */
async function fetchAllPaginated(
  client: SupabaseClient,
  table: string,
  applyFilters: (query: any) => any,
): Promise<any[]> {
  const allRows: any[] = [];
  let offset = 0;

  while (true) {
    const baseQuery = client.from(table).select('*');
    const { data, error } = await applyFilters(baseQuery)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch ${table}: ${error.message}`);
    }

    if (!data || data.length === 0) break;

    allRows.push(...data);

    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return allRows;
}

async function backfillPageHashes(client: SupabaseClient) {
  console.log('Backfilling page content hashes...');

  const pages = await fetchAllPaginated(client, 'pages', (q) =>
    q.is('deleted_at', null).is('content_hash', null)
  );

  if (pages.length === 0) {
    console.log('  No pages need backfilling');
    return;
  }

  let updated = 0;

  for (const page of pages) {
    try {
      const hash = generatePageMetadataHash({
        name: page.name,
        slug: page.slug,
        settings: page.settings || {},
        is_index: page.is_index || false,
        is_dynamic: page.is_dynamic || false,
        error_page: page.error_page || null,
      });

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

async function backfillPageLayersHashes(client: SupabaseClient) {
  console.log('Backfilling page_layers content hashes...');

  const pageLayersRecords = await fetchAllPaginated(client, 'page_layers', (q) =>
    q.is('deleted_at', null).is('content_hash', null)
  );

  if (pageLayersRecords.length === 0) {
    console.log('  No page_layers need backfilling');
    return;
  }

  let updated = 0;

  for (const record of pageLayersRecords) {
    try {
      const hash = generatePageLayersHash({
        layers: record.layers || [],
        generated_css: record.generated_css || null,
      });

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

async function backfillComponentHashes(client: SupabaseClient) {
  console.log('Backfilling component content hashes...');

  const components = await fetchAllPaginated(client, 'components', (q) =>
    q.is('content_hash', null)
  );

  if (components.length === 0) {
    console.log('  No components need backfilling');
    return;
  }

  let updated = 0;

  for (const component of components) {
    try {
      const hash = generateComponentContentHash({
        name: component.name,
        layers: component.layers || [],
      });

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

async function backfillLayerStyleHashes(client: SupabaseClient) {
  console.log('Backfilling layer_styles content hashes...');

  const styles = await fetchAllPaginated(client, 'layer_styles', (q) =>
    q.is('content_hash', null)
  );

  if (styles.length === 0) {
    console.log('  No layer_styles need backfilling');
    return;
  }

  let updated = 0;

  for (const style of styles) {
    try {
      const hash = generateLayerStyleContentHash({
        name: style.name,
        classes: style.classes || '',
        design: style.design || {},
      });

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

async function backfillAssetHashes(client: SupabaseClient) {
  console.log('Backfilling asset content hashes...');

  const assets = await fetchAllPaginated(client, 'assets', (q) =>
    q.is('content_hash', null).is('deleted_at', null)
  );

  if (assets.length === 0) {
    console.log('  No assets need backfilling');
    return;
  }

  let updated = 0;

  for (const asset of assets) {
    try {
      const hash = generateAssetContentHash({
        filename: asset.filename,
        storage_path: asset.storage_path,
        public_url: asset.public_url,
        file_size: asset.file_size,
        mime_type: asset.mime_type,
        width: asset.width,
        height: asset.height,
        asset_folder_id: asset.asset_folder_id,
        content: asset.content,
        source: asset.source,
      });

      const { error: updateError } = await client
        .from('assets')
        .update({ content_hash: hash })
        .eq('id', asset.id)
        .eq('is_published', asset.is_published);

      if (updateError) {
        console.error(`  Error updating asset ${asset.id}:`, updateError.message);
      } else {
        updated++;
      }
    } catch (error) {
      console.error(`  Error processing asset ${asset.id}:`, error);
    }
  }

  console.log(`  Updated ${updated} of ${assets.length} assets`);
}

async function main() {
  console.log('Starting content hash backfill...\n');

  try {
    const client = await getSupabaseClient();

    await backfillPageHashes(client);
    await backfillPageLayersHashes(client);
    await backfillComponentHashes(client);
    await backfillLayerStyleHashes(client);
    await backfillAssetHashes(client);

    console.log('\n✅ Content hash backfill completed successfully');
  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
