/**
 * Fix 401 Error Page Layout Script
 *
 * Updates the default 401 error page to use consistent layout with 404 and 500 pages:
 * - Adds h-[100vh] for full viewport height
 * - Adds justify-center and h-full for vertical centering
 * - Normalizes font sizes to 12px (was 14px)
 * - Normalizes text colors to #111827 (was #6b7280 for description)
 *
 * Only updates pages that still have the old default layout (not user-customized).
 *
 * Usage: npx tsx database/scripts/fix-401-error-page-layout.ts
 */

import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_ERROR_PAGES } from '../../lib/page-utils';

/** Create Supabase client from .credentials.json (bypasses server-only modules) */
async function getSupabaseClient(): Promise<SupabaseClient> {
  const credentialsPath = path.join(process.cwd(), '.credentials.json');
  const raw = fs.readFileSync(credentialsPath, 'utf-8');
  const credentials = JSON.parse(raw);

  const supabaseUrl = credentials.supabase_url;
  const supabaseKey = credentials.supabase_service_role_key;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing supabase_url or supabase_service_role_key in .credentials.json');
  }

  return createClient(supabaseUrl, supabaseKey);
}

async function main() {
  console.log('Starting 401 error page layout fix...\n');

  const client = await getSupabaseClient();

  const errorPage401Config = DEFAULT_ERROR_PAGES.find((p) => p.code === 401);
  if (!errorPage401Config) {
    console.log('No 401 error page config found in DEFAULT_ERROR_PAGES. Skipping.');
    return;
  }

  // Find the 401 error page
  const { data: pages, error: pageError } = await client
    .from('pages')
    .select('id')
    .eq('error_page', 401);

  if (pageError) {
    console.error('Error fetching 401 page:', pageError.message);
    return;
  }

  if (!pages || pages.length === 0) {
    console.log('No 401 error page found. Skipping.');
    return;
  }

  const page = pages[0];
  console.log(`Found 401 error page: ${page.id}`);

  // Get layer records for this page
  const { data: layerRecords, error: layerError } = await client
    .from('page_layers')
    .select('*')
    .eq('page_id', page.id);

  if (layerError) {
    console.error('Error fetching page layers:', layerError.message);
    return;
  }

  if (!layerRecords || layerRecords.length === 0) {
    console.log('No layer records found for 401 page. Skipping.');
    return;
  }

  let updatedCount = 0;

  for (const record of layerRecords) {
    const layers = typeof record.layers === 'string' ? JSON.parse(record.layers) : record.layers;

    // Check if this is still the old default layout by looking for the telltale
    // pt-[6rem] class on the section (which the old 401 had, but 404/500 don't)
    const body = layers?.[0];
    const section = body?.children?.[0];
    if (!section || !section.classes?.includes('pt-[6rem]')) {
      console.log(`  Record ${record.id}: already updated or user-customized. Skipping.`);
      continue;
    }

    // Replace with the new consistent layout
    const { error: updateError } = await client
      .from('page_layers')
      .update({ layers: errorPage401Config.layers })
      .eq('id', record.id);

    if (updateError) {
      console.error(`  Record ${record.id}: failed to update - ${updateError.message}`);
    } else {
      updatedCount++;
      console.log(`  Record ${record.id}: updated successfully.`);
    }
  }

  console.log(`\nDone. Updated ${updatedCount} of ${layerRecords.length} layer record(s).`);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
