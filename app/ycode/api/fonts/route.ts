import { NextRequest } from 'next/server';
import { noCache } from '@/lib/api-response';
import { getAllFonts, createFont } from '@/lib/repositories/fontRepository';
import { uploadFontFile } from '@/lib/font-upload';
import { ALLOWED_FONT_EXTENSIONS } from '@/lib/font-utils';

export const dynamic = 'force-dynamic';

/**
 * GET /ycode/api/fonts
 * List all fonts (Google + custom)
 */
export async function GET() {
  try {
    const fonts = await getAllFonts();
    return noCache({ data: fonts });
  } catch (error) {
    console.error('Failed to fetch fonts:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to fetch fonts' },
      500
    );
  }
}

/**
 * POST /ycode/api/fonts
 *
 * Create a font. Supports two modes:
 * - JSON body: Add a Google Font (from search/selection)
 * - FormData body: Upload a custom font file
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Handle custom font upload via FormData
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const files = formData.getAll('file') as File[];

      if (!files || files.length === 0) {
        return noCache({ error: 'No font files provided' }, 400);
      }

      const uploadedFonts = [];

      for (const file of files) {
        // Validate file extension
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (!ALLOWED_FONT_EXTENSIONS.includes(ext)) {
          return noCache(
            { error: `Unsupported font format: .${ext}. Allowed: ${ALLOWED_FONT_EXTENSIONS.join(', ')}` },
            400
          );
        }

        // Max 10MB per font file
        if (file.size > 10 * 1024 * 1024) {
          return noCache({ error: 'Font file must be less than 10MB' }, 400);
        }

        const font = await uploadFontFile(file);
        if (font) {
          uploadedFonts.push(font);
        }
      }

      if (uploadedFonts.length === 0) {
        return noCache({ error: 'Failed to upload font files' }, 500);
      }

      return noCache({ data: uploadedFonts }, 201);
    }

    // Handle Google Font addition via JSON
    const body = await request.json();

    if (!body.name || !body.family) {
      return noCache({ error: 'Missing required fields: name, family' }, 400);
    }

    const font = await createFont({
      name: body.name,
      family: body.family,
      type: body.type || 'google',
      variants: body.variants || [],
      weights: body.weights || ['400', '700'],
      category: body.category || '',
    });

    return noCache({ data: font }, 201);
  } catch (error) {
    console.error('Failed to create font:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to create font' },
      500
    );
  }
}
