import { NextRequest, NextResponse } from 'next/server';
import { upsertTranslations } from '@/lib/repositories/translationRepository';
import type { CreateTranslationData } from '@/types';

/**
 * POST /ycode/api/translations/bulk
 * Upsert multiple translations in a single operation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { translations } = body;

    if (!Array.isArray(translations)) {
      return NextResponse.json(
        { error: 'Missing or invalid translations array' },
        { status: 400 }
      );
    }

    // Validate all translations have required fields (content_value can be empty string to indicate "use original")
    for (const translation of translations) {
      const { locale_id, source_type, source_id, content_key, content_type, content_value } = translation;
      if (!locale_id || !source_type || !source_id || !content_key || !content_type || content_value === undefined || content_value === null) {
        return NextResponse.json(
          { error: 'All translations must have: locale_id, source_type, source_id, content_key, content_type, content_value' },
          { status: 400 }
        );
      }
    }

    const result = await upsertTranslations(translations as CreateTranslationData[]);

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    console.error('Error upserting translations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upsert translations' },
      { status: 500 }
    );
  }
}
