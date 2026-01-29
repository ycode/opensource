/**
 * Seed Remix Icons Script
 * 
 * This script seeds the asset library with all Remix Icons (https://remixicon.com/)
 * Icons are stored as inline SVG content in the assets table.
 * 
 * Prerequisites:
 * - Install remixicon: npm install --save-dev remixicon
 * 
 * Usage: npx ts-node database/scripts/seed-remix-icons.ts
 */

import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read credentials directly from file (bypassing server-only modules)
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
  
  // Parse project URL from connection URL
  // Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
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

const ICONS_FOLDER_NAME = 'Icons';
const REMIX_FOLDER_NAME = 'Remix';
const ICON_SOURCE = 'remix-icons';

/**
 * Get all SVG icons from remixicon package (all categories combined)
 */
function getAllIcons(): { filename: string; content: string }[] {
  const remixIconPath = path.join(process.cwd(), 'node_modules', 'remixicon', 'icons');
  
  if (!fs.existsSync(remixIconPath)) {
    throw new Error(
      'remixicon package not found. Please install it first:\n' +
      'npm install --save-dev remixicon'
    );
  }
  
  const icons: { filename: string; content: string }[] = [];
  const categories = fs.readdirSync(remixIconPath, { withFileTypes: true });
  
  for (const category of categories) {
    if (category.isDirectory()) {
      const categoryPath = path.join(remixIconPath, category.name);
      const files = fs.readdirSync(categoryPath);
      
      for (const file of files) {
        if (file.endsWith('.svg')) {
          const filePath = path.join(categoryPath, file);
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
async function createFolderStructure(client: SupabaseClient): Promise<string> {
  console.log('Creating folder structure...');
  
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
    console.log(`  Found existing Icons folder: ${iconsFolderId}`);
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
      throw new Error(`Failed to create Icons folder: ${iconsFolderError.message}`);
    }
    
    iconsFolderId = iconsFolder.id;
    console.log(`  Created Icons folder: ${iconsFolderId}`);
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
    console.log(`  Found existing Remix folder: ${remixFolderId}`);
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
      throw new Error(`Failed to create Remix folder: ${remixFolderError.message}`);
    }
    
    remixFolderId = remixFolder.id;
    console.log(`  Created Remix folder: ${remixFolderId}`);
  }
  
  return remixFolderId;
}

/**
 * Seed all icons into the Remix folder
 */
async function seedIcons(
  client: SupabaseClient,
  folderId: string,
  icons: { filename: string; content: string }[]
): Promise<{ inserted: number; skipped: number }> {
  let inserted = 0;
  let skipped = 0;
  
  // Get existing icons in this folder to avoid duplicates
  const { data: existingAssets } = await client
    .from('assets')
    .select('filename')
    .eq('asset_folder_id', folderId)
    .eq('source', ICON_SOURCE);
  
  const existingFilenames = new Set(existingAssets?.map(a => a.filename) || []);
  
  // Filter out already existing icons
  const iconsToInsert = icons.filter(icon => !existingFilenames.has(icon.filename));
  skipped = icons.length - iconsToInsert.length;
  
  if (iconsToInsert.length === 0) {
    return { inserted: 0, skipped };
  }
  
  // Batch insert icons (100 at a time for performance)
  const BATCH_SIZE = 100;
  const totalBatches = Math.ceil(iconsToInsert.length / BATCH_SIZE);
  
  for (let i = 0; i < iconsToInsert.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = iconsToInsert.slice(i, i + BATCH_SIZE);
    
    process.stdout.write(`\r  Inserting batch ${batchNum}/${totalBatches}...`);
    
    const assetsToInsert = batch.map(icon => ({
      filename: icon.filename,
      storage_path: null,
      public_url: null,
      file_size: Buffer.byteLength(icon.content, 'utf-8'),
      mime_type: 'image/svg+xml',
      width: 24,
      height: 24,
      source: ICON_SOURCE,
      asset_folder_id: folderId,
      content: icon.content,
    }));
    
    const { error } = await client
      .from('assets')
      .insert(assetsToInsert);
    
    if (error) {
      console.error(`\n  Error inserting batch ${batchNum}:`, error.message);
    } else {
      inserted += batch.length;
    }
  }
  
  console.log(''); // New line after progress
  
  return { inserted, skipped };
}

async function main() {
  console.log('🎨 Seeding Remix Icons...\n');
  
  try {
    // Initialize Supabase client
    console.log('Connecting to Supabase...');
    const client = await getSupabaseClient();
    console.log('Connected!\n');
    
    // Get all icons
    console.log('Loading icons from remixicon package...');
    const icons = getAllIcons();
    console.log(`Found ${icons.length} icons\n`);
    
    // Create folder structure: Icons > Remix
    const remixFolderId = await createFolderStructure(client);
    console.log('');
    
    // Seed all icons into the Remix folder
    console.log('Seeding icons...');
    const { inserted, skipped } = await seedIcons(client, remixFolderId, icons);
    
    console.log(`\n✅ Remix Icons seeding completed!`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Skipped (already exist): ${skipped}`);
    
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the script
main();
