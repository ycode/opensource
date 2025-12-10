import { NextRequest, NextResponse } from 'next/server';
import { setDefaultLocale } from '@/lib/repositories/localeRepository';

/**
 * POST /api/locales/[id]/default
 * Set a locale as the default
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const locale = await setDefaultLocale(id);
    
    return NextResponse.json({ data: locale });
  } catch (error) {
    console.error('Error setting default locale:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to set default locale' },
      { status: 500 }
    );
  }
}
