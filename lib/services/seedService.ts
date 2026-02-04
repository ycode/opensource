/**
 * Seed Service
 *
 * Handles seeding the database with default data like Remix Icons.
 * Runs after migrations complete.
 */

import fs from 'fs';
import path from 'path';
import { getSupabaseAdmin } from '../supabase-server';
import { SUPABASE_WRITE_BATCH_SIZE } from '../supabase/constants';

const ICONS_FOLDER_NAME = 'Icons';
const REMIX_FOLDER_NAME = 'Remix';
const ICON_SOURCE = 'remix-icons';

export interface SeedResult {
  success: boolean;
  inserted: number;
  skipped: number;
  error?: string;
}

/**
 * Get all SVG icons from remixicon package (all categories combined)
 */
function getAllRemixIcons(): { filename: string; content: string }[] {
  const remixIconPath = path.join(process.cwd(), 'node_modules', 'remixicon', 'icons');

  if (!fs.existsSync(remixIconPath)) {
    console.log('[seedRemixIcons] remixicon package not found, skipping icon seeding');
    return [];
  }

  const icons: { filename: string; content: string }[] = [];
  const categories = fs.readdirSync(remixIconPath, { withFileTypes: true });

  for (const category of categories) {
    if (category.isDirectory()) {
      // Use template literal to avoid Turbopack static analysis warnings
      const categoryPath = `${remixIconPath}/${category.name}`;
      const files = fs.readdirSync(categoryPath);

      for (const file of files) {
        if (file.endsWith('.svg')) {
          const filePath = `${categoryPath}/${file}`;
          const content = fs.readFileSync(filePath, 'utf-8');
          icons.push({
            filename: file,
            content,
          });
        }
      }
    }
  }

  return icons;
}

/**
 * Create the Icons > Remix folder structure
 */
async function createFolderStructure(): Promise<string | null> {
  const client = await getSupabaseAdmin();

  if (!client) {
    console.error('[seedRemixIcons] Supabase not configured');
    return null;
  }

  // Check if Icons folder already exists
  const { data: existingIconsFolders } = await client
    .from('asset_folders')
    .select('*')
    .eq('name', ICONS_FOLDER_NAME)
    .is('asset_folder_id', null)
    .is('deleted_at', null);

  let iconsFolderId: string;

  if (existingIconsFolders && existingIconsFolders.length > 0) {
    iconsFolderId = existingIconsFolders[0].id;
  } else {
    // Create Icons root folder
    const { data: iconsFolder, error: iconsFolderError } = await client
      .from('asset_folders')
      .insert({
        name: ICONS_FOLDER_NAME,
        asset_folder_id: null,
        depth: 0,
        order: 0,
        is_published: false,
      })
      .select()
      .single();

    if (iconsFolderError) {
      console.error('[seedRemixIcons] Failed to create Icons folder:', iconsFolderError.message);
      return null;
    }

    iconsFolderId = iconsFolder.id;
  }

  // Check if Remix folder already exists inside Icons
  const { data: existingRemixFolders } = await client
    .from('asset_folders')
    .select('*')
    .eq('name', REMIX_FOLDER_NAME)
    .eq('asset_folder_id', iconsFolderId)
    .is('deleted_at', null);

  let remixFolderId: string;

  if (existingRemixFolders && existingRemixFolders.length > 0) {
    remixFolderId = existingRemixFolders[0].id;
  } else {
    // Create Remix subfolder
    const { data: remixFolder, error: remixFolderError } = await client
      .from('asset_folders')
      .insert({
        name: REMIX_FOLDER_NAME,
        asset_folder_id: iconsFolderId,
        depth: 1,
        order: 0,
        is_published: false,
      })
      .select()
      .single();

    if (remixFolderError) {
      console.error('[seedRemixIcons] Failed to create Remix folder:', remixFolderError.message);
      return null;
    }

    remixFolderId = remixFolder.id;
  }

  return remixFolderId;
}

/**
 * Seed Remix Icons into the database
 * Creates Icons > Remix folder and populates with all icons
 */
export async function seedRemixIcons(): Promise<SeedResult> {
  console.log('[seedRemixIcons] Starting Remix Icons seeding...');

  try {
    const client = await getSupabaseAdmin();

    if (!client) {
      return {
        success: false,
        inserted: 0,
        skipped: 0,
        error: 'Supabase not configured',
      };
    }

    // Get all icons from the package
    const icons = getAllRemixIcons();

    if (icons.length === 0) {
      console.log('[seedRemixIcons] No icons found (remixicon package may not be installed)');
      return {
        success: true,
        inserted: 0,
        skipped: 0,
      };
    }

    console.log(`[seedRemixIcons] Found ${icons.length} icons`);

    // Create folder structure
    const remixFolderId = await createFolderStructure();

    if (!remixFolderId) {
      return {
        success: false,
        inserted: 0,
        skipped: 0,
        error: 'Failed to create folder structure',
      };
    }

    // Get ALL existing remix icons by source (regardless of folder)
    // Paginate to get all results since Supabase has a 1000 row limit
    const existingFilenames = new Set<string>();
    let offset = 0;
    const PAGE_SIZE = 1000;

    while (true) {
      const { data: existingAssets } = await client
        .from('assets')
        .select('filename')
        .eq('source', ICON_SOURCE)
        .eq('is_published', false)
        .is('deleted_at', null)
        .range(offset, offset + PAGE_SIZE - 1);

      if (!existingAssets || existingAssets.length === 0) break;

      existingAssets.forEach(a => existingFilenames.add(a.filename));

      if (existingAssets.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    console.log(`[seedRemixIcons] Found ${existingFilenames.size} existing icons in database`);

    // Filter out already existing icons
    const iconsToInsert = icons.filter(icon => !existingFilenames.has(icon.filename));
    const skipped = icons.length - iconsToInsert.length;

    if (iconsToInsert.length === 0) {
      console.log('[seedRemixIcons] All icons already exist, skipping');
      return {
        success: true,
        inserted: 0,
        skipped,
      };
    }

    // Batch insert icons
    let inserted = 0;

    for (let i = 0; i < iconsToInsert.length; i += SUPABASE_WRITE_BATCH_SIZE) {
      const batch = iconsToInsert.slice(i, i + SUPABASE_WRITE_BATCH_SIZE);

      const now = new Date().toISOString();
      const assetsToInsert = batch.map(icon => ({
        filename: icon.filename,
        storage_path: null,
        public_url: null,
        file_size: Buffer.byteLength(icon.content, 'utf-8'),
        mime_type: 'image/svg+xml',
        width: 24,
        height: 24,
        source: ICON_SOURCE,
        asset_folder_id: remixFolderId,
        content: icon.content,
        is_published: false,
        updated_at: now,
      }));

      const { error } = await client
        .from('assets')
        .insert(assetsToInsert);

      if (error) {
        console.error(`[seedRemixIcons] Error inserting batch:`, error.message);
      } else {
        inserted += batch.length;
      }
    }

    console.log(`[seedRemixIcons] Seeding completed: ${inserted} inserted, ${skipped} skipped`);

    return {
      success: true,
      inserted,
      skipped,
    };

  } catch (error) {
    console.error('[seedRemixIcons] Seeding failed:', error);
    return {
      success: false,
      inserted: 0,
      skipped: 0,
      error: error instanceof Error ? error.message : 'Seeding failed',
    };
  }
}

/**
 * Run all seed operations
 */
export async function runSeeds(): Promise<{ success: boolean; results: Record<string, SeedResult> }> {
  const results: Record<string, SeedResult> = {};

  // Seed Remix Icons
  results.remixIcons = await seedRemixIcons();

  // Add more seeds here as needed
  // results.otherSeed = await seedOther();

  const success = Object.values(results).every(r => r.success);

  return { success, results };
}
