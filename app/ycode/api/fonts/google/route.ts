import fs from 'fs';
import path from 'path';
import { noCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

/**
 * GET /ycode/api/fonts/google
 *
 * Returns the static Google Fonts catalog from storage/fonts/google-fonts.json.
 * Generate the file with: npm run fonts:update
 */
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'storage', 'fonts', 'google-fonts.json');

    if (!fs.existsSync(filePath)) {
      console.warn('Google Fonts catalog not found — run "npm run fonts:update" to generate it');
      return noCache({ data: [] });
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const fonts = JSON.parse(raw);

    return noCache({ data: fonts });
  } catch (error) {
    console.error('Failed to read Google Fonts catalog:', error);
    return noCache(
      { error: 'Failed to load Google Fonts catalog' },
      500
    );
  }
}
