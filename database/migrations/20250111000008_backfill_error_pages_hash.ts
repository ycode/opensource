import type { Knex } from 'knex';
import {
  generatePageMetadataHash,
  generatePageLayersHash,
} from '@/lib/hash-utils';

/**
 * Migration: Backfill content_hash for Error Pages (404, 401, 500)
 *
 * Error pages are created in migration 20250101000003 before content_hash
 * columns exist. This migration calculates and sets the missing content_hash values
 * for error pages and their layers.
 *
 * Only updates records where content_hash is currently NULL.
 */

export async function up(knex: Knex): Promise<void> {
  console.log('=== Backfilling content_hash for Error Pages ===\n');

  // Fetch all error pages (pages with error_page !== null)
  const errorPages = await knex('pages')
    .select('*')
    .whereNotNull('error_page')
    .whereNull('deleted_at');

  console.log(`Found ${errorPages.length} error pages\n`);

  for (const page of errorPages) {
    // Only update if content_hash is null (not already set)
    if (!page.content_hash) {
      // Calculate content_hash for page metadata
      const pageHash = generatePageMetadataHash({
        name: page.name,
        slug: page.slug,
        is_index: page.is_index,
        is_dynamic: page.is_dynamic,
        error_page: page.error_page,
        settings: page.settings,
      });

      // Update page with content_hash
      await knex('pages')
        .where({ id: page.id })
        .update({ content_hash: pageHash });

      console.log(`✓ Updated error page "${page.name}" (${page.error_page}) with content_hash: ${pageHash}`);
    } else {
      console.log(`- Skipped error page "${page.name}" (${page.error_page}) - already has content_hash`);
    }
  }

  console.log('\n--- Processing Error Page Layers ---\n');

  // Fetch all layers for error pages
  const errorPageIds = errorPages.map(p => p.id);
  const errorPageLayers = await knex('page_layers')
    .select('*')
    .whereIn('page_id', errorPageIds)
    .whereNull('deleted_at');

  console.log(`Found ${errorPageLayers.length} error page layer records\n`);

  for (const layers of errorPageLayers) {
    const errorPage = errorPages.find(p => p.id === layers.page_id);

    if (layers && !layers.content_hash) {
      // Calculate content_hash for layers
      const layersHash = generatePageLayersHash({
        layers: layers.layers,
        generated_css: layers.generated_css || null,
      });

      // Update layers with content_hash
      await knex('page_layers')
        .where({ id: layers.id })
        .update({ content_hash: layersHash });

      console.log(`✓ Updated error page "${errorPage?.name}" (${errorPage?.error_page}) layers with content_hash: ${layersHash}`);
    } else if (layers.content_hash) {
      console.log(`- Skipped error page "${errorPage?.name}" (${errorPage?.error_page}) layers - already has content_hash`);
    }
  }

  console.log('\n=== Backfill Complete ===');
}

export async function down(knex: Knex): Promise<void> {
  console.log('=== Rolling back Error Pages content_hash backfill ===\n');

  // Fetch all error pages
  const errorPages = await knex('pages')
    .select('id', 'name', 'error_page')
    .whereNotNull('error_page')
    .whereNull('deleted_at');

  // Clear content_hash from error pages
  await knex('pages')
    .whereIn('id', errorPages.map(p => p.id))
    .update({ content_hash: null });

  // Clear content_hash from error page layers
  await knex('page_layers')
    .whereIn('page_id', errorPages.map(p => p.id))
    .whereNull('deleted_at')
    .update({ content_hash: null });

  console.log(`✓ Cleared content_hash from ${errorPages.length} error pages and their layers`);
  console.log('\n=== Rollback Complete ===');
}

