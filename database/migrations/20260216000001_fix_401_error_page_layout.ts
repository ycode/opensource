import type { Knex } from 'knex';
import { DEFAULT_ERROR_PAGES } from '@/lib/page-utils';

/**
 * Migration: Fix 401 error page layout
 *
 * Updates the default 401 error page to use consistent layout with 404 and 500 pages:
 * - Adds h-[100vh] for full viewport height
 * - Adds justify-center and h-full for vertical centering
 * - Normalizes font sizes to 12px (was 14px)
 * - Normalizes text colors to #111827 (was #6b7280 for description)
 *
 * Only updates pages that still have the old default layout (not user-customized).
 */

export async function up(knex: Knex): Promise<void> {
  const errorPage401Config = DEFAULT_ERROR_PAGES.find((p) => p.code === 401);
  if (!errorPage401Config) return;

  // Find the 401 error page
  const page = await knex('pages').where({ error_page: 401 }).first();
  if (!page) return;

  // Update both draft and published layer versions
  const layerRecords = await knex('page_layers').where({ page_id: page.id });

  for (const record of layerRecords) {
    const layers = typeof record.layers === 'string' ? JSON.parse(record.layers) : record.layers;

    // Check if this is still the old default layout by looking for the telltale
    // pt-[6rem] class on the section (which the old 401 had, but 404/500 don't)
    const body = layers?.[0];
    const section = body?.children?.[0];
    if (!section || !section.classes?.includes('pt-[6rem]')) continue;

    // Replace with the new consistent layout
    await knex('page_layers')
      .where({ id: record.id })
      .update({ layers: errorPage401Config.layers });
  }
}

export async function down(_knex: Knex): Promise<void> {
  // No rollback — the old layout was a bug
}
