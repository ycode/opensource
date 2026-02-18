/**
 * Fetch Google Fonts Catalog
 *
 * Downloads the full Google Fonts catalog and saves it as a static JSON file.
 * This avoids requiring users to set up a Google Fonts API key.
 *
 * Usage: npm run fonts:update
 *
 * The output file is committed to the repo so forked projects get it out of the box.
 * Re-run periodically to pick up newly added Google Fonts.
 */

import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'storage', 'fonts');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'google-fonts.json');
const API_URL = 'https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity';

interface GoogleFontItem {
  family: string;
  variants: string[];
  category: string;
}

/** Load key=value pairs from .env into process.env */
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

async function fetchGoogleFonts() {
  loadEnv();

  // Allow API key via .env or CLI arg
  const apiKey = process.env.GOOGLE_FONTS_API_KEY || process.argv[2];

  if (!apiKey) {
    throw new Error(
      'GOOGLE_FONTS_API_KEY is required.\n' +
      'Add it to .env or pass as argument: npm run fonts:update -- YOUR_KEY'
    );
  }

  const url = `${API_URL}&key=${apiKey}`;

  console.log('Fetching Google Fonts catalog...');

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Google Fonts API returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const items: GoogleFontItem[] = (data.items || []).map((font: Record<string, unknown>) => ({
    family: font.family,
    variants: font.variants,
    category: font.category,
  }));

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Write the catalog
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(items, null, 2), 'utf-8');

  console.log(`Saved ${items.length} fonts to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

fetchGoogleFonts().catch((error) => {
  console.error('Failed to fetch Google Fonts:', error);
  process.exit(1);
});
