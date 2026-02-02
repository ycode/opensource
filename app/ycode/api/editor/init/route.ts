import { NextResponse } from 'next/server';
import { getAllDraftPages } from '@/lib/repositories/pageRepository';
import { getAllDraftLayers } from '@/lib/repositories/pageLayersRepository';
import { getAllPageFolders } from '@/lib/repositories/pageFolderRepository';
import { getAllComponents } from '@/lib/repositories/componentRepository';
import { getAllStyles } from '@/lib/repositories/layerStyleRepository';
import { getAllSettings } from '@/lib/repositories/settingsRepository';
import { getAllCollections } from '@/lib/repositories/collectionRepository';
import { getAllLocales } from '@/lib/repositories/localeRepository';
import { getAllAssets } from '@/lib/repositories/assetRepository';
import { getAllAssetFolders } from '@/lib/repositories/assetFolderRepository';

/**
 * GET /ycode/api/editor/init
 * Get all initial data for the editor in one request:
 * - All draft (non-published) pages
 * - All draft layers
 * - All page folders
 * - All components
 * - All layer styles
 * - All settings
 * - All collections
 * - All locales
 * - All assets
 * - All asset folders
 */
export async function GET() {
  try {
    // Load all data in parallel (only drafts for editor)
    const [pages, drafts, folders, components, styles, settings, collections, locales, assets, assetFolders] = await Promise.all([
      getAllDraftPages(),
      getAllDraftLayers(),
      getAllPageFolders({ is_published: false }),
      getAllComponents(),
      getAllStyles(),
      getAllSettings(),
      getAllCollections(),
      getAllLocales(),
      getAllAssets(),
      getAllAssetFolders(false),
    ]);

    return NextResponse.json({
      data: {
        pages,
        drafts,
        folders,
        components,
        styles,
        settings,
        collections,
        locales,
        assets,
        assetFolders,
      },
    });
  } catch (error) {
    console.error('Error loading editor data:', error);
    return NextResponse.json(
      { error: 'Failed to load editor data' },
      { status: 500 }
    );
  }
}
