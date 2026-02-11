/**
 * Migrate .credentials.json to .env
 *
 * Reads the legacy .credentials.json file and appends the Supabase
 * credentials to .env, then deletes the old file.
 *
 * Usage: npx ts-node scripts/migrate-credentials.ts
 */

import fs from 'fs';
import path from 'path';

const CREDENTIALS_FILE = path.join(process.cwd(), '.credentials.json');
const ENV_FILE = path.join(process.cwd(), '.env');

function run() {
  // Check if .credentials.json exists
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    console.log('No .credentials.json found — nothing to migrate.');
    return;
  }

  // Read and parse
  const raw = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
  const data = JSON.parse(raw);
  const config = data.supabase_config;

  if (!config || !config.anonKey || !config.serviceRoleKey || !config.connectionUrl || !config.dbPassword) {
    console.error('Invalid .credentials.json — missing supabase_config fields.');
    process.exit(1);
  }

  // Check if .env already has Supabase vars
  if (fs.existsSync(ENV_FILE)) {
    const existing = fs.readFileSync(ENV_FILE, 'utf-8');

    if (existing.includes('SUPABASE_PUBLISHABLE_KEY=')) {
      console.log('Supabase vars already present in .env — skipping write.');
      console.log('You can manually delete .credentials.json if no longer needed.');
      return;
    }
  }

  // Build Supabase vars block
  const block = [
    '',
    '# Migrated from .credentials.json',
    `SUPABASE_PUBLISHABLE_KEY="${config.anonKey}"`,
    `SUPABASE_SECRET_KEY="${config.serviceRoleKey}"`,
    `SUPABASE_CONNECTION_URL="${config.connectionUrl}"`,
    `SUPABASE_DB_PASSWORD="${config.dbPassword}"`,
    '',
  ].join('\n');

  // Append to .env (creates the file if it doesn't exist)
  fs.appendFileSync(ENV_FILE, block, 'utf-8');

  // Delete .credentials.json
  fs.unlinkSync(CREDENTIALS_FILE);

  console.log('Done! Migrated .credentials.json → .env');
  console.log('Restart your dev server for the changes to take effect.');
}

run();
